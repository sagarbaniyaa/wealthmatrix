/**
 * Two Jest projects, run together by default (`npm test`):
 *  - "unit": pure logic, no DB/network — the CGT/DFM/ATR/charge-
 *    projection/retirement-cashflow engines. Fast, run on every commit.
 *  - "integration": boots the real Nest app against the actual local
 *    dev Postgres (same one `npm run start:dev` uses — migrations
 *    001-016 must already be applied and at least one firm/admin user
 *    must be seeded) via supertest. Signs its own JWT with the same
 *    JWT_SECRET as .env (test/test-jwt.ts) rather than logging in, and
 *    reads a real firm/admin id straight out of the database
 *    (test/db-fixtures.ts) rather than hardcoding UUIDs that would
 *    break on a reseed. This project genuinely needs Postgres running
 *    locally — it fails loudly (not a silent skip) if it isn't.
 */
module.exports = {
  projects: [
    {
      displayName: 'unit',
      testEnvironment: 'node',
      rootDir: '.',
      testMatch: ['<rootDir>/src/**/*.spec.ts'],
      // isolatedModules (via a dedicated tsconfig, not the shared one
      // the production build uses) transpiles each test file standalone
      // instead of type-checking against the whole program graph. Full
      // type-checking already happens via `tsc --noEmit`; doing it AGAIN
      // per test file (ts-jest's default) made a 42-test pure-function
      // suite take 24 minutes on this machine — this drops it to ~1
      // minute. The ts-jest config key is deprecated in favour of an
      // `isolatedModules: true` tsconfig flag, but that flag is a real
      // compiler behaviour change (restricts const enums, re-export
      // syntax) we don't want silently applied to the actual build via
      // the shared tsconfig.json — see tsconfig.spec.json.
      transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.spec.json' }] },
    },
    {
      displayName: 'integration',
      testEnvironment: 'node',
      rootDir: '.',
      testMatch: ['<rootDir>/test/**/*.e2e-spec.ts'],
      setupFiles: ['<rootDir>/test/jest-env-setup.ts'],
      testTimeout: 30000,
      transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.spec.json' }] },
    },
  ],
};
