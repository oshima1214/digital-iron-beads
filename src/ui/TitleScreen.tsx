import { useEffect, useRef, useState } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { colors, fonts } from './theme';

const WAVE = require('../../assets/title/wave.png') as number;
const FUJI = require('../../assets/title/fuji.png') as number;
// 画像の縦横比（72×51 マス、72×48 マス。tools/title/make-title-beads.ts で作る）
const WAVE_RATIO = 51 / 72;
const FUJI_RATIO = 48 / 72;

/** タイトルを見せる時間（ミリ秒）。タップすればすぐ閉じる */
export const TITLE_MS = 2000;
const FADE_MS = 300;

/**
 * 起動したときのタイトル画面：北斎の2作品をビーズにした絵と、アプリ名。
 * TITLE_MS たつか、タップしたら薄くなって消え、onDone を呼ぶ。
 */
export function TitleScreen({ onDone }: { onDone(): void }) {
  const { width, height } = useWindowDimensions();
  const [opacity] = useState(() => new Animated.Value(1));
  const closing = useRef(false);
  const imgW = Math.min(width - 48, 440, ((height - 220) / (WAVE_RATIO + FUJI_RATIO)) | 0);

  const close = () => {
    if (closing.current) return;
    closing.current = true;
    Animated.timing(opacity, { toValue: 0, duration: FADE_MS, useNativeDriver: true }).start(() => onDone());
  };

  useEffect(() => {
    const t = setTimeout(close, TITLE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, { opacity }]} testID="title-screen">
      <Pressable accessibilityRole="button" accessibilityLabel="タイトルを閉じる" onPress={close} style={styles.fill}>
        <View style={styles.center}>
          <Image source={WAVE} style={{ width: imgW, height: imgW * WAVE_RATIO }} resizeMode="contain" accessibilityIgnoresInvertColors />
          <Text style={[styles.name, { fontSize: Math.max(22, Math.min(34, Math.round(imgW / 13))) }]} accessibilityRole="header">
            デジタルアイロンビーズ
          </Text>
          <Image source={FUJI} style={{ width: imgW, height: imgW * FUJI_RATIO }} resizeMode="contain" accessibilityIgnoresInvertColors />
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // C 案（iOS 標準のシンプルな見た目）：白地に絵とアプリ名だけ
  root: { backgroundColor: '#FFFFFF', zIndex: 100 },
  fill: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20, paddingHorizontal: 24 },
  name: { fontFamily: fonts.bold, color: colors.text, letterSpacing: 1 },
});
