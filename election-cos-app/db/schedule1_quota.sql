-- Election Campaign OS — Schedule 1 seat allocation, in SQL
--
-- A CROSS-CHECK ENGINE, NOT THE APP'S ENGINE. The app computes this in
-- TypeScript (src/modules/analytics/seatCalculator.ts) against Firestore.
-- This is the same arithmetic for anyone who wants it inside a Postgres
-- database, and it is tested against the same IEC result (see
-- db/test_schedule1_quota.sh). Nothing in the Firebase build runs it.
--
-- WHAT THE SUPPLIED VERSION GOT WRONG (and this fixes)
--   * quota = valid votes / seats          -> floor(valid / (B - C - D)) + 1
--   * seats = TRUNC(votes / quota), and nothing allocates the rest
--                                          -> largest remainder fills B
--   * ward seats ignored                   -> PR seats = total - ward seats won, never negative
--   * no Item 16                           -> Item 16 as amended by Act 3 of 2021 (in force 1 Nov 2021):
--       a party whose ward seats are >= its Item 13 entitlement takes no list seats (16(1)) and keeps
--       its ward seats (16(2)); a new quota floor((A - B) / (C - (D + E))) + 1 is set (16(3)) and the
--       OTHER parties are divided by it (16(4)); ward seats are deducted (16(6)). The council stays C.
--   * ties                                 -> equal surpluses: the party with the highest valid votes
--       (Item 13(2)(b), 16(4)(c)). Equal surplus AND equal votes: the Act is silent; flagged, never a lot.
--   * ties                                 -> never guessed: flagged, seats left pending
-- On the 2021 NW405 result the supplied function allocated 65 of 67 seats.
--
-- B = council seats; C = ward seats won by independents; D = ward seats won
-- by parties with no PR list. B - C - D follows the IEC's own four-term
-- operational report; with C = D = 0 it is the statutory B.
--
-- Money-free, integer arithmetic only. Votes are a party's PR plus ward votes
-- as published; independents' votes are excluded from the total valid votes.

CREATE TABLE IF NOT EXISTS demarcation_version (
    demarcation_version_id TEXT PRIMARY KEY,
    municipality_code      TEXT    NOT NULL,
    total_council_seats    INTEGER NOT NULL CHECK (total_council_seats > 0),
    independent_ward_seats INTEGER NOT NULL DEFAULT 0 CHECK (independent_ward_seats >= 0),
    no_pr_list_ward_seats  INTEGER NOT NULL DEFAULT 0 CHECK (no_pr_list_ward_seats >= 0),
    effective_date         DATE    NOT NULL,
    CHECK (independent_ward_seats + no_pr_list_ward_seats < total_council_seats)
);

CREATE TABLE IF NOT EXISTS party_electoral_result (
    demarcation_version_id TEXT    NOT NULL REFERENCES demarcation_version,
    party_id               TEXT    NOT NULL,
    ward_votes             INTEGER NOT NULL DEFAULT 0 CHECK (ward_votes >= 0),
    pr_votes               INTEGER NOT NULL DEFAULT 0 CHECK (pr_votes >= 0),
    ward_seats_won         INTEGER NOT NULL DEFAULT 0 CHECK (ward_seats_won >= 0),
    provenance_hash        TEXT    NOT NULL CHECK (provenance_hash ~ '^[0-9a-f]{64}$'),
    PRIMARY KEY (demarcation_version_id, party_id)
);

CREATE OR REPLACE FUNCTION _ecos_award(p_seats INTEGER) RETURNS INTEGER AS $$
#variable_conflict use_column
-- Item 13(2) / 16(4)(b)-(c) over the ACTIVE rows of temp table w. Returns seats left unawarded
-- (non-zero only when a tie on surplus AND votes cannot be broken).
DECLARE
    v_remain INTEGER := p_seats; v_rem INTEGER; v_votes INTEGER; v_group INTEGER; v_progress BOOLEAN;
BEGIN
    <<outer>>
    WHILE v_remain > 0 LOOP
        UPDATE w SET got_this_pass = FALSE;
        v_progress := FALSE;
        LOOP
            EXIT WHEN v_remain <= 0;
            SELECT rem, votes INTO v_rem, v_votes FROM w
             WHERE active AND NOT got_this_pass ORDER BY rem DESC, votes DESC LIMIT 1;
            EXIT WHEN NOT FOUND;
            SELECT COUNT(*) INTO v_group FROM w
             WHERE active AND NOT got_this_pass AND rem = v_rem AND votes = v_votes;
            IF v_group > v_remain THEN EXIT outer; END IF;   -- unbreakable tie: stop, never guess
            UPDATE w SET rem_seats = rem_seats + 1, got_this_pass = TRUE
             WHERE active AND NOT got_this_pass AND rem = v_rem AND votes = v_votes;
            v_remain := v_remain - v_group;
            v_progress := TRUE;
        END LOOP;
        EXIT WHEN NOT v_progress;
    END LOOP;
    RETURN v_remain;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_calculate_schedule1_quotas(p_version TEXT)
