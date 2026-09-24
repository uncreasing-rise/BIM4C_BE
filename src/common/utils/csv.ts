// Spreadsheet apps evaluate cells starting with these characters as formulas.
// Exported rows contain text submitted through public forms, so neutralize
// them (OWASP "CSV injection") by prefixing a single quote.
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

export function csvCell(value: unknown): string {
  const text =
    value === null || value === undefined
      ? ''
      : typeof value === 'string'
        ? value
        : typeof value === 'number' ||
            typeof value === 'boolean' ||
            typeof value === 'bigint'
          ? value.toString()
          : value instanceof Date
            ? value.toISOString()
            : typeof value === 'object'
              ? JSON.stringify(value)
              : '';
  const safe = FORMULA_PREFIX.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

/** Serializes rows as UTF-8 CSV with a BOM so Excel detects the encoding. */
export function toCsv(rows: unknown[][]): string {
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
}
