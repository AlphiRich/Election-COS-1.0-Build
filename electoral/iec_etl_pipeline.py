#!/usr/bin/env python3
"""
IEC Results Ingestion & ETL Pipeline (LGE 2026).

Parses the Electoral Commission's published result exports (.csv; .xls/.xlsx; or an HTML table saved as .xls) and runs the
Schedule 1 seat allocation for each local municipality, writing one JSON baseline for the ECOS simulation, coalition and
forecasting models.

Adapted from the supplied `iec_etl_pipeline.py` with these changes, each forced by a fact about the data or the build:

  * REAL FORMAT. The Commission's "Downloadable Party Results" CSV (Province, Municipality, Ward, VotingDistrict,
    VotingStationName, RegisteredVoters, BallotType, SpoiltVotes, PartyName, TotalValidVotes, DateGenerated) has one row per
    party, ballot and voting district. The supplied wide-format reader (party / "pr votes" / "ward seats" columns) is kept
    as a fallback, but it cannot see this format and would have skipped every real file.
  * COUNCIL SIZES come from the proclaimed register (`election-cos-app/src/data/iec/circular-1-2025-annexure-a.json`), not a
    hard-coded table with "placeholder" sizes and a fallback of 50. A municipality that is not in the register is skipped
    and reported, never given an invented size.
  * THE ENGINE. The supplied script imports `Party` and `allocate_seats` from `electoral_generator`; that module defines
    neither (it is the NW405-only engine, with 34 ward seats fixed and no Item 16). The allocation is therefore done here
    (`allocate`), as Items 12, 13 and 16, and is checked against the Commission's own Seat Calculation Detail reports by
    `test_iec_etl_pipeline.py` (18 of 18 North West municipalities).
  * `int(pd.to_numeric(..., errors="coerce"))` raised on a blank cell before the `pd.notna` test could run; blanks are now
    refused with a message, as a blank is not a zero.
  * NO PANDAS. The environment that builds this has none; the standard library does the same work.
  * DISTRICT COUNCILS (DC37-DC40) are not allocated: they are Schedule 2 and this build does not implement it. Their 40%
    ballot is reported as votes.

Usage:  python3 -I electoral/iec_etl_pipeline.py --input DIR [--out 2026_verified_baseline.json]
"""
from __future__ import annotations

import argparse
import csv
import json
import logging
import sys
from html.parser import HTMLParser
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
HERE = Path(__file__).resolve().parent
REGISTER = HERE.parent / "election-cos-app" / "src" / "data" / "iec" / "circular-1-2025-annexure-a.json"
INDEPENDENT = "INDEPENDENT"
REAL_COLUMNS = {"Municipality", "Ward", "VotingDistrict", "RegisteredVoters", "BallotType", "SpoiltVotes", "PartyName", "TotalValidVotes"}


