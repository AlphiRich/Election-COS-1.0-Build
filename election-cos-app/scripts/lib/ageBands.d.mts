export const POLL_DAY: Date;
export const MIN_CELL: number;
export const BANDS: string[];
export function ageFromMask(mask: string | null | undefined): number | null;
export function bandOf(age: number): string;
export function suppress(counts: Record<string, number>): Record<string, number | null>;
