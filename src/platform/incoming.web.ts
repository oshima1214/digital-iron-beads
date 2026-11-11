import * as DocumentPicker from 'expo-document-picker';

export async function readFileBytes(uri: string): Promise<Uint8Array> {
  const res = await fetch(uri);
  return new Uint8Array(await res.arrayBuffer());
}

export async function pickBeadsFile(): Promise<string | null> {
  const r = await DocumentPicker.getDocumentAsync({ type: '*/*' });
  return r.canceled || !r.assets?.[0] ? null : r.assets[0].uri;
}
