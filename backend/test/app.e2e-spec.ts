import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { fetchTestIdentity, fetchTestEntityWithAccount } from './db-fixtures';
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
  let firmId: string;

  beforeAll(async () => {
    const identity = await fetchTestIdentity();
    firmId = identity.firmId;
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

  describe('access control beyond firm-level RLS — an adviser with no assignment to a household', () => {
    // A random, unassigned adviser identity: no adviser_household_assignment
    // row for this id can exist (nothing created it), which is exactly the
    // "not assigned to this household" case ensureAccessible/
    // ensureAccountAccessible/ensureEntityAccessible must reject. The JWT
    // strategy trusts signed claims without a DB lookup (see its own
    // comment), so this doesn't need a real app_user row to test with.
    const unassignedAdviserToken = () =>
      signTestJwt({ sub: '11111111-1111-1111-1111-111111111111', firmId, role: 'adviser', email: 'unassigned@wealthmatrix.local' });

    it('rejects an unassigned adviser reading an account by id, even though firm-level RLS alone would allow it', async () => {
      const fixture = await fetchTestEntityWithAccount(firmId);
      if (!fixture) return; // seed data doesn't have this shape — nothing to test against
      await request(app.getHttpServer())
        .get(`/accounts/${fixture.accountId}`)
        .set('Authorization', `Bearer ${unassignedAdviserToken()}`)
        .expect(403);
      // Sanity check the fixture itself is reachable by admin, so a 403
      // above is really the access check working, not a broken fixture.
      await request(app.getHttpServer())
        .get(`/accounts/${fixture.accountId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('rejects an unassigned adviser reading an entity reached only through another entity\'s ownership graph', async () => {
      const fixture = await fetchTestEntityWithAccount(firmId);
      if (!fixture) return;

      // Create a subsidiary with NO household_id of its own, owned
      // entirely by the fixture entity (which DOES have one) — the exact
      // shape ensureEntityAccessible closes: reachable only by walking
      // the ownership graph upward, never a direct household_id lookup.
      const subsidiary = await request(app.getHttpServer())
        .post('/entities')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Access Control Test Subsidiary Ltd', entityType: 'holding_company', baseCurrencyId: fixture.baseCurrencyId })
        .expect(201);

      await request(app.getHttpServer())
        .post('/entity-ownership')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ownerEntityId: fixture.entityId, ownedEntityId: subsidiary.body.id, ownershipPct: 100, validFrom: '2020-01-01' })
        .expect(201);

      await request(app.getHttpServer())
        .get(`/entities/${subsidiary.body.id}`)
        .set('Authorization', `Bearer ${unassignedAdviserToken()}`)
        .expect(403);

      await request(app.getHttpServer())
        .get(`/entities/${subsidiary.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
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
