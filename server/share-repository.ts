import type { DatabaseSync } from 'node:sqlite';

export interface ShareData {
  images: unknown[];
}

export interface ShareRecord {
  id: string;
  title: string;
  data: ShareData;
  view_count: number;
  password_hash: string | null;
  deleted_at: string | null;
  auto_delete_at: string | null;
}

export interface ShareMetadataRecord {
  title: string | null;
  deleted_at: string | null;
  auto_delete_at: string | null;
}

export interface CreateShareInput {
  id: string;
  title: string;
  data: ShareData;
  passwordHash: string | null;
  autoDeleteAt: string | null;
}

export interface ShareRepository {
  createShare(input: CreateShareInput): Promise<void>;
  findById(id: string): Promise<ShareRecord | null>;
  findMetadataById(id: string): Promise<ShareMetadataRecord | null>;
  incrementViewCount(id: string): Promise<void>;
}

interface SqliteShareRow extends Omit<ShareRecord, 'data' | 'view_count'> {
  data: string;
  view_count: number | string | null;
}

function parseShareRow(row: SqliteShareRow | null | undefined): ShareRecord | null {
  if (!row) return null;

  return {
    ...row,
    data: JSON.parse(row.data) as ShareData,
    view_count: Number(row.view_count || 0),
  };
}

export function createSqliteShareRepository(database: DatabaseSync): ShareRepository {
  const createShareStatement = database.prepare(`
    INSERT INTO shares (id, title, data, password_hash, auto_delete_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  const findByIdStatement = database.prepare(`
    SELECT id, title, data, view_count, password_hash, deleted_at, auto_delete_at
    FROM shares
    WHERE id = ?
    LIMIT 1
  `);
  const findMetadataByIdStatement = database.prepare(`
    SELECT title, deleted_at, auto_delete_at
    FROM shares
    WHERE id = ?
    LIMIT 1
  `);
  const incrementViewCountStatement = database.prepare(`
    UPDATE shares
    SET view_count = view_count + 1
    WHERE id = ?
  `);

  return {
    async createShare({ id, title, data, passwordHash, autoDeleteAt }) {
      createShareStatement.run(id, title, JSON.stringify(data), passwordHash, autoDeleteAt);
    },

    async findById(id) {
      const row = findByIdStatement.get(id) as SqliteShareRow | undefined;
      return parseShareRow(row);
    },

    async findMetadataById(id) {
      return (findMetadataByIdStatement.get(id) as ShareMetadataRecord | undefined) ?? null;
    },

    async incrementViewCount(id) {
      incrementViewCountStatement.run(id);
    },
  };
}
