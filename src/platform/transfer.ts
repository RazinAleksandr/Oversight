import { Share } from '@capacitor/share';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { native } from './storage';
export async function exportSave(json: string): Promise<void> {
  const name = 'Oversight-save.json';
  if (native) {
    const file = await Filesystem.writeFile({ path: name, directory: Directory.Cache, data: json, encoding: Encoding.UTF8 });
    await Share.share({ url: file.uri });
  } else {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = name; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
