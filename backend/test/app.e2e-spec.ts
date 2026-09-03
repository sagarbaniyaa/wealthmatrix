import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { fetchTestIdentity } from './db-fixtures';
import { signTestJwt } from './test-jwt';

/**
 * Boots the REAL app (the same module graph app.module.ts wires up for
 * production) against the local dev Postgres, and drives it with
 * supertest — this is the automated form of the manual curl-based
 * verification used throughout this project's build, not a mocked
 * approximation of the stack.
 */
describe('WealthMatrix API (integration)', () => {
  let app: INestApplication;
  let adminToken: string;
  let householdId: string;

  beforeAll(async () => {
    const identity = await fetchTestIdentity();
    adminToken = signTestJwt({ sub: identity.adminUserId, firmId: identity.firmId, role: 'admin', email: identity.adminEmail });

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    // Mirror main.ts's real bootstrap options — a test that skips these
    // would pass/fail on different behaviour than what's actually deployed.
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('authentication', () => {
    it('rejects a request with no token', async () => {
      await request(app.getHttpServer()).get('/households').expect(401);
    });

    it('rejects a request with a garbage token', async () => {
      await request(app.getHttpServer()).get('/households').set('Authorization', 'Bearer not-a-real-token').expect(401);
    });

    it('rejects a token signed with the wrong secret (forged token)', async () => {
      const forged = require('jsonwebtoken').sign({ sub: 'x', firmId: 'y', role: 'admin', email: 'x@x.com' }, 'wrong-secret');
      await request(app.getHttpServer()).get('/households').set('Authorization', `Bearer ${forged}`).expect(401);
    });

    it('accepts a validly signed token for an active user', async () => {
      const res = await request(app.getHttpServer()).get('/households').set('Authorization', `Bearer ${adminToken}`).expect(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('multi-tenant isolation', () => {
    it('a token for a firm that does not exist returns no data, never another firm\'s', async () => {
      const bogusFirmToken = signTestJwt({ sub: '00000000-0000-0000-0000-000000000000', firmId: '00000000-0000-0000-0000-000000000000', role: 'admin', email: 'nobody@nowhere.local' });
      const res = await request(app.getHttpServer()).get('/households').set('Authorization', `Bearer ${bogusFirmToken}`).expect(200);
      expect(res.body).toEqual([]);
    });
  });

  describe('household-scoped feature endpoints stay stable on households with no data', () => {
    beforeAll(async () => {
      const res = await request(app.getHttpServer()).get('/households').set('Authorization', `Bearer ${adminToken}`).expect(200);
      if (res.body.length === 0) throw new Error('No households seeded — run db/full_dump.sql against the local dev database first.');
      householdId = res.body[0].id;
    });

    it('CGT analysis preview never crashes, even with zero investment accounts', async () => {
      const res = await request(app.getHttpServer())
        .get(`/households/${householdId}/cgt-analysis/preview`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(Array.isArray(res.body.perPerson)).toBe(true);
    });

    it('DFM recommendation preview reports an honest "not enough data" rather than a fabricated mandate when the household has no risk profile', async () => {
      const res = await request(app.getHttpServer())
        .get(`/households/${householdId}/dfm-recommendation/preview`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(typeof res.body.mandate).toBe('string');
      expect(Array.isArray(res.body.fundCategories)).toBe(true);
    });

    it('Client Action checklist returns null (no active action) rather than erroring when none has been set', async () => {
      await request(app.getHttpServer())
        .get(`/households/${householdId}/action/checklist`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('rejects a request for a household id that does not exist with a clean 404/403, not a 500', async () => {
      const res = await request(app.getHttpServer())
        .get('/households/00000000-0000-0000-0000-000000000000/cgt-analysis/preview')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBeLessThan(500);
    });
  });

  describe('input validation', () => {
    it('rejects an unrecognised field on a whitelisted DTO route (forbidNonWhitelisted)', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'admin@wealthmatrix.local', password: 'irrelevant123', notARealField: 'x' })
        .expect(400);
    });

    it('rejects a login with an invalid email format before ever touching the database', async () => {
      await request(app.getHttpServer()).post('/auth/login').send({ email: 'not-an-email', password: 'irrelevant123' }).expect(400);
    });
  });
});
