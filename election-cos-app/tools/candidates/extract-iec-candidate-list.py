#!/usr/bin/env python3
"""
Election Campaign OS — extract the Electoral Commission's certified
candidate list (one province's PDF) into JSON.

    python3 extract-iec-candidate-list.py --self-test
    python3 extract-iec-candidate-list.py --pdf "Supplementary list NW 23102026.pdf" \
        --province NW --url URL --fetched-on 2026-11-01 --out candidates-nw.json

Needs `pdftotext` (poppler). Standard library otherwise.

WHAT IT DOES, IN THE ORDER IT DOES IT
 1. Records the PDF's SHA-256 and size.
 2. Reads every line that opens with a municipality code. A line that opens
    with one and does not parse is an ERROR, not a skip: this is how a
    "complete" extraction quietly becomes a short one.
 3. Checks every municipality against the proclaimed delimitation
    (Annexure A, src/data/iec/circular-1-2025-annexure-a.json): the code
    exists, the name matches, and a district council has no ward rows.
 4. Checks the PDF's own structure, which is what makes it trustworthy:
      - a ward candidate's "Ward \\ List Order" is an 8-digit ward id of the
        form 6 + district (2) + 0 + local (1) + ward (3), and the ward number
        is between 1 and the municipality's wards in the delimitation;
      - each party's PR list runs 1..n with no gaps and no repeats;
      - a party has at most one candidate in a ward (the label INDEPENDENT is
        not a party, and several independents may stand in one ward);
      - nobody appears twice in the same place.
 5. DROPS THE ID COLUMN. Every value opens with a full date of birth
    (YYMMDD****08*), which this project refuses to hold
    (docs/nw-candidate-list-2026-review.md §5, src/lib/saIdNumber.ts).
 6. Writes nothing if any check fails; the failures are listed.

It confirms nothing about who a person is. A named human confirms a
dataset, after comparing it with the Commission's own page.
"""
import argparse, hashlib, json, os, re, subprocess, sys, tempfile
from collections import Counter, defaultdict

ROW = re.compile(
    r'^([A-Z]{2,3}\d*) - (.+?)\s{2,}(.+?)\s{2,}(\d+)\s+(\d{6}\*{4}\d{2}\*)\s+(.+?)\s{2,}(.+?)\s*$'
)
OPENS = re.compile(r'^[A-Z]{2,3}\d* - ')
HERE = os.path.dirname(os.path.abspath(__file__))
REGISTER = os.path.join(HERE, '..', '..', 'src', 'data', 'iec', 'circular-1-2025-annexure-a.json')


def load_register():
    with open(REGISTER, encoding='utf-8') as f:
        return {m['code']: m for m in json.load(f)['municipalities']}


# The first digit of a ward id is the province. Seen in the Commission's own
# files: NW starts 6 (64005001 = JB Marks ward 1), EC starts 2 (21001003). The
# other seven provinces have not been read here, so their layout is reported
# as unverified rather than assumed.
PROVINCE_DIGIT = {'NW': '6', 'EC': '2'}


def ward_prefix(code, province):
    """NW405 -> 64005: province digit + district (2) + '0' + local digit(s)."""
    m = re.match(r'^[A-Z]{2}(\d{2})(\d+)$', code)
    d = PROVINCE_DIGIT.get(province)
    return f'{d}{m.group(1)}0{m.group(2)}' if (m and d) else None


def parse_lines(text):
    rows, errors = [], []
    for n, line in enumerate(text.splitlines(), 1):
        if not OPENS.match(line):
            continue
        m = ROW.match(line)
        if not m:
            errors.append(f'line {n}: opens with a municipality code but does not parse: {line.strip()[:120]}')
            continue
        code, mname, party, order, idmask, full, sur = m.groups()
        rows.append(dict(code=code, mname=mname.strip(), party=party.strip(), order=order,
                         fullName=' '.join(full.split()), surname=' '.join(sur.split()), _id=idmask))
    return rows, errors


