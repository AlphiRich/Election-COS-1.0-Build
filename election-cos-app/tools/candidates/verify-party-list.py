#!/usr/bin/env python3
"""
Election Campaign OS — verify one party's candidate list in one municipality against the Commission's PDF.

What it does, in order (it stops at the first failure and says which):
  1. Fetches the Commission's published candidate-list PDF (URL and SHA-256 are the ones recorded in
     src/data/iec/candidates-lge2026-iec-nw-23102026.json) and refuses it if the bytes differ from the record.
  2. Reads the PDF's own text (pdftotext -layout) and independently parses every row for the party in the municipality.
  3. Compares the result, row for row, with the two copies the app holds: the IEC ingest and the reference file the
     candidate screens read. Differences are listed; none are silently fixed.
The masked ID column is used only to spot one person listed twice; no ID digits are printed or written.

  python3 -I tools/candidates/verify-party-list.py --muni NW405 --party ACTIONSA [--pdf nw.pdf]
Exit 0 only when the PDF hash matches and the parsed rows equal both app copies.
"""
import argparse, collections, hashlib, json, re, subprocess, sys, tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
IEC = ROOT / 'src/data/iec/candidates-lge2026-iec-nw-23102026.json'
REF = ROOT / 'src/data/reference/nw405-candidates.json'

def fetch(url: str, dest: Path) -> None:
    r = subprocess.run(['curl', '-sS', '-L', '--max-time', '120', '-o', str(dest), url.replace(' ', '%20')], capture_output=True, text=True)
    if r.returncode != 0:
        sys.exit(f'FETCH FAILED: {r.stderr.strip()}')

def parse(txt: str, muni: str, party: str):
    pat = re.compile(rf'^{muni} - .+?\s{{2,}}(.+?)\s{{2,}}(\d+)\s+(\d{{6}})\*{{4}}08\*\s+(.+?)\s{{2,}}(\S.*?)\s*$')
    rows = []
    for line in txt.splitlines():
        if not line.startswith(f'{muni} - '):
            continue
        m = pat.match(line)
        if not m or m.group(1).strip() != party:
            continue
        n = int(m.group(2))
        base = {'fullName': m.group(4).strip(), 'surname': m.group(5).strip(), 'dobKey': m.group(3)}
        # In the Commission's column "Ward \ List Order", a ward id is the 8-digit code (640xxxxx); a list rank is small.
        rows.append({**base, 'kind': 'WARD', 'ward': int(str(n)[-3:])} if n >= 10_000_000 else {**base, 'kind': 'PR', 'rank': n})
    return rows

def key(r):
    return (r['kind'], r.get('ward', r.get('rank')), r['fullName'], r['surname'])

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--muni', default='NW405'); ap.add_argument('--party', default='ACTIONSA'); ap.add_argument('--pdf')
    a = ap.parse_args()
    rec = json.loads(IEC.read_text())['provenance']
    tmp = Path(tempfile.mkdtemp())
    pdf = Path(a.pdf) if a.pdf else tmp / 'list.pdf'
    if not a.pdf:
        fetch(rec['url'], pdf)
    data = pdf.read_bytes()
    sha = hashlib.sha256(data).hexdigest()
    ok_hash = sha == rec['sha256']
    print(f"PDF {len(data):,} bytes  sha256 {sha[:16]}…  recorded {rec['sha256'][:16]}…  -> {'IDENTICAL' if ok_hash else 'DIFFERENT'}")
    if not ok_hash:
        sys.exit('The Commission’s file is not the one the app ingested. Re-ingest before trusting any comparison.')
    txt = subprocess.run(['pdftotext', '-layout', str(pdf), '-'], capture_output=True, text=True, check=True).stdout
    rows = parse(txt, a.muni, a.party)
    print(f"Independent parse: {len(rows)} rows for {a.party} in {a.muni}  ({sum(r['kind']=='WARD' for r in rows)} ward, {sum(r['kind']=='PR' for r in rows)} PR)")

    def norm(entries, kind_key):
        out = []
        for e in entries:
            if e.get('party') != a.party:
                continue
            out.append((e['kind'], e.get('ward', e.get('wardNumber', e.get('rank', e.get('listRank')))), e['fullName'], e['surname']))
        return out
    iec = [e for e in json.loads(IEC.read_text())['entries'] if e['municipalityCode'] == a.muni]
    ref = json.loads(REF.read_text())['entries'] if a.muni == 'NW405' else []
    mine = collections.Counter(key(r) for r in rows)
    status = 0
    for label, entries in (('IEC ingest (candidates-lge2026-iec-nw-23102026.json)', iec), ('Reference file (nw405-candidates.json)', ref)):
        if label.startswith('Reference') and a.muni != 'NW405':
            continue
        theirs = collections.Counter(norm(entries, None))
        only_pdf, only_app = mine - theirs, theirs - mine
        print(f"vs {label}: {sum(theirs.values())} rows; only in PDF {sum(only_pdf.values())}; only in app {sum(only_app.values())}")
        for k in list(only_pdf)[:10]: print('   PDF only:', k)
        for k in list(only_app)[:10]: print('   App only:', k)
        status |= bool(only_pdf or only_app)
    names = collections.defaultdict(list)
    for r in rows:
        names[(r['fullName'], r['surname'], r['dobKey'])].append(r.get('ward', f"PR{r.get('rank')}"))
    dup = {f"{k[0]} {k[1]}": v for k, v in names.items() if len(v) > 1}
    print('Listed more than once (same name and same ID prefix), as printed by the Commission:')
    for k, v in dup.items(): print('  ', k, '->', v)
    print('VERIFIED' if not status else 'MISMATCH')
    sys.exit(status)

main()
