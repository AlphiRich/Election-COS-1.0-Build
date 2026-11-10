/**
 * Election Campaign OS — public site, where the 2026 results pages live.
 * One file so the router, the links and the advert allowlist cannot disagree.
 */
export const TRACKER_PATH = '/coalitions';
export const MY_WARD_PATH = '/my-ward';
export const COUNCIL_ROUTE = '/councils/:code';
export const councilPath = (code: string): string => `/councils/${code}`;
export const myWardPath = (code: string, ward?: number): string =>
  `${MY_WARD_PATH}?council=${encodeURIComponent(code)}${ward ? `&ward=${ward}` : ''}`;
