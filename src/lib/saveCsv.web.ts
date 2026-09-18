export async function saveCsv(filename: string, chunks: Iterable<string>) {
  const url = URL.createObjectURL(new Blob(Array.from(chunks), { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
