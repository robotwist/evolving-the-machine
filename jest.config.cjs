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
  // Global test configuration
  globals: {
    'ts-jest': {
      tsconfig: {
        jsx: 'react-jsx',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        strict: false, // Disable strict mode for tests
      },
    },
  },
  // Performance testing
  testEnvironmentOptions: {
    url: 'http://localhost:3000',
  },
  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 20,
      functions: 25,
      lines: 30,
      statements: 30,
    },
    // Specific thresholds for critical files
    './client/src/lib/games/': {
      branches: 15,
      functions: 20,
      lines: 25,
      statements: 25,
    },
    './client/src/lib/utils/': {
      branches: 30,
      functions: 35,
      lines: 40,
      statements: 40,
    },
  },
};
