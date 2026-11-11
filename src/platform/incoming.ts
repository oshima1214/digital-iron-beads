import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';

/** ファイルのバイト列を読む（file:// の URI）。 */
export async function readFileBytes(uri: string): Promise<Uint8Array> {
  return new File(uri).bytes();
}

/** .beads ファイルを選ぶ。キャンセルなら null。 */
export async function pickBeadsFile(): Promise<string | null> {
  const r = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
  return r.canceled || !r.assets?.[0] ? null : r.assets[0].uri;
}