def check_and_build(rows, register, province='NW'):
    errors, entries = [], []
    unverified_layout = set()
    masks = []
    seen = set()
    by_party = defaultdict(list)
    ward_slot = {}
    for r in rows:
        reg = register.get(r['code'])
        if not reg:
            errors.append(f"{r['code']} is not in the delimitation register"); continue
        if reg['name'].lower() != r['mname'].lower():
            errors.append(f"{r['code']} is '{reg['name']}' in the delimitation, '{r['mname']}' in the list"); continue
        is_ward = len(r['order']) == 8
        e = dict(municipalityCode=r['code'], party=r['party'], fullName=r['fullName'], surname=r['surname'])
        e_mask = r['_id']
        if is_ward:
            if not reg.get('wards'):
                errors.append(f"{r['code']} has no wards but the list has a ward row for {r['party']}"); continue
            pre = ward_prefix(r['code'], province)
            if pre is None:
                # Metros (BUF, NMA...) use a code with no district digits, so the
                # ward-id layout cannot be checked here. The ward number is still
                # range-checked below, and the municipality is reported.
                unverified_layout.add(r['code'])
            elif not r['order'].startswith(pre):
                errors.append(f"{r['code']}: ward id {r['order']} does not start with {pre}"); continue
            w = int(r['order'][-3:])
            if not (1 <= w <= reg['wards']):
                errors.append(f"{r['code']}: ward {w} outside 1..{reg['wards']}"); continue
            e.update(kind='WARD', wardNumber=w)
            # "INDEPENDENT" is not a party: any number of independents may stand
            # in one ward. A real party fields at most one candidate per ward.
            if r['party'] != 'INDEPENDENT':
                slot = (r['code'], r['party'], w)
                if slot in ward_slot:
                    errors.append(f"{r['code']} {r['party']} has two candidates in ward {w}")
                ward_slot[slot] = True
        else:
            rank = int(r['order'])
            e.update(kind='PR', listRank=rank)
            by_party[(r['code'], r['party'])].append(rank)
        key = (e['municipalityCode'], e['party'], e['kind'], e.get('wardNumber', e.get('listRank')), e['fullName'], e['surname'])
        if key in seen:
            errors.append(f'exact repeat: {key}'); continue
        seen.add(key)
        entries.append(e)
        masks.append(e_mask)
    for (code, party), ranks in by_party.items():
        if sorted(ranks) != list(range(1, len(ranks) + 1)):
            errors.append(f'{code} {party}: PR list is not 1..{len(ranks)} without gaps or repeats')
    check_and_build.unverified_layout = sorted(unverified_layout)
    check_and_build.masks = masks
    return entries, errors


def build(pdf, province, url=None, fetched_on=None):
    with open(pdf, 'rb') as f:
        raw = f.read()
    if raw[:5] != b'%PDF-':
        return None, ['Not a PDF: the first bytes are not %PDF-.']
    sha = hashlib.sha256(raw).hexdigest()
    with tempfile.NamedTemporaryFile(suffix='.txt', delete=False) as t:
        out = t.name
    subprocess.run(['pdftotext', '-layout', pdf, out], check=True)
    text = open(out, encoding='utf-8').read(); os.unlink(out)
    title = ''
    try:
        info = subprocess.run(['pdfinfo', pdf], capture_output=True, text=True).stdout
        title = next((l.split(':', 1)[1].strip() for l in info.splitlines() if l.startswith('Title')), '')
    except OSError:
        pass
    head = ' '.join(text[:1500].split())
    rows, errors = parse_lines(text)
    register = load_register()
    entries, more = check_and_build(rows, register, province)
    errors += more
    if not rows:
        errors.append('No candidate rows found.')
    if errors:
        return None, errors
    # Dual nominations as the Commission's own list shows them.
    # A person is the same person only if name AND the partial ID mask agree. The
    # mask is compared in memory and never written: names alone are not enough
    # (the same name stands in five wards for one party in this very list).
    masks = check_and_build.masks
    ward_by = {(e['municipalityCode'], e['party'], e['fullName'], e['surname'], m): e
               for e, m in zip(entries, masks) if e['kind'] == 'WARD'}
    dual = []
    for e, m in zip(entries, masks):
        if e['kind'] != 'PR':
            continue
        w = ward_by.get((e['municipalityCode'], e['party'], e['fullName'], e['surname'], m))
        if w:
            dual.append(dict(name=f"{e['fullName']} {e['surname']}", municipalityCode=e['municipalityCode'],
                             party=e['party'], ward=w['wardNumber'], rank=e['listRank']))
    counts = Counter((e['municipalityCode'], e['kind']) for e in entries)
    doc = {
        'provenance': {
            'source': 'Electoral Commission of South Africa, published on its website',
            'url': url, 'fetchedOn': fetched_on, 'fetchedBy': 'this build, directly from the Commission',
            'sha256': sha, 'bytes': len(raw), 'pdfTitle': title,
            'headline': head[:400],
            'province': province,
            'status': 'UNCONFIRMED', 'confirmedBy': None, 'confirmedOn': None,
            'idColumn': 'Read for structure only and not copied: every value opens with a date of birth.',
        },
        'counts': {f'{c}/{k}': n for (c, k), n in sorted(counts.items())},
        'totalEntries': len(entries),
        'wardIdLayoutNotVerifiedFor': check_and_build.unverified_layout,
        'dualNominated': dual,
        'entries': entries,
    }
    return doc, []


