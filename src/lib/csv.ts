/** UTF-8 CSV for Excel/Sheets. Quote cells and neutralize spreadsheet formulas. */
function csvCell(value: unknown) {
  let text = value == null ? '' : String(value).replace(/\0/g, '');
  if (typeof value !== 'number' && /^[\s\uFEFF]*[=+@-]/u.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function csvLine(row: readonly unknown[]) {
  return row.map(csvCell).join(',');
}

export function* toCsvChunks(
  headers: readonly string[],
  rows: readonly (readonly unknown[])[],
  rowsPerChunk = 256,
): Generator<string> {
  yield `\uFEFF${csvLine(headers)}\r\n`;
  for (let offset = 0; offset < rows.length; offset += rowsPerChunk) {
    const end = Math.min(offset + rowsPerChunk, rows.length);
    const lines: string[] = new Array(end - offset);
    for (let index = offset; index < end; index += 1) {
      lines[index - offset] = csvLine(rows[index]);
    }
    yield `${lines.join('\r\n')}\r\n`;
  }
}

export function toCsv(headers: readonly string[], rows: readonly (readonly unknown[])[]) {
  return Array.from(toCsvChunks(headers, rows)).join('');
}

export function validIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
