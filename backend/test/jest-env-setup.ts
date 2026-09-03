// Loads backend/.env before the integration test project boots the real
// Nest app — same env file `npm run start:dev` uses, so integration
// tests run against the same local dev database/config, not a separate
// test-only environment. Deliberately not `dotenv/config` at the
// project root — this only applies to the "integration" Jest project.
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
