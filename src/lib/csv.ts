/** UTF-8 CSV for Excel/Sheets. Quote cells and neutralize spreadsheet formulas. */
export function toCsv(headers: readonly string[], rows: readonly (readonly unknown[])[]) {
  const cell = (value: unknown) => {
    let text = value == null ? '' : String(value).replace(/\0/g, '');
    if (typeof value !== 'number' && /^[\s\uFEFF]*[=+@-]/u.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  return '\uFEFF' + [headers, ...rows].map((row) => row.map(cell).join(',')).join('\r\n') + '\r\n';
}

export function validIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
