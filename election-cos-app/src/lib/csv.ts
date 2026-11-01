/**
 * Election Campaign OS — CSV cell encoding for exports
 *
 * Quotes every cell and neutralises spreadsheet formulas. A cell that
 * starts with `=`, `+`, `-`, `@`, tab or carriage return is executed by
 * Excel and Sheets as a formula when the file is opened; an actor name or
 * target id that came from a user is attacker-controlled text, so it is
 * prefixed with an apostrophe. Numbers are written as numbers.
 */
export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '""';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '""';
  const guarded = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${guarded.replace(/"/g, '""')}"`;
}

export function toCsv(rows: Array<Array<string | number | null | undefined>>): string {
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

/** Browser download of a text file. Not unit-tested: it only touches the DOM. */
export function downloadText(filename: string, mime: string, text: string): void {
  const blob = new Blob([text], { type: `${mime};charset=utf-8;` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
