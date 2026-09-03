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
