const nextJest = require('next/jest');

// next/jest wires up SWC transforms, .env loading, and CSS/image mocking
// the same way `next build`/`next dev` do — no separate babel/ts-jest
// config to keep in sync with next.config.js by hand.
const createJestConfig = nextJest({ dir: './' });

/** @type {import('jest').Config} */
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testPathIgnorePatterns: ['<rootDir>/.next/', '<rootDir>/node_modules/'],
};

module.exports = createJestConfig(customJestConfig);
