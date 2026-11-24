import { Canvas, createPicture, Picture, Skia } from '@shopify/react-native-skia';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { fonts } from './theme';

const WAVE = require('../../assets/title/wave.png') as number;
const FUJI = require('../../assets/title/fuji.png') as number;
const ILLUST = require('../../assets/title/beads-illust.png') as number;
// 画像の縦横比（72×51 マス、72×48 マス。tools/title/make-title-beads.ts で作る）
const WAVE_RATIO = 51 / 72;
const FUJI_RATIO = 48 / 72;

/** タイトルを見せる時間（ミリ秒）。タップすればすぐ閉じる */
export const TITLE_MS = 2600;
const FADE_MS = 300;

/** 見た目（案1 ポップ）：モッチーポップの文字、水色のグラデーション、白いプレートの点、ピンクの帯 */
const LOOK = { font: 'MochiyPopOne_400Regular', bg: ['#7FD3FF', '#D6F4FF'] as const, peg: 'rgba(255,255,255,0.6)', pill: '#FF4F84', pillInk: '#FFFFFF' };
const BG = LOOK.bg[0];
const PEG = LOOK.peg;
const BEAD_COLORS = ['#DD0808', '#FF7B00', '#FFD400', '#35963F', '#58ABE5', '#2B3F87', '#703B9B', '#FF6F98'];
/** 「アイロンビーズ」の1文字ずつのビーズの色（黄色だけ文字を濃くする） */
const LETTERS: { ch: string; color: string; ink: string }[] = [
  { ch: 'ア', color: '#DD0808', ink: '#FFFFFF' },
  { ch: 'イ', color: '#FF7B00', ink: '#FFFFFF' },
  { ch: 'ロ', color: '#F2BA00', ink: '#3A2A00' },
  { ch: 'ン', color: '#35963F', ink: '#FFFFFF' },
  { ch: 'ビ', color: '#2E9BD6', ink: '#FFFFFF' },
  { ch: 'ー', color: '#2B3F87', ink: '#FFFFFF' },
  { ch: 'ズ', color: '#703B9B', ink: '#FFFFFF' },
];

/** 画面の端のほうに散らばるビーズ（毎回同じ並びになるよう、決まった数列で置く） */
function scatter(w: number, h: number) {
  const out: { x: number; y: number; r: number; color: string }[] = [];
  let seed = 7;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < 26; i++) {
    const edge = i % 4;
    const t = rnd();
    const d = rnd() * 0.12;
    const x = edge === 0 ? d * w : edge === 1 ? w - d * w : t * w;
    const y = edge === 2 ? d * h : edge === 3 ? h - d * h : t * h;
    out.push({ x, y, r: 6 + rnd() * 6, color: BEAD_COLORS[i % BEAD_COLORS.length] });
  }
  return out;
}

/**
 * 起動したときのタイトル画面：北斎の2作品のビーズ絵、ビーズのイラスト、ビーズの玉に1文字ずつ載せたアプリ名。
 * 文字のビーズは1つずつポンと出る。TITLE_MS たつか、タップしたら薄くなって消え、onDone を呼ぶ。
 */