def self_test():
    reg = {'NW405': {'name': 'JB Marks', 'wards': 34}, 'DC40': {'name': 'Dr Kenneth Kaunda', 'wards': None}}
    good = ('NW405 - JB Marks     PARTY A            1 800101****08*   TESTA   ONE\n'
            'NW405 - JB Marks     PARTY A            2 800102****08*   TESTB   TWO\n'
            'NW405 - JB Marks     PARTY A     64005003 800103****08*   TESTC   THREE\n')
    rows, e = parse_lines(good); assert not e and len(rows) == 3, (rows, e)
    ents, errs = check_and_build(rows, reg, 'NW'); assert not errs and len(ents) == 3, errs
    bad = [
        ('NW405 - JB Marks     PARTY A     64005035 800101****08*   T   O\n', 'outside 1..34'),
        ('NW405 - JB Marks     PARTY A     63705003 800101****08*   T   O\n', 'does not start with'),
        ('NW405 - JB Marks     PARTY A            1 800101****08*   T   O\nNW405 - JB Marks     PARTY A            3 800101****08*   U   P\n', 'without gaps'),
        ('DC40 - Dr Kenneth Kaunda     PARTY A     64005003 800101****08*   T   O\n', 'has no wards'),
        ('NW405 - Somewhere     PARTY A            1 800101****08*   T   O\n', "in the list"),
        ('NW405 - JB Marks     PARTY A     64005003 800101****08*   T   O\nNW405 - JB Marks     PARTY A     64005003 800102****08*   U   P\n', 'two candidates in ward 3'),
        ('NW405 - JB Marks     PARTY A            1 80****   T   O\n', 'does not parse'),
    ]
    for text, needle in bad:
        rows, e = parse_lines(text)
        if not e:
            _, e = check_and_build(rows, reg, 'NW')
        assert any(needle in x for x in e), (needle, e)
    two_indep = ('NW405 - JB Marks     INDEPENDENT     64005003 800101****08*   T   O\n'
                 'NW405 - JB Marks     INDEPENDENT     64005003 800102****08*   U   P\n')
    rows, e = parse_lines(two_indep); ents, errs = check_and_build(rows, reg)
    assert not errs and len(ents) == 2, errs
    print('self-test: ok (good rows pass; seven defect classes each rejected; two independents in one ward allowed)')


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--self-test', action='store_true')
    ap.add_argument('--pdf'); ap.add_argument('--province'); ap.add_argument('--url')
    ap.add_argument('--fetched-on'); ap.add_argument('--out')
    a = ap.parse_args()
    if a.self_test:
        self_test(); sys.exit(0)
    if not (a.pdf and a.province and a.out):
        ap.error('--pdf, --province and --out are required'); 
    doc, errors = build(a.pdf, a.province, a.url, a.fetched_on)
    if errors:
        print(f'FAILED, nothing written ({len(errors)} problems):')
        for x in errors[:40]: print('  -', x)
        sys.exit(1)
    with open(a.out, 'w', encoding='utf-8') as f:
        json.dump(doc, f, ensure_ascii=False, indent=1); f.write('\n')
    print(f"wrote {a.out}: {doc['totalEntries']} candidates; sha256 {doc['provenance']['sha256'][:16]}…; dual-nominated {len(doc['dualNominated'])}")
