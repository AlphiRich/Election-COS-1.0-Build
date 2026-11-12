"""Tests for iec_etl_pipeline.py (standard library only: `python3 -I -m unittest discover -s electoral`).

The reconciliation against the Commission's own Seat Calculation Detail reports needs the 18 downloaded result CSVs, which
are not committed (re-fetch them: see tools/source-acquisition/sources.json). Point ECOS_LGE2026_RAW at the folder to run it.
"""
import csv, json, os, sys, tempfile, unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import iec_etl_pipeline as etl  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
IEC = json.loads((ROOT / "election-cos-app" / "src" / "data" / "lge2026" / "seat-calculation-iec.json").read_text())["municipalities"]
RAW = os.environ.get("ECOS_LGE2026_RAW")


def write_csv(path, rows):
    cols = ["Province", "Municipality", "Ward", "VotingDistrict", "VotingStationName", "RegisteredVoters", "BallotType", "SpoiltVotes", "PartyName", "TotalValidVotes", "DateGenerated"]
    with open(path, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f); w.writerow(cols)
        for r in rows: w.writerow(r)


class Allocation(unittest.TestCase):
    def test_item_12_and_13_on_the_nw405_2021_fixture(self):
        # Q = 101439 // 67 + 1 = 1515; the published 2021 seats (ANC 33, DA 17, FF+ 9, EFF 6, PA 2).
        parties = [dict(name=n, votes=v, ward_seats=0) for n, v in [("ABC", 340), ("ANC", 48911), ("ATM", 330), ("BLF", 428), ("DA", 25837), ("EFF", 9200), ("F4SD", 204), ("PA", 2389), ("VFP", 13800)]]
        r = etl.allocate(101439, 67, parties)
        self.assertEqual(r["quota"], 1515)
        self.assertEqual({p["name"]: p["total_seats"] for p in r["allocations"] if p["total_seats"]}, {"ANC": 33, "DA": 17, "VFP": 9, "EFF": 6, "PA": 2})

    def test_equality_of_ward_seats_and_entitlement_is_not_excess(self):
        parties = [dict(name="A", votes=700, ward_seats=7), dict(name="B", votes=300, ward_seats=0)]
        r = etl.allocate(1000, 10, parties)
        self.assertIsNone(r["new_quota"])
        self.assertFalse(r["allocations"][0]["excessive"])

    def test_more_ward_seats_than_entitlement_recalculates(self):
        parties = [dict(name="A", votes=600, ward_seats=9), dict(name="B", votes=400, ward_seats=0)]
        r = etl.allocate(1000, 10, parties)
        self.assertIsNotNone(r["new_quota"])
        self.assertTrue(r["allocations"][0]["excessive"])
        self.assertEqual(sum(p["total_seats"] for p in r["allocations"]), 10)

    def test_a_tie_for_the_last_seat_is_refused_not_guessed(self):
        with self.assertRaises(ValueError):
            etl.allocate(100, 3, [dict(name="A", votes=50, ward_seats=0), dict(name="B", votes=50, ward_seats=0)])


class Reading(unittest.TestCase):
    def test_a_blank_cell_is_refused_not_read_as_zero(self):
        with self.assertRaises(ValueError): etl._whole("", "votes")
        self.assertEqual(etl._whole("1,234", "votes"), 1234)

    def test_an_unknown_municipality_is_skipped_not_given_an_invented_size(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "ZZ999.csv"
            write_csv(p, [["X", "ZZ999 - Nowhere", "Ward 1", "1", "S", "10", "PR", "0", "P", "5", "x"]])
            self.assertIsNone(etl.process_municipality(etl.parse_iec_file(p), "ZZ999"))

    def test_a_district_council_is_skipped_as_schedule_2(self):
        self.assertIsNone(etl.process_municipality([{"Party": "A", "Valid votes": "5"}], "DC40"))

    def test_an_html_table_saved_as_xls_is_read(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "t.xls"; p.write_text("<table><tr><th>Party</th><th>PR Votes</th></tr><tr><td>A</td><td>5</td></tr></table>")
            self.assertEqual(etl.parse_iec_file(p), [{"Party": "A", "PR Votes": "5"}])

    def test_the_supplied_wide_format_still_reads(self):
        rows = [{"Party": "ANC", "PR Votes": "700", "Ward Seats": "0"}, {"Party": "DA", "PR Votes": "300", "Ward Seats": "0"}, {"Party": "Total", "PR Votes": "1000", "Ward Seats": ""}]
        r = etl.process_municipality(rows, "NW405")
        self.assertEqual(r["A"], 1000)
        self.assertEqual(r["B"], 67)


@unittest.skipUnless(RAW, "set ECOS_LGE2026_RAW to the folder of the 18 downloaded result CSVs")
class AgainstTheCommission(unittest.TestCase):
    def test_all_18_reproduce_the_commissions_seat_calculation(self):
        register = etl.load_register()
        for code, iec in IEC.items():
            res = etl.process_municipality(etl.parse_iec_file(Path(RAW) / f"{code}.csv"), code, register)
            with self.subTest(code=code):
                self.assertEqual(res["B"], iec["totalSeats"]); self.assertEqual(res["C"], iec["independentWardSeats"]); self.assertEqual(res["D"], iec["noPrListWardSeats"])
                if iec["excessiveCase"]: self.assertEqual(res["new_quota"], iec["Q"])
                else: self.assertEqual((res["A"], res["quota"]), (iec["A"], iec["Q"]))
                for r in (x for x in iec["rows"] if x["seats"]):
                    mine = [p for p in res["allocations"] if p["votes"] == r["votes"] and p["total_seats"] == r["seats"]]
                    self.assertTrue(mine, f"{code}: a party with {r['votes']} votes should hold {r['seats']} seats")
                    self.assertEqual(mine[0]["ward_seats"], r["wardSeats"])


if __name__ == "__main__":
    unittest.main()
