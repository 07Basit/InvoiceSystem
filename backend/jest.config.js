/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/*.spec.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^shared$': '<rootDir>/../shared/src/index.ts',
  },
  setupFilesAfterFramework: ['<rootDir>/src/__tests__/setup.ts'],
  collectCoverageFrom: ['src/**/*.ts', '!src/prisma/seed.ts', '!src/server.ts'],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
};
