import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * app.json の設定に、配信先（Expo のアカウントとプロジェクト）の切り替えを足す。
 *
 * ふだん（環境変数なし）：app.json のまま。組織 digital-iron-beads-team のプロジェクトに配信する。
 * 自分のアカウントで配信して試すとき（組織への招待なしで、リポジトリだけで試す）：
 *   EXPO_OWNER      … 自分の Expo のユーザー名
 *   EXPO_PROJECT_ID … 自分のアカウントに作ったプロジェクトの ID（未設定なら ID なし。eas init で作る）
 * 手順は README の「招待なしで試す」。app.json は書き換えないので、間違えて本来の配信先を壊すことがない。
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const owner = process.env.EXPO_OWNER?.trim();
  if (!owner) return config as ExpoConfig;
  const projectId = process.env.EXPO_PROJECT_ID?.trim();
  const extra = { ...config.extra, eas: { ...config.extra?.eas, projectId } };
  if (!projectId) delete extra.eas.projectId;
  return {
    ...(config as ExpoConfig),
    owner,
    extra,
    updates: projectId ? { ...config.updates, url: `https://u.expo.dev/${projectId}` } : { ...config.updates, url: undefined },
  };
};
