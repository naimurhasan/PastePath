const D1_API_BASE = 'https://api.cloudflare.com/client/v4';
const MAX_RETRIES = 4;
const BASE_RETRY_DELAY_MS = 750;

export interface D1QueryResult<T = Record<string, unknown>> {
  results?: T[];
  success?: boolean;
}

export interface D1Client {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<D1QueryResult<T>>;
  queryFirst<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T | null>;
}

interface CloudflareApiError {
  message?: string;
}

interface CloudflareD1Response<T = Record<string, unknown>> {
  success?: boolean;
  result?: D1QueryResult<T>[];
  errors?: CloudflareApiError[];
  messages?: string[];
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

export function createD1Client(): D1Client {
  const accountId = getRequiredEnv('CLOUDFLARE_ACCOUNT_ID');
  const databaseId = getRequiredEnv('CLOUDFLARE_D1_DATABASE_ID');
  const apiToken = getRequiredEnv('CLOUDFLARE_API_TOKEN');
  const baseUrl = `${D1_API_BASE}/accounts/${accountId}/d1/database/${databaseId}`;

  async function request<T = Record<string, unknown>>(path: string, payload: unknown) {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const response = await fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const json = await response.json().catch(() => null) as CloudflareD1Response<T> | null;
      if (!json) {
        throw new Error(`Cloudflare D1 returned a non-JSON response with status ${response.status}`);
      }

      const message =
        json?.errors?.map((error) => error.message).filter(Boolean).join(', ') ||
        json?.messages?.join(', ') ||
        `Cloudflare D1 request failed with status ${response.status}`;
      const retryAfterSeconds = Number(response.headers.get('retry-after') || 0);
      const shouldRetry =
        attempt < MAX_RETRIES &&
        (response.status === 429 || /throttl|rate|please wait/i.test(message));

      if (shouldRetry) {
        const fallbackDelay = BASE_RETRY_DELAY_MS * 2 ** attempt;
        await sleep(retryAfterSeconds > 0 ? retryAfterSeconds * 1000 : fallbackDelay);
        continue;
      }

      if (!response.ok || json.success === false) {
        throw new Error(message);
      }

      return json.result;
    }

    throw new Error('Cloudflare D1 request failed after retries');
  }

  async function query<T = Record<string, unknown>>(sql: string, params: unknown[] = []) {
    const result = await request<T>('/query', { sql, params });
    const rows = Array.isArray(result) ? result : [];
    return rows[0] ?? { success: true, results: [] };
  }

  async function queryFirst<T = Record<string, unknown>>(sql: string, params: unknown[] = []) {
    const result = await query<T>(sql, params);
    return Array.isArray(result.results) ? (result.results[0] ?? null) : null;
  }

  return { query, queryFirst };
}
