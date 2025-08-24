/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  
  // Test patterns
  testMatch: [
    '<rootDir>/test/**/*.test.ts',
    '<rootDir>/lambda/**/*.test.ts'
  ],
  
  // Coverage configuration
  collectCoverage: true,
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'lib/**/*.ts',
    'lambda/**/*.ts',
    '!lib/**/*.d.ts',
    '!lib/**/index.ts',
    '!**/*.test.ts',
    '!**/node_modules/**',
    '!coverage/**'
  ],
  
  // Coverage thresholds for Lambda Functions (from CLAUDE.md)
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 70,
      functions: 75,
      lines: 80
    },
    // Higher thresholds for core business logic
    'lambda/base-management/': {
      statements: 85,
      branches: 75,
      functions: 80,
      lines: 85
    }
  },
  
  coverageReporters: [
    'text',
    'lcov',
    'html',
    'clover'
  ],
  
  // Module name mapping for shared libraries
  moduleNameMapping: {
    '^@loupeen/shared-js-utils$': '<rootDir>/node_modules/@loupeen/shared-js-utils/dist/index.js',
    '^@loupeen/shared-config-library$': '<rootDir>/node_modules/@loupeen/shared-config-library/dist/index.js',
    '^@/(.*)$': '<rootDir>/lib/$1',
    '^@lambda/(.*)$': '<rootDir>/lambda/$1',
    '^@test/(.*)$': '<rootDir>/test/$1'
  },
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  
  // Transform configuration
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: 'tsconfig.json'
    }]
  },
  
  // Global setup and teardown for integration tests
  globalSetup: '<rootDir>/test/global-setup.ts',
  globalTeardown: '<rootDir>/test/global-teardown.ts',
  
  // Test timeout (increased for integration tests)
  testTimeout: 30000,
  
  // Verbose output for debugging
  verbose: false,
  
  // Fail fast on first test failure in CI
  bail: process.env.CI ? 1 : false,
  
  // Clear mocks between tests
  clearMocks: true,
  restoreMocks: true,
  
  // Test projects for different test types
  projects: [
    {
      displayName: 'unit',
      testMatch: [
        '<rootDir>/test/unit/**/*.test.ts',
        '<rootDir>/lambda/**/*.test.ts'
      ],
      testEnvironment: 'node'
    },
    {
      displayName: 'integration',
      testMatch: ['<rootDir>/test/integration/**/*.test.ts'],
      testEnvironment: 'node',
      testTimeout: 60000
    }
  ]
};