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
--   * ward seats ignored                   -> PR seats = entitlement - ward seats won
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
    pending_seats   INTEGER   -- same on every row: seats withheld because of an unresolved tie
) AS $$
DECLARE
    v_seats   INTEGER;
    v_c       INTEGER;
    v_d       INTEGER;
    v_valid   BIGINT;
    v_quota   INTEGER;
    v_final   INTEGER;
    v_remain  INTEGER;
    v_rem     INTEGER;
    v_group   INTEGER;
    v_progress BOOLEAN;
BEGIN
    SELECT total_council_seats, independent_ward_seats, no_pr_list_ward_seats
      INTO v_seats, v_c, v_d
      FROM demarcation_version WHERE demarcation_version_id = p_version;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Unknown demarcation version %', p_version;
    END IF;

    SELECT COALESCE(SUM(r.ward_votes + r.pr_votes), 0) INTO v_valid
      FROM party_electoral_result r WHERE r.demarcation_version_id = p_version;
    IF v_valid = 0 THEN
        RAISE EXCEPTION 'No valid votes recorded for %', p_version;
    END IF;

    v_quota := (v_valid / (v_seats - v_c - v_d))::INTEGER + 1;  -- integer division floors

    CREATE TEMP TABLE w ON COMMIT DROP AS
    SELECT r.party_id AS pid,
           (r.ward_votes + r.pr_votes)                         AS votes,
           r.ward_seats_won                                    AS wards,
           (r.ward_votes + r.pr_votes) / v_quota               AS ent,
           (r.ward_votes + r.pr_votes) % v_quota               AS rem,
           GREATEST(0, (r.ward_votes + r.pr_votes) / v_quota - r.ward_seats_won) AS pr,
           GREATEST(0, r.ward_seats_won - (r.ward_votes + r.pr_votes) / v_quota) AS overhang,
           FALSE                                               AS got_this_pass
      FROM party_electoral_result r WHERE r.demarcation_version_id = p_version;

    v_final  := v_seats + (SELECT COALESCE(SUM(overhang), 0) FROM w);
    v_remain := v_final - (SELECT COALESCE(SUM(wards + pr), 0) FROM w) - (v_c + v_d);

    <<outer>>
    WHILE v_remain > 0 LOOP
        UPDATE w SET got_this_pass = FALSE;
        v_progress := FALSE;
        LOOP
            EXIT WHEN v_remain <= 0;
            SELECT MAX(rem) INTO v_rem FROM w WHERE NOT got_this_pass;
            EXIT WHEN v_rem IS NULL;
            SELECT COUNT(*) INTO v_group FROM w WHERE NOT got_this_pass AND rem = v_rem;
            IF v_group > v_remain THEN
                EXIT outer;               -- cannot award unambiguously: stop, never guess
            END IF;
            UPDATE w SET pr = pr + 1, got_this_pass = TRUE WHERE NOT got_this_pass AND rem = v_rem;
            v_remain := v_remain - v_group;
            v_progress := TRUE;
        END LOOP;
        EXIT WHEN NOT v_progress;
    END LOOP;

    RETURN QUERY
    SELECT w.pid, w.votes::INTEGER, w.wards, w.ent::INTEGER, w.rem::INTEGER, w.pr,
           w.wards + w.pr, v_quota, GREATEST(v_remain, 0)
      FROM w ORDER BY w.pid;
END;
$$ LANGUAGE plpgsql;
