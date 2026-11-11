/** @type {import('jest').Config} */
module.exports = {
  projects: [
    {
      displayName: 'core',
      preset: 'jest-expo',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/src/core/**/*.test.ts', '<rootDir>/tools/**/*.test.ts'],
    },
    {
      displayName: 'app',
      preset: 'jest-expo/ios',
      testMatch: ['<rootDir>/src/app/**/*.test.tsx', '<rootDir>/src/ui/**/*.test.tsx'],
    },
  ],
};
