// iOS: Skia で使う BIZ UDPゴシック（画像に文字を描くとき用）。一度読んだら使い回す。
import { BIZUDPGothic_400Regular, BIZUDPGothic_700Bold } from '@expo-google-fonts/biz-udpgothic';
import { type SkTypeface, Skia } from '@shopify/react-native-skia';
import { Asset } from 'expo-asset';

const cache = new Map<'regular' | 'bold', SkTypeface>();

export async function loadTypeface(weight: 'regular' | 'bold'): Promise<SkTypeface> {
  const hit = cache.get(weight);
  if (hit) return hit;
  const asset = Asset.fromModule(weight === 'bold' ? BIZUDPGothic_700Bold : BIZUDPGothic_400Regular);
  await asset.downloadAsync();
  const data = await Skia.Data.fromURI(asset.localUri ?? asset.uri);
  const tf = Skia.Typeface.MakeFreeTypeFaceFromData(data);
  if (!tf) throw new Error('font could not be loaded');
  cache.set(weight, tf);
  return tf;
}
