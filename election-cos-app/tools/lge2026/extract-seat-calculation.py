#!/usr/bin/env python3
"""
Extract the Electoral Commission's own "Seat Calculation Detail" reports (LGE 2026, North West) into one JSON file,
so the build can reconcile its Schedule 1 engine against the Commission's published seat totals.

  python3 -I tools/lge2026/extract-seat-calculation.py --pdf-dir DIR --out src/data/lge2026/seat-calculation-iec.json
  python3 -I tools/lge2026/extract-seat-calculation.py --self-test

Needs `pdftotext` (poppler). Reads DIR/NWxxx.pdf for the 18 North West local municipalities. For each report it keeps the
header figures (Q, A, B, C, D) and, per printed party row, the party's total votes and total seats. Party NAMES are not
kept: they wrap across lines in the PDF, so a row is identified by its vote total, which the test then matches to the
build's own party totals. A report that does not close is refused: the party seats must add to B, and Q must equal
floor(A / (B - C - D)) + 1 as the report prints it. Nothing is written if any of the 18 fails.
"""
import argparse, hashlib, json, re, subprocess, sys
from pathlib import Path

CODES = ['NW371','NW372','NW373','NW374','NW375','NW381','NW382','NW383','NW384','NW385',
         'NW392','NW393','NW394','NW396','NW397','NW403','NW404','NW405']
NUM = r'[\d,]+'
DEC = r'(?:\d+\.\d{4}|0)'
ROW = re.compile(rf'({NUM})\s+{DEC}\s+(\d+)\s+{DEC}\s+(\d+)\s+(\d+)\s+(\d+)\s*$')
WARDROW = re.compile(r'(\d+)\s+(\d+)\s+(\d+)\s*$')
def n(s): return int(s.replace(',', ''))

def text_of(pdf, engine='pdftotext'):
    if engine == 'pymupdf':
        # The xpdf build of pdftotext (Git for Windows) interleaves these tables' columns; PyMuPDF word positions do not.
        # Words on one baseline form a line. Runs of spaces are collapsed so the labels below match.
        import pymupdf
        out = []
        with pymupdf.open(str(pdf)) as doc:
            for page in doc:
                rows = {}
                for x0, y0, x1, y1, w, *_ in page.get_text('words'):
                    rows.setdefault(round((y0 + y1) / 2), []).append((x0, w))
                out += [' '.join(w for _, w in sorted(rows[y])) for y in sorted(rows)]
        return '\n'.join(out) + '\n'
    # -enc UTF-8 and an explicit decode: Windows builds of poppler and Python default to Latin-1 / cp1252.
    return subprocess.run(['pdftotext', '-layout', '-enc', 'UTF-8', str(pdf), '-'], capture_output=True, check=True).stdout.decode('utf-8')

class NotPublished(Exception):
    """The Commission's report exists but says "No data available" (EC122 on 10 Nov 2026)."""


def parse(text, code):
    t = text.replace('\t', ' ')
    if not re.search(rf'Municipality:\s+{code}\b', t): raise ValueError(f'{code}: report is for another municipality')
    if 'No data available' in t: raise NotPublished(code)
    def grab(label):
        m = re.search(label + rf'\s*\n?\s*({NUM})\b', t)
        if not m: raise ValueError(f'{code}: cannot find {label}')
        return n(m.group(1))
    excessive = 'Excessive Party Valid Votes' in t
    q = grab(r'Quota - \(Q\)')
    a = grab(r'Total Valid Votes Cast for All Parties - \(A\)')
    if excessive:
        ex_votes = grab(r'Excessive Party Valid Votes - \(B\)')
        total = grab(r'Total Seats Available in Municipality - \(C\)')
        ex_seats = grab(r'Number of Seats Awarded to Party with Excessive Seats - \(D\)')
        indep = grab(r'Independent Ward Councillors Elected - \(E\)')
        nolist = grab(r'Ward Councillors Seats from Parties with no PR List - \(F\)')
        expected_q = (a - ex_votes) // (total - (ex_seats + indep + nolist)) + 1
    else:
        total = grab(r'Total Seats Available in Municipality - \(B\)')
        indep = grab(r'Independent Ward Councillors Elected - \(C\)')
        # An asterisk can sit before the figure (EC157: 13 wards won by a party that filed no PR list there).
        m = re.search(r'no PR List -\s*\n?\s*(?:\*\s*)?(\d+)', t)
        if not m: raise ValueError(f'{code}: cannot find D')
        nolist = n(m.group(1)); ex_votes = ex_seats = 0
        expected_q = a // (total - indep - nolist) + 1
    rows = []; ward_rows = []; in_second = False
    for line in t.splitlines():
        if 'PR List Seats' in line: in_second = True; continue
        if in_second:
            m = WARDROW.search(line)
            if m and int(m.group(1)) == int(m.group(2)) + int(m.group(3)): ward_rows.append({'seats': int(m.group(1)), 'wardSeats': int(m.group(2)), 'prSeats': int(m.group(3))})
            continue
        m = ROW.search(line)
        if m: rows.append({'votes': n(m.group(1)), 'round1': int(m.group(2)), 'round2': int(m.group(4)), 'seats': int(m.group(5))})
    if sum(r['votes'] for r in rows) != a: raise ValueError(f'{code}: party votes {sum(r["votes"] for r in rows)} do not add to A {a}')
    if q != expected_q: raise ValueError(f'{code}: Q {q} != recomputed {expected_q}')
    party_seats = sum(r['seats'] for r in rows)
    unallocated = total - (party_seats + indep + nolist)
    # One shape of short report is recorded rather than refused: Round 2 (the remainder seats) is zero for every party, so
    # the report allocates fewer seats than the council has (EC157 on 8 Nov 2026: 51 + 13 of 73). Any other shortfall is
    # an extraction error.
    incomplete = unallocated > 0 and all(r['round2'] == 0 for r in rows)
    if unallocated != 0 and not incomplete:
        raise ValueError(f'{code}: party seats {party_seats} + independents {indep} + no-list {nolist} != {total}')
    if len(ward_rows) < len(rows) or [w['seats'] for w in ward_rows[:len(rows)]] != [r['seats'] for r in rows]:
        raise ValueError(f'{code}: the ward-seat table ({len(ward_rows)} rows) does not follow the seat table ({len(rows)} rows)')
    for r, w in zip(rows, ward_rows): r['wardSeats'] = w['wardSeats']; r['prSeats'] = w['prSeats']
    return {'code': code, 'excessiveCase': excessive, 'Q': q, 'A': a, 'totalSeats': total, 'independentWardSeats': indep, 'noPrListWardSeats': nolist,
            'excessiveVotes': ex_votes, 'excessiveSeats': ex_seats, 'rows': rows, 'partySeatsTotal': party_seats,
            # "(PF) Potential Forfeiture - this party has fewer candidates than the seats allocated."
            'potentialForfeiture': '(PF) Potential Forfeiture' in t,
            **({'incomplete': True, 'unallocatedSeats': unallocated} if incomplete else {})}

