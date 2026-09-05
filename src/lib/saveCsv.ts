import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export async function saveCsv(filename: string, csv: string) {
  if (!(await Sharing.isAvailableAsync())) throw new Error('File sharing is unavailable on this device. Open the admin website to download your CSV.');
  const file = new File(Paths.cache, filename);
  try {
    file.write(csv);
    await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text', dialogTitle: 'Save admin records' });
  } finally {
    if (file.exists) file.delete();
  }
}