# ----------------------------------------------------------------------------------------------- reading
class _Table(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.rows: list[list[str]] = []
        self._row: list[str] | None = None
        self._cell: list[str] | None = None

    def handle_starttag(self, tag, attrs):
        if tag == "tr": self._row = []
        elif tag in ("td", "th") and self._row is not None: self._cell = []

    def handle_data(self, data):
        if self._cell is not None: self._cell.append(data)

    def handle_endtag(self, tag):
        if tag in ("td", "th") and self._cell is not None and self._row is not None:
            self._row.append(" ".join("".join(self._cell).split())); self._cell = None
        elif tag == "tr" and self._row is not None:
            if self._row: self.rows.append(self._row)
            self._row = None


def parse_iec_file(filepath: str | Path) -> list[dict]:
    """Rows as dicts. CSV, or an HTML table saved with an .xls extension. A true binary .xls/.xlsx needs xlrd/openpyxl."""
    p = Path(filepath)
    ext = p.suffix.lower()
    try:
        if ext == ".csv":
            with open(p, encoding="utf-8-sig", newline="") as f:
                return list(csv.DictReader(f))
        if ext in (".xls", ".xlsx"):
            head = p.read_bytes()[:512].lstrip().lower()
            if head.startswith((b"<", b"<!")):
                t = _Table(); t.feed(p.read_text(encoding="utf-8", errors="replace"))
                if len(t.rows) < 2: return []
                return [dict(zip(t.rows[0], r)) for r in t.rows[1:]]
            raise ValueError(f"{p.name} is a binary spreadsheet; export it as CSV (or install xlrd/openpyxl)")
        raise ValueError(f"Unsupported file extension: {ext}")
    except Exception as e:  # noqa: BLE001 - report and carry on with the other files
        logging.error("Failed to parse %s: %s", p, e)
        return []


def _whole(v: str, what: str) -> int:
    v = (v or "").strip().replace(",", "").replace(" ", "")
    if not v.lstrip("-").isdigit():
        raise ValueError(f"{what}: '{v}' is not a whole number (a blank is not a zero)")
    return int(v)


# ----------------------------------------------------------------------------------------------- statute
def allocate(total_valid: int, total_seats: int, parties: list[dict], independent_ward_seats: int = 0, no_list_ward_seats: int = 0) -> dict:
    """
    Schedule 1 Items 12, 13 and 16 (as in force since Act 3 of 2021).

      Q = floor(A / (B - C - D)) + 1                      Item 12 (D is the Commission's own term for no-list ward seats)
      entitlement = floor(votes / Q); surpluses by highest remainder, a tie going to the higher vote (Item 13(2)(b))
      list seats  = entitlement - ward seats won          Item 13(3)
      A party with MORE ward seats than its entitlement is "excessive": it takes no list seat and the others are
      recalculated on Q' = floor((A - B') / (C - (D' + E))) + 1, with B' its votes and D' its ward seats.

    Each party: {"name", "votes", "ward_seats"}. Returns the allocation, with `quota`, `new_quota` and per-party rows.
    """
    work = [dict(p, round1=0, bonus=0, remainder=0) for p in parties]

    def run(ps: list[dict], a: int, seats_for: int, q: int):
        for p in ps:
            p["round1"], p["remainder"] = divmod(p["votes"], q); p["bonus"] = 0
        left = seats_for - sum(p["round1"] for p in ps)
        if left < 0: raise ValueError("round 1 gave out more seats than exist")
        order = sorted(ps, key=lambda p: (-p["remainder"], -p["votes"]))
        # a tie on both remainder and votes for the last seat is not settled by order: refuse
        if 0 < left < len(order) and (order[left - 1]["remainder"], order[left - 1]["votes"]) == (order[left]["remainder"], order[left]["votes"]):
            raise ValueError("tie on remainder and votes for the last seat: needs a person")
        for p in order[:left]: p["bonus"] += 1

    denom = total_seats - independent_ward_seats - no_list_ward_seats
    if denom < 1: raise ValueError("no seats left for the quota")
    quota = total_valid // denom + 1
    run(work, total_valid, total_seats - independent_ward_seats - no_list_ward_seats, quota)
    new_quota = None
    excessive = [p for p in work if p["ward_seats"] > 0 and p["ward_seats"] > p["round1"] + p["bonus"]]
    if excessive:
        b = sum(p["votes"] for p in excessive); d = sum(p["ward_seats"] for p in excessive)
        den2 = total_seats - (d + independent_ward_seats)
        if den2 < 1: raise ValueError("the excessive parties hold every seat")
        new_quota = (total_valid - b) // den2 + 1
        others = [p for p in work if p not in excessive]
        run(others, total_valid - b, total_seats - d - independent_ward_seats, new_quota)
    out = []
    for p in work:
        total = p["round1"] + p["bonus"]
        ex = p in excessive
        out.append({"name": p["name"], "votes": p["votes"], "ward_seats": p["ward_seats"], "total_seats": p["ward_seats"] if ex else p["ward_seats"] + max(0, total - p["ward_seats"]), "list_seats": 0 if ex else max(0, total - p["ward_seats"]), "excessive": ex})
    return {"quota": quota, "new_quota": new_quota, "allocations": sorted(out, key=lambda r: (-r["total_seats"], -r["votes"], r["name"]))}


# ----------------------------------------------------------------------------------------------- processing
def load_register() -> dict:
    data = json.loads(REGISTER.read_text(encoding="utf-8"))
    return {m["code"]: m for m in data["municipalities"]}


def process_real_format(rows: list[dict], code: str, register: dict) -> dict | None:
    entry = register.get(code)
    if not entry or entry.get("category") == "C":
        logging.warning("Skipping %s: %s", code, "a district council (Schedule 2, not implemented)" if entry else "not in the proclaimed register")
        return None
    ballots: dict[str, dict[str, int]] = {"Ward": {}, "PR": {}, "DC 40%": {}}
    ward_votes: dict[str, dict[str, int]] = {}
    seen_vd: dict[tuple, int] = {}; spoilt_seen: dict[tuple, int] = {}
    on_pr: set[str] = set()
    for r in rows:
        b = r["BallotType"]
        if b not in ballots: raise ValueError(f"{code}: unknown ballot '{b}'")
        votes = _whole(r["TotalValidVotes"], "TotalValidVotes")
        vk = (r["Ward"], r["VotingDistrict"]); seen_vd[vk] = _whole(r["RegisteredVoters"], "RegisteredVoters")
        spoilt_seen[vk + (b,)] = _whole(r["SpoiltVotes"], "SpoiltVotes")
        ballots[b][r["PartyName"]] = ballots[b].get(r["PartyName"], 0) + votes
        if b == "PR": on_pr.add(r["PartyName"])
        if b == "Ward": ward_votes.setdefault(r["Ward"], {}); ward_votes[r["Ward"]][r["PartyName"]] = ward_votes[r["Ward"]].get(r["PartyName"], 0) + votes
    votes: dict[str, int] = {}
    for p, v in ballots["PR"].items(): votes[p] = votes.get(p, 0) + v
    for p, v in ballots["Ward"].items():
        if p != INDEPENDENT and p in on_pr: votes[p] = votes.get(p, 0) + v
    wins: dict[str, int] = {}; indep = 0; nolist = 0
    for w, pv in ward_votes.items():
        top = sorted(pv.items(), key=lambda kv: (-kv[1], kv[0]))
        if len(top) > 1 and top[0][1] == top[1][1]: raise ValueError(f"{code} {w}: tie for the ward needs a person")
        name = top[0][0]
        if name == INDEPENDENT: indep += 1
        elif name not in on_pr: nolist += 1
        else: wins[name] = wins.get(name, 0) + 1
    parties = [{"name": p, "votes": v, "ward_seats": wins.get(p, 0)} for p, v in votes.items() if v > 0 or wins.get(p, 0) > 0]
    a = sum(p["votes"] for p in parties)
    res = allocate(a, entry["councillors"], parties, indep, nolist)
    return {"municipality": code, "A": a, "B": entry["councillors"], "C": indep, "D": nolist, "wards": len(ward_votes),
            "registered": sum(seen_vd.values()), "valid": {"ward": sum(ballots["Ward"].values()), "pr": sum(ballots["PR"].values()), "dc40": sum(ballots["DC 40%"].values())},
            **res}


def process_wide_format(rows: list[dict], code: str, register: dict) -> dict | None:
    """The supplied reader's fallback: one row per party with a party column, 'pr votes'/'valid votes' and 'ward seats'."""
    entry = register.get(code)
    if not rows or not entry or entry.get("category") == "C": return None
    cols = {str(c).strip().lower(): c for c in rows[0]}
    party = next((c for k, c in cols.items() if "party" in k), None)
    pr = next((c for k, c in cols.items() if "pr votes" in k or "valid votes" in k), None)
    ws = next((c for k, c in cols.items() if "ward seats" in k or "wards won" in k), None)
    if not party or not pr:
        logging.warning("Skipping %s: could not identify required columns.", code); return None
    parties = []
    for r in rows:
        name = str(r[party]).strip()
        if name.lower() in ("total", "spoilt", "null", "nan", ""): continue
        v = _whole(str(r[pr]), f"{code} {name} votes")
        if v > 0: parties.append({"name": name, "votes": v, "ward_seats": _whole(str(r[ws]), f"{code} {name} ward seats") if ws else 0})
    if not parties: return None
    a = sum(p["votes"] for p in parties)
    return {"municipality": code, "A": a, "B": entry["councillors"], "C": 0, "D": 0, **allocate(a, entry["councillors"], parties)}


def process_municipality(rows: list[dict], muni_code: str, register: dict | None = None) -> dict | None:
    register = register or load_register()
    if rows and REAL_COLUMNS <= set(rows[0]): return process_real_format(rows, muni_code, register)
    return process_wide_format(rows, muni_code, register)


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[1])
    ap.add_argument("--input", default="."); ap.add_argument("--out", default="2026_verified_baseline.json")
    a = ap.parse_args(argv)
    files = sorted(list(Path(a.input).glob("*.xls")) + list(Path(a.input).glob("*.csv")))
    if not files: logging.error("No IEC files found in %s.", a.input); return 2
    register = load_register(); compiled: dict = {}
    for f in files:
        code = next((c for c in register if f.stem.upper().replace(" (1)", "").startswith(c)), None)
        if not code: logging.warning("Skipping %s: its name carries no municipal code in the register.", f.name); continue
        logging.info("Processing %s for %s...", f.name, code)
        rows = parse_iec_file(f)
        if rows:
            r = process_municipality(rows, code, register)
            if r: compiled[code] = r; logging.info("Processed %s", code)
    if not compiled: logging.error("Nothing was processed; no file written."); return 1
    Path(a.out).write_text(json.dumps({"source": "Electoral Commission of South Africa, LGE 2026", "municipalities": compiled}, indent=2), encoding="utf-8")
    logging.info("ETL complete: %d municipalities written to %s", len(compiled), a.out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