def self_test():
    sample = """Quota - (Q)                                                            2,069         Formula
Total Valid Votes Cast for All Parties - (A)                       138,568
Total Seats Available in Municipality - (B)                              67
Independent Ward Councillors Elected - (C)                                 0
Ward Councillors Seats from Parties with no PR List -
                                                                           0
(D)
ACTIONSA (PF)                       138,568         5.2774          5       0.2774               8            0           67
Municipality:               NW405 - JB Marks
 PR List Seats
ACTIONSA (PF)   67   34   33"""
    r = parse(sample, 'NW405')
    assert (r['Q'], r['A'], r['totalSeats'], r['independentWardSeats'], r['noPrListWardSeats']) == (2069, 138568, 67, 0, 0) and r['rows'][0]['seats'] == 67 and r['rows'][0]['wardSeats'] == 34
    try: parse(sample.replace('2,069', '2,070'), 'NW405'); raise SystemExit('self-test: a wrong Q was accepted')
    except ValueError: pass
    print('self-test ok')

if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--pdf-dir'); ap.add_argument('--out'); ap.add_argument('--self-test', action='store_true')
    ap.add_argument('--engine', choices=['pdftotext', 'pymupdf'], default='pdftotext',
                    help='pdftotext needs poppler; use pymupdf where only the xpdf build is installed (Git for Windows)')
    ap.add_argument('--all', action='store_true', help='every <CODE>.pdf in --pdf-dir (the whole country), not only the 18 North West councils')
    a = ap.parse_args()
    if a.self_test: self_test(); sys.exit(0)
    codes = sorted(p.stem for p in Path(a.pdf_dir).glob('*.pdf')) if a.all else CODES
    scope = 'all provinces' if a.all else 'North West'
    out = {'source': f'Electoral Commission of South Africa, Seat Calculation Detail, Local Government Elections 2026 (EEID1887), {scope}',
           'urlPattern': 'https://results.elections.org.za/home/LGEPublicReports/1887/Seat%20Calculation%20Detail/' + ('<PROV>' if a.all else 'NW') + '/<CODE>.pdf',
           'municipalities': {}, 'files': {}, 'notPublished': []}
    failures = []
    for code in codes:
        p = Path(a.pdf_dir) / f'{code}.pdf'
        try:
            out['municipalities'][code] = parse(text_of(p, a.engine), code)
        except NotPublished:
            out['notPublished'].append(code)
        except ValueError as e:
            failures.append(str(e)); continue
        out['files'][code] = {'sha256': hashlib.sha256(p.read_bytes()).hexdigest(), 'bytes': p.stat().st_size}
    if failures:
        print(f'FAILED, nothing written ({len(failures)} of {len(codes)} reports do not close):')
        for f in failures: print('  -', f)
        sys.exit(1)
    Path(a.out).write_text(json.dumps(out, indent=1))
    print(f'wrote {a.out}: {len(codes)} reports, all close')
