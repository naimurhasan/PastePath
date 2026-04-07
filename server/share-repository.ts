import type { D1Client } from './d1-client.ts';

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

interface D1ShareRow extends Omit<ShareRecord, 'data' | 'view_count'> {
  data: string | ShareData;
  view_count: number | string | null;
}

function parseShareRow(row: D1ShareRow | null): ShareRecord | null {
  if (!row) return null;

  return {
    ...row,
    data: typeof row.data === 'string' ? JSON.parse(row.data) as ShareData : row.data,
    view_count: Number(row.view_count || 0),
  };
}

export function createD1ShareRepository(client: D1Client): ShareRepository {
  return {
    async createShare({ id, title, data, passwordHash, autoDeleteAt }) {
      await client.query(
        `INSERT INTO shares (id, title, data, password_hash, auto_delete_at)
         VALUES (?, ?, ?, ?, ?)`,
        [id, title, JSON.stringify(data), passwordHash, autoDeleteAt],
      );
    },

    async findById(id) {
      const row = await client.queryFirst<D1ShareRow>(
        `SELECT id, title, data, view_count, password_hash, deleted_at, auto_delete_at
         FROM shares
         WHERE id = ?
         LIMIT 1`,
        [id],
      );
      return parseShareRow(row);
    },

    async findMetadataById(id) {
      return client.queryFirst<ShareMetadataRecord>(
        'SELECT title, deleted_at, auto_delete_at FROM shares WHERE id = ? LIMIT 1',
        [id],
      );
    },

    async incrementViewCount(id) {
      await client.query('UPDATE shares SET view_count = view_count + 1 WHERE id = ?', [id]);
    },
  };
}
