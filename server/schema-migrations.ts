import type { D1Client } from './d1-client.ts';

const schemaMigrations = [
  {
    version: '20260407_create_shares',
    statements: [
      `CREATE TABLE IF NOT EXISTS shares (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        data TEXT NOT NULL,
        password_hash TEXT,
        view_count INTEGER NOT NULL DEFAULT 0,
        deleted_at TEXT,
        auto_delete_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      'CREATE INDEX IF NOT EXISTS idx_shares_auto_delete_at ON shares (auto_delete_at)',
    ],
  },
];

export async function ensureSchema(client: D1Client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const appliedMigrationResult = await client.query('SELECT version FROM schema_migrations');
  const appliedVersions = new Set((appliedMigrationResult.results ?? []).map((row) => row.version));

  for (const migration of schemaMigrations) {
    if (appliedVersions.has(migration.version)) {
      continue;
    }

    for (const statement of migration.statements) {
      await client.query(statement);
    }

    await client.query('INSERT INTO schema_migrations (version) VALUES (?)', [migration.version]);
  }
}
