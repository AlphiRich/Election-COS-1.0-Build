## Overview
This PR introduces the `IECExtractorService` to handle automated, real-time data hydration from the official IEC API (`api.elections.org.za`). It normalizes incoming ward and voting district (VD) results into the standard ECOS Knowledge Hub JSON schema for the 2026 local government elections.

## Key Technical Additions
- **IEC Extractor Service:** Implements Axios-based polling for the `api/ResultsProgress` endpoint, enforcing strict PascalCase parameter formatting as required by the IEC.
- **Data Deduplication:** Generates a deterministic SHA-256 hash (`iec-src-[hash]`) from the Event ID, Ward, and VD Code to ensure subsequent API polls securely `upsert` rather than duplicate historical snapshots.
- **Audit Logging:** Every successful ingestion or API failure writes an immutable record to the `AuditLog` table to satisfy our POPIA and ISO 27001 data tracking requirements.
- **Schema Updates:** Added `EcosKnowledgeHub` and `AuditLog` models to `schema.prisma`.

## Testing Instructions
1. Pull the branch locally.
2. Ensure your `.env` contains valid `IEC_API_BASE_URL` and `IEC_API_KEY` values.
3. Run `npx prisma db push` (or `migrate dev`) to update your local Postgres instance.
4. Execute the unit tests (which should hit the Mock Service Worker for the IEC payload) and ensure the GitHub Actions CI pipeline passes.
