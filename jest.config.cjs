module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/client/src/setupTests.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/client/src/$1',
    '^@shared/(.*)$': '<rootDir>/shared/$1',
  },
  testMatch: [
    '<rootDir>/client/src/**/__tests__/**/*.(ts|tsx|js)',
    '<rootDir>/client/src/**/*.(test|spec).(ts|tsx|js)',
  ],
  collectCoverageFrom: [
    'client/src/**/*.(ts|tsx)',
    '!client/src/**/*.d.ts',
    '!client/src/main.tsx',
    '!client/src/vite-env.d.ts',
    '!client/src/components/ui/**', // Exclude UI components from coverage initially
    '!client/src/components/**', // Exclude all components for now
    '!client/src/App.tsx', // Exclude App.tsx for now
    '!client/src/lib/utils/__tests__/**', // Exclude test utilities from coverage
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: {
        jsx: 'react-jsx',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        strict: false, // Disable strict mode for tests
      },
    }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  testTimeout: 30000, // Increased timeout for integration tests
  // Performance testing
  testEnvironmentOptions: {
    url: 'http://localhost:3000',
  },
  // Coverage floors set just below current coverage so it can't regress; raise them as tests are added.
  coverageThreshold: {
    global: {
      branches: 10,
      functions: 4,
      lines: 6,
      statements: 6,
    },
    './client/src/lib/games/': {
      branches: 15,
      functions: 20,
      lines: 18,
      statements: 18,
    },
    './client/src/lib/utils/': {
      branches: 27,
      functions: 30,
      lines: 34,
      statements: 34,
    },
  },
};
