// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'legacy/*', '.superpowers/*', 'tools/compare/out/*'],
  },
  {
    // src/core は React Native に依存しない純粋な TypeScript に保つ
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['react', 'react-native', 'react-native-*', 'expo', 'expo-*', '@expo/*', '@shopify/*', '@/ui/*', '@/platform/*', '@/app/*'], message: 'src/core must stay platform independent.' },
          ],
        },
      ],
    },
  },
]);
