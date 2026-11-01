/**
 * Election Campaign OS — publish confirmed candidates to the public site
 *
 * @deployable fails-closed
 *
 * Writes `<out>/candidates/<municipalityCode>.json`, one small file per
 * municipality holding its WARD candidates, for the public page to fetch
 * when a voter picks a ward. The names are deliberately not in the site's
 * JavaScript: a voter's browser downloads one municipality, and a dataset
 * that is not confirmed produces no files at all.
 *
 * It refuses, and writes nothing, unless `publishableCandidates` returns
 * entries, which needs a named person's `confirmedBy` and `confirmedOn` on
 * the dataset. Nothing here sets those.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { publishableCandidates, type CandidateDataset } from '../src/modules/ingest/candidateList';

export interface PublishedMunicipality {
  municipalityCode: string;
  source: string;
  fetchedOn: string | null;
  confirmedBy: string;
  confirmedOn: string;
  wards: Record<string, Array<{ name: string; party: string }>>;
}

type Dataset = CandidateDataset & {
  provenance: CandidateDataset['provenance'] & {
    source?: string;
    fetchedOn?: string | null;
    pdfTitle?: string;
    publishedLabel?: string;
  };
};

export function publishCandidates(
  d: Dataset,
  outDir: string,
): { published: number; reason?: string } {
  const entries = publishableCandidates(d);
  if (entries.length === 0) {
    return {
      published: 0,
      reason: 'The dataset is not confirmed by a named person, so nothing was written.',
    };
  }
  const p = d.provenance;
  const byMuni = new Map<string, PublishedMunicipality>();
  for (const e of entries) {
    if (e.kind !== 'WARD') continue;
    let m = byMuni.get(e.municipalityCode);
    if (!m) {
      m = {
        municipalityCode: e.municipalityCode,
        source:
          p.publishedLabel ??
          `${p.source ?? 'Electoral Commission'}: ${p.pdfTitle ?? 'certified candidate list'}`,
        fetchedOn: p.fetchedOn ?? null,
        confirmedBy: p.confirmedBy!,
        confirmedOn: p.confirmedOn!,
        wards: {},
      };
      byMuni.set(e.municipalityCode, m);
    }
    (m.wards[String(e.wardNumber)] ??= []).push({
      name: `${e.fullName} ${e.surname}`,
      party: e.party,
    });
  }
  const dir = path.join(outDir, 'candidates');
  mkdirSync(dir, { recursive: true });
  for (const m of byMuni.values()) {
    for (const w of Object.values(m.wards))
      w.sort((a, b) => a.party.localeCompare(b.party) || a.name.localeCompare(b.name));
    writeFileSync(path.join(dir, `${m.municipalityCode}.json`), JSON.stringify(m));
  }
  return { published: byMuni.size };
}
