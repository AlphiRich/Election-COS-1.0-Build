# Post-election strategy: "Who governs my council?" — Nov 2026

The elections are over and parties will not pay for campaign tenancy now.
The question every party and voter in South Africa is asking this month is
**who will run my council, and who is my councillor?** This plan turns what
has been built into the best answer to that question, earns from it without
selling anyone's personal information, and grows it into a ward-management
and active-citizen tool before the 2029 national and provincial elections.

## 1. What we already have (verified 10 Nov)

| Asset | State |
|---|---|
| Certified 2026 results | North West only: 18 locals, 4 districts, every ward and voting district, from the IEC's public CSVs (hash-recorded in `src/data/lge2026/manifest.json`) |
| Seat allocation | Schedule 1 engine (`seatCalculator.ts`) reproduces the IEC's seat-calculation reports exactly; Item 16 overhang handled |
| Hung councils | **11 of 18 North West councils have no majority** (largest party ≤ half the seats): Madibeng, Rustenburg, Kgetlengrivier, Mafikeng, Ditsobotla, Ramotshere Moiloa, Naledi, Mamusa, Lekwa-Teemane, Matlosana, JB Marks |
| Ward councillors-elect | Derivable now: the ward winner's party + ward number matches **exactly one** certified candidate in all **402** North West wards (0 missing, 0 ambiguous) |
| Candidate lists | Certified lists for all 9 provinces on the PC (PDF); the extractor (`tools/candidates/`) has run on NW (10,018 entries, ward + PR, dual nominations flagged) |
| National files | The IEC's per-municipality result CSVs for other provinces are public in the same format (verified: JHB, TSH, BUF, CPT under `WP`) |
| Delimitation | 2026: **258 municipalities = 8 metros + 206 locals + 44 districts**; 4,488 wards; 8,831 council seats; 27.7 m registered voters (`docs/national-delimitation-baseline.md`) |
| Tools | Coalition tool and seat model on the public site (NW only); party profiles; council finder; Master Hub; PWA app with offline support |
| Ads | AdSense code built, consent-first, non-personalised by default. **Only 5 explainer pages may show ads; results, coalition and ward pages show none.** Publisher id not yet set |

The number of hung councils nationally is not known until the other eight
provinces are loaded. The North West rate (61 %) suggests it is well over
100 of the 214 councils with wards. The dashboard will state the real figure.

## 2. The product

One data platform, three surfaces, all reading the same certified dataset.

### A. Public website — free, ad-supported, no sign-in

1. **Coalition Tracker (national).** Every one of the 214 councils with
   wards (and the 44 district councils), marked majority / hung, with seats
   needed to govern, the kingmaker parties, and every minimum winning
   coalition. Filter by province, party, and "hung by fewer than 3 seats".
   Updated as councils elect speakers and mayors.
2. **Council page.** Seat chart, the full council (ward councillors by ward,
   PR councillors by party), turnout, 2021 → 2026 swing, and the coalition
   simulator pre-loaded with that council.
3. **My ward.** Find by address, voting station or ward number → the ward
   councillor-elect (name, party), margin, turnout, every party's share, the
   voting districts, and the council the ward belongs to.
4. **Party pages.** Seats won nationally and per council, councils where
   the party is a kingmaker, its councillors-elect.
5. **Explainers** (existing): how seats are allocated, how a coalition
   elects a mayor, what happens at the first council sitting.

