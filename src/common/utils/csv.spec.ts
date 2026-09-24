import { csvCell, toCsv } from './csv';

describe('csv export', () => {
  it.each(['=HYPERLINK("http://x")', '+1+1', '-2+3', '@SUM(A1)', '\tcmd', '\rcmd'])(
    'neutralizes formula-looking cell %p',
    (value) => {
      expect(csvCell(value).startsWith(`"'`)).toBe(true);
    },
  );

  it('quotes and escapes ordinary values', () => {
    expect(csvCell('Nguyễn "A"')).toBe('"Nguyễn ""A"""');
    expect(csvCell(null)).toBe('""');
    expect(csvCell(42)).toBe('"42"');
    expect(csvCell(new Date('2026-01-02T03:04:05.000Z'))).toBe(
      '"2026-01-02T03:04:05.000Z"',
    );
  });

  it('starts with a UTF-8 BOM and uses CRLF rows', () => {
    const csv = toCsv([['a', 'b'], ['1', '2']]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.slice(1)).toBe('"a","b"\r\n"1","2"\r\n');
  });
});
