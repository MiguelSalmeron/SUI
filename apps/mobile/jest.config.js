/** @type {import('jest').Config} */
module.exports = {
  preset: '@react-native/jest-preset',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@react-native-async-storage/async-storage$': '<rootDir>/__mocks__/async-storage.js',
    '^expo-image-picker$': '<rootDir>/__mocks__/expo-image-picker.js',
    '^expo-image-manipulator$': '<rootDir>/__mocks__/expo-image-manipulator.js',
    '^expo-file-system$': '<rootDir>/__mocks__/expo-file-system.js',
    '^expo-crypto$': '<rootDir>/__mocks__/expo-crypto.js',
    '^expo-haptics$': '<rootDir>/__mocks__/expo-haptics.js',
    '^expo-localization$': '<rootDir>/__mocks__/expo-localization.js',
    '^react-native-safe-area-context$': '<rootDir>/__mocks__/react-native-safe-area-context.js',
    '\\.(ttf|otf|png|jpg|jpeg|gif|webp|svg|mp3|mp4)$': '<rootDir>/__mocks__/assetMock.js',
  },
  transform: {
    '^.+\\.(js|jsx|tsx)$': [
      'babel-jest',
      {
        presets: ['babel-preset-expo'],
      },
    ],
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: {
          jsx: 'react-jsx',
          types: ['jest', 'node'],
        },
      },
    ],
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo|@expo)/)',
  ],
};