**No results page sends anyone to the IEC.** We show the data and cite it
("Source: Electoral Commission public report, generated 7 Nov 2026 13:13,
SHA-256 …"): attribution, not navigation. Links to the IEC stay only where
the IEC must do the job itself, such as checking someone's registration
with their ID number, which we must not process.

### B. The app (installable PWA)

The same content offline, plus a saved "my ward / my council", alerts when
a council in the tracker changes (mayor elected, coalition announced), and
the simulator saving scenarios. "Download the app" = install the PWA today;
a Google Play listing via a Trusted Web Activity is a few days' work; the
Apple App Store is a later, larger job.

### C. Signed-in workspace (the current app)

Kept, not deleted: campaign features stay for by-elections, which run all
term. New paid modules for parties and analysts are listed in §4.

## 3. Data rules that keep it credible

- **Certified first.** Every number comes from an IEC file whose hash is
  recorded. Every derived value says so: the council composition is
  *calculated by Schedule 1 from certified votes*, and is reconciled against
  the IEC's own seat-calculation report for that council before it shows
  green.
- **Councillors-elect.** Ward councillors: derived by matching (municipality,
  ward, winning party) to the certified ward list, reported as "elected" only
  where the match is unique. PR councillors: taken from each party's
  certified list in rank order, skipping candidates elected in a ward (the
  dual nominations are already flagged). Shown as "PR councillors-elect
  (derived from list order)" until the IEC's elected-councillor lists are
  published, then matched and marked confirmed.
- **Losing candidates.** Removed from public pages; kept in the dataset
  (history, by-elections, research). Nothing is deleted.
- **Councillors are public office-bearers.** Publishing an elected
  councillor's name, party and ward is publication of a public role from a
  public certified list. No ID numbers, ever (the extractor already drops them).

## 4. Revenue — earn without trading in personal information

| Stream | When | How | POPIA position |
|---|---|---|---|
| **AdSense on the high-traffic pages** | This week | Extend the ad allowlist from 5 explainer pages to the Coalition Tracker, council, ward and party pages. Keep `/`, `/compliance`, `/packages`, `/contact` ad-free | Non-personalised until consent; personalised only after opt-in (existing banner). No voter data involved |
| **Direct sponsorship** | 2–3 weeks | "Coalition Tracker presented by …" for a non-political sponsor (bank, telco, insurer, media house). Usually worth far more than network ads for a high-attention national moment | None — a brand placement |
| **Party and analyst scenario packs** | Now, while coalition talks run | Per council: full council roster export, every winning coalition with seat arithmetic, ward-by-ward swing, kingmaker analysis, first-sitting timeline. One-off price per council or per province. Then a **by-election module** (by-elections run all term) | Aggregated public results only |
| **Media licensing** | 2–4 weeks | Embeddable coalition widget and a results/coalition data API for newsrooms, with attribution | Aggregated public results |
| **Research reports** | Ongoing | Province and metro coalition reports (the JB Marks R&D report is the template) | Aggregated |
| **Councillor workspace** | 2027 | Ward-management subscription (§5), paid by the councillor's party or municipality | Constituent records under the councillor's lawful purpose, consent-gated |
| **Service-delivery index** | 2027–2029 | Sponsored, published ward and council scorecards from citizen reports | Published only as de-identified aggregates |

### Where the POPIA line sits

POPIA does let us analyse and sell insight, within limits, and the plan
uses those limits:

- **De-identified, aggregated data is outside POPIA** (section 6(1)(b)
  excludes information that has been de-identified to the point that it
  cannot be re-identified). Ward results, poll aggregates with small groups
  suppressed, and service-delivery scores are all this kind of data.
- **A person's political opinion is special personal information**
  (section 26). Processing it about an identifiable person needs their
  explicit consent or another section 27 ground. So: **no individual
  political profiles and no ad targeting of individuals by political view.**
  This is why the 7 Nov "citizen public square + ad-serving by issue
  preference" pivot documents are held, not merged.
- **Direct marketing by electronic message is opt-in** (section 69).
- Opt-in polls are fine when collected under explicit consent and only
  published as aggregates. The Desktop `voter_sentiment_engine.py`
  (consent column, small-group suppression) is built for exactly this.

Keep blocking political, election and advocacy ad categories on the network
(`REQUIRED_BLOCKED_CATEGORIES`). A results site seen to carry one side's
adverts loses the neutrality that makes it trusted, and trust is the product.

## 5. Growing into a ward-management tool (to 2029)

| Horizon | Citizens | Councillors |
|---|---|---|
| Nov–Dec 2026 | Who is my councillor; who runs my council; mayor and coalition tracker | Profile claimed and verified |
| 2027 | Report a service-delivery issue for my ward (water, electricity, roads, refuse), see it counted; ward committee meetings | Casework inbox, ward committee minutes, report-back publishing |
| 2028 | Ward and council scorecards: issues reported, resolved, time to resolve; IDP and budget commitments tracked | Performance dashboard; by-election readiness |
| 2029 | The record of each council's term, ahead of the national and provincial elections | Campaign workspace (the existing build) reactivated |

The existing casework tracker, field diary, incidents and polls modules are
the starting points; nothing needs to be thrown away.

## 6. Build plan — starting now

Councils must hold their first sitting soon after the results are declared
(the Municipal Structures Act sets the window, s 29). That is when speakers,
mayors and coalitions are decided, and when attention peaks.

| # | Work | Days | Notes |
|---|---|---|---|
| 0 | Merge `chore/consolidate`; revoke the exposed keys and token | 0.5 | From the Desktop review |
| 1 | **National results ingest.** Fetch all 214 local/metro councils and the 44 district councils from the IEC public CSVs (correct province codes, e.g. `WP` for the Western Cape); hash-record; run Schedule 1; reconcile every council against the IEC seat-calculation report | 2 | Extends the NW pipeline; a council that doesn't reconcile is flagged, never shown green |
| 2 | **National candidate lists.** Run the extractor on the 8 other provincial PDFs; derive ward councillors-elect and PR councillors; report match rates per council | 2 | NW: 402 / 402 unique |
| 3 | **Coalition Tracker + council pages + My ward** on the public site, all 9 provinces | 3 | Re-uses the coalition tool, seat model, council finder |
| 4 | **Ads on the new pages**; set the publisher id and the blocked categories; sponsorship slot | 0.5 | Needs the owner's AdSense account settings |
| 5 | **Remove outbound IEC links** from results pages; source citation instead | 0.5 | Keep links only for IEC self-service |
| 6 | **App**: install prompt, saved ward/council, tracker alerts | 2 | PWA already offline-capable |
| 7 | **Scenario pack** (PDF + CSV per council) and a price on `/packages` | 2 | Paid; aggregated public data |
| 8 | Mayor / speaker tracker, updated as councils sit | ongoing | Each entry sourced (council minutes, municipal notices, reputable media) and dated |

Roughly two weeks of focused work for items 0–7, with the tracker live in
about a week if items 1–3 go first.

## 7. Decisions needed from the owner

1. **Go on items 0–3** (national data and the tracker) now?
2. **Ads on results pages**: approve extending the allowlist, and set the
   AdSense publisher id and blocked categories.
3. **The 7 Nov citizen/ad-targeting pivot**: recommend not building
   individual political targeting (POPIA s 26). Contextual ads and
   aggregated insight earn without it.
4. **Price** for the per-council scenario pack and the media API.
5. **Neutrality**: keep political ad categories blocked (recommended).