export function TitleScreen({ onDone }: { onDone(): void }) {
  const { width, height } = useWindowDimensions();
  const [opacity] = useState(() => new Animated.Value(1));
  const [pops] = useState(() => LETTERS.map(() => new Animated.Value(0)));
  const [rise] = useState(() => new Animated.Value(0));
  const closing = useRef(false);

  // 絵の幅：縦に「波・題字・富士」が入る大きさ
  const imgW = Math.min(width - 72, 420, ((height - 300) / (WAVE_RATIO + FUJI_RATIO)) | 0);
  const bead = Math.min(54, Math.floor((imgW + 24) / LETTERS.length) - 4);
  const pegs = useMemo(() => {
    const step = 22;
    const out: { x: number; y: number }[] = [];
    for (let y = step / 2; y < height; y += step) for (let x = step / 2; x < width; x += step) out.push({ x, y });
    return out;
  }, [width, height]);
  const loose = useMemo(() => scatter(width, height), [width, height]);
  // 背景は一度だけ絵にしておく（点が多いので、部品を並べるより速い）
  const backdrop = useMemo(
    () =>
      createPicture(
        (c) => {
          const paint = Skia.Paint();
          paint.setAntiAlias(true);
          // 上から下へのグラデーション
          paint.setShader(Skia.Shader.MakeLinearGradient({ x: 0, y: 0 }, { x: 0, y: height }, [Skia.Color(LOOK.bg[0]), Skia.Color(LOOK.bg[1])], null, 0));
          c.drawRect(Skia.XYWHRect(0, 0, width, height), paint);
          paint.setShader(null);
          paint.setColor(Skia.Color(PEG));
          for (const p of pegs) c.drawCircle(p.x, p.y, 1.6, paint);
          for (const b of loose) {
            paint.setColor(Skia.Color(b.color));
            paint.setAlphaf(0.85);
            c.drawCircle(b.x, b.y, b.r, paint);
            paint.setColor(Skia.Color('#FFFFFF'));
            paint.setAlphaf(0.9);
            c.drawCircle(b.x, b.y, b.r * 0.38, paint);
          }
        },
        { width, height },
      ),
    [pegs, loose, width, height],
  );

  const close = () => {
    if (closing.current) return;
    closing.current = true;
    Animated.timing(opacity, { toValue: 0, duration: FADE_MS, useNativeDriver: true }).start(() => onDone());
  };

  useEffect(() => {
    Animated.timing(rise, { toValue: 1, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    Animated.stagger(
      80,
      pops.map((v) => Animated.spring(v, { toValue: 1, friction: 4, tension: 140, useNativeDriver: true })),
    ).start();
    const t = setTimeout(close, TITLE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 上下からすべり込みながら、少し傾けて置く（カードのように）
  const slide = (from: number, tilt: string) => ({
    opacity: rise,
    transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [from, 0] }) }, { rotate: tilt }],
  });

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, { opacity }]} testID="title-screen">
      <Pressable accessibilityRole="button" accessibilityLabel="タイトルを閉じる" onPress={close} style={styles.fill}>
        {/* 背景：プレートの点と、散らばったビーズ */}
        {/* Skia の Canvas は style に配列を渡せない（Web で落ちる）ので、1つのオブジェクトにする */}
        <Canvas style={{ position: 'absolute', left: 0, top: 0, width, height }} pointerEvents="none">
          <Picture picture={backdrop} />
        </Canvas>

        <View style={styles.center}>
          <Animated.View style={[styles.card, slide(-24, '-3deg')]}>
            <Image source={WAVE} style={{ width: imgW, height: imgW * WAVE_RATIO }} resizeMode="contain" accessibilityIgnoresInvertColors />
          </Animated.View>

          <View style={styles.titleBlock} accessible accessibilityRole="header" accessibilityLabel="デジタルアイロンビーズ">
            <Image source={ILLUST} style={[styles.illust, { width: bead * 3.2, height: bead * 3.2, right: -bead * 0.9, top: -bead * 2.6 }]} resizeMode="contain" />
            <View style={[styles.digitalPill, { backgroundColor: LOOK.pill }]}>
              <Text style={[styles.digital, { fontFamily: LOOK.font, color: LOOK.pillInk, fontSize: Math.round(bead * 0.42) }]}>デジタル</Text>
            </View>
            <View style={styles.letters}>
              {LETTERS.map((l, i) => (
                <Animated.View
                  key={l.ch}
                  style={[
                    styles.letterBead,
                    { width: bead, height: bead, borderRadius: bead / 2, backgroundColor: l.color },
                    { transform: [{ scale: pops[i] }, { rotate: i % 2 ? '6deg' : '-6deg' }] },
                  ]}>
                  <Text style={[styles.letter, { fontFamily: LOOK.font, color: l.ink, fontSize: Math.round(bead * 0.56), lineHeight: Math.round(bead * 0.7) }]}>{l.ch}</Text>
                </Animated.View>
              ))}
            </View>
          </View>

          <Animated.View style={[styles.card, slide(24, '2.5deg')]}>
            <Image source={FUJI} style={{ width: imgW, height: imgW * FUJI_RATIO }} resizeMode="contain" accessibilityIgnoresInvertColors />
          </Animated.View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: BG, zIndex: 100 },
  fill: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 26, paddingHorizontal: 24 },
  card: {
    backgroundColor: '#FFFFFF',
    padding: 8,
    borderRadius: 14,
    shadowColor: '#5A3E1B',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  titleBlock: { alignItems: 'center', gap: 8 },
  illust: { position: 'absolute' },
  digitalPill: { backgroundColor: '#2B3F87', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 3 },
  digital: { fontFamily: fonts.bold, color: '#FFFFFF', letterSpacing: 3 },
  letters: { flexDirection: 'row', gap: 4 },
  letterBead: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.55)',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  letter: { fontFamily: fonts.bold, textAlign: 'center' },
});