RETURNS TABLE (
    party_id        TEXT,
    votes           INTEGER,
    ward_seats_won  INTEGER,
    entitlement     INTEGER,
    remainder       INTEGER,
    pr_seats        INTEGER,
    total_seats     INTEGER,
    quota           INTEGER,
    new_quota       INTEGER,   -- Item 16(3) quota; NULL when nobody had excessive seats
    excessive       BOOLEAN,
    pending_seats   INTEGER    -- same on every row: seats withheld because of an unbreakable tie
) AS $$
#variable_conflict use_column
DECLARE
    v_seats INTEGER; v_c INTEGER; v_d INTEGER; v_valid BIGINT; v_quota INTEGER; v_new INTEGER;
    v_b BIGINT; v_dd INTEGER; v_den INTEGER; v_left INTEGER;
BEGIN
    SELECT total_council_seats, independent_ward_seats, no_pr_list_ward_seats
      INTO v_seats, v_c, v_d FROM demarcation_version WHERE demarcation_version_id = p_version;
    IF NOT FOUND THEN RAISE EXCEPTION 'Unknown demarcation version %', p_version; END IF;
    SELECT COALESCE(SUM(r.ward_votes + r.pr_votes), 0) INTO v_valid
      FROM party_electoral_result r WHERE r.demarcation_version_id = p_version;
    IF v_valid = 0 THEN RAISE EXCEPTION 'No valid votes recorded for %', p_version; END IF;

    v_quota := (v_valid / (v_seats - v_c - v_d))::INTEGER + 1;           -- Item 12 (floors, then +1)

    DROP TABLE IF EXISTS w;
    CREATE TEMP TABLE w ON COMMIT DROP AS
    SELECT r.party_id AS pid, (r.ward_votes + r.pr_votes) AS votes, r.ward_seats_won AS wards,
           (r.ward_votes + r.pr_votes) / v_quota AS ent, (r.ward_votes + r.pr_votes) % v_quota AS rem,
           0 AS rem_seats, 0 AS pr, TRUE AS active, FALSE AS excessive, FALSE AS got_this_pass
      FROM party_electoral_result r WHERE r.demarcation_version_id = p_version;

    -- Item 13: surplus seats for every party
    v_left := _ecos_award((v_seats - v_c - v_d - (SELECT COALESCE(SUM(ent), 0) FROM w))::INTEGER);

    -- Item 16(1): ward seats equal to or greater than the Item 13 entitlement (0 is not a seat obtained)
    UPDATE w SET excessive = (wards > 0 AND wards >= ent + rem_seats);

    IF NOT EXISTS (SELECT 1 FROM w WHERE excessive) THEN
        UPDATE w SET pr = GREATEST(0, ent + rem_seats - wards);
    ELSE
        SELECT COALESCE(SUM(votes), 0), COALESCE(SUM(wards), 0) INTO v_b, v_dd FROM w WHERE excessive;
        v_den := v_seats - (v_dd + v_c);
        IF v_den < 1 THEN
            UPDATE w SET pr = 0;                      -- nonsensical input: nobody else takes a list seat
        ELSE
            v_new := ((v_valid - v_b) / v_den)::INTEGER + 1;                  -- Item 16(3)
            UPDATE w SET active = NOT excessive;
            UPDATE w SET ent = votes / v_new, rem = votes % v_new, rem_seats = 0 WHERE active;
            v_left := _ecos_award((v_seats - v_dd - v_c - (SELECT COALESCE(SUM(ent), 0) FROM w WHERE active))::INTEGER);
            UPDATE w SET pr = CASE WHEN active THEN GREATEST(0, ent + rem_seats - wards) ELSE 0 END;
        END IF;
    END IF;

    RETURN QUERY
    SELECT w.pid, w.votes::INTEGER, w.wards, w.ent::INTEGER, w.rem::INTEGER, w.pr,
           w.wards + w.pr, v_quota, v_new, w.excessive, GREATEST(v_left, 0)
      FROM w ORDER BY w.pid;
END;
$$ LANGUAGE plpgsql;
