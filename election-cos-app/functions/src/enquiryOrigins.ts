/**
 * Origins allowed to submit an enquiry. A mirror of `enquiryOrigins()` in
 * `src/config/estate.ts` (the functions package cannot import from the app);
 * `src/config/estate.test.ts` fails if the two drift. The application's own
 * origin is deliberately absent: campaign staff do not submit sales
 * enquiries from inside the war room.
 */
export const ENQUIRY_ORIGINS = [
  'https://electioncos.co.za',
  'https://innovationconsult.co.za',
] as const;
