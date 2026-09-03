import { Client } from 'pg';

/**
 * Reads a real firm + admin user id straight out of the local dev
 * database for integration tests to sign a JWT against — deliberately
 * NOT hardcoded UUIDs, so this suite keeps working after a reseed/
 * restore rather than silently testing against rows that no longer
 * exist. `firm` carries no RLS (the tenant root — see auth.service.ts's
 * own comment on this), so it's readable without any tenant context;
 * `app_user` needs app.current_firm_id set first, same as any other
 * RLS-protected table.
 */
export async function fetchTestIdentity(): Promise<{ firmId: string; adminUserId: string; adminEmail: string }> {
  const client = new Client({
    host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD, database: process.env.DB_DATABASE,
  });
  await client.connect();
  try {
    const firmResult = await client.query('SELECT id FROM firm ORDER BY created_at ASC LIMIT 1');
    if (firmResult.rows.length === 0) throw new Error('No firm found — is the local dev database seeded (db/full_dump.sql)?');
    const firmId = firmResult.rows[0].id as string;

    await client.query(`SELECT set_config('app.current_firm_id', $1, false)`, [firmId]);
    const userResult = await client.query(
      `SELECT id, email FROM app_user WHERE role = 'admin' AND is_active = true ORDER BY created_at ASC LIMIT 1`,
    );
    if (userResult.rows.length === 0) throw new Error(`No active admin user found for firm ${firmId}.`);

    return { firmId, adminUserId: userResult.rows[0].id, adminEmail: userResult.rows[0].email };
  } finally {
    await client.end();
  }
}

/**
 * Finds a real, already-seeded entity that has a household_id AND an
 * account owned by that same entity — the exact shape the access-
 * control integration tests need (an anchor entity to hang a new
 * ownership-graph-only entity off of, plus a real account to probe
 * directly) — without hardcoding any UUID, so this stays robust to a
 * reseed the same way fetchTestIdentity is. Returns null if the seed
 * data doesn't have this shape (tests using it should skip, not fail).
 */
export async function fetchTestEntityWithAccount(
  firmId: string,
): Promise<{ entityId: string; householdId: string; baseCurrencyId: string; accountId: string } | null> {
  const client = new Client({
    host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD, database: process.env.DB_DATABASE,
  });
  await client.connect();
  try {
    await client.query(`SELECT set_config('app.current_firm_id', $1, false)`, [firmId]);
    const result = await client.query(
      `SELECT e.id AS entity_id, e.household_id, e.base_currency_id, a.id AS account_id
       FROM entity e
       JOIN account a ON a.owner_entity_id = e.id
       WHERE e.household_id IS NOT NULL
       LIMIT 1`,
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return { entityId: row.entity_id, householdId: row.household_id, baseCurrencyId: row.base_currency_id, accountId: row.account_id };
  } finally {
    await client.end();
  }
}
