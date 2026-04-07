const D1_API_BASE = 'https://api.cloudflare.com/client/v4';
const MAX_RETRIES = 4;
const BASE_RETRY_DELAY_MS = 750;
const MAX_RETRY_DELAY_MS = 5_000;
const DEFAULT_D1_REQUEST_TIMEOUT_MS = 15_000;

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

function getEnvNumber(name: string, fallback: number) {
  const value = process.env[name];
  if (!value) return fallback;

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
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
  const isDebugMode = process.env.MODE === 'debug' || process.env.SHARE_SERVER_MODE === 'debug';
  const requestTimeoutMs = getEnvNumber('D1_REQUEST_TIMEOUT_MS', DEFAULT_D1_REQUEST_TIMEOUT_MS);

  async function request<T = Record<string, unknown>>(path: string, payload: unknown) {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
      let response: Response;

      if (isDebugMode) {
        console.log('D1 request start:', path, 'attempt=', attempt + 1, 'timeoutMs=', requestTimeoutMs);
      }

      try {
        response = await fetch(`${baseUrl}${path}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
      } catch (error) {
        if (controller.signal.aborted) {
          throw new Error(`Cloudflare D1 request timed out after ${requestTimeoutMs}ms`);
        }
        throw error;
      } finally {
        clearTimeout(timeout);
      }

      if (isDebugMode) {
        console.log('D1 response:', path, 'attempt=', attempt + 1, 'status=', response.status);
      }

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
        const retryDelay = Math.min(
          retryAfterSeconds > 0 ? retryAfterSeconds * 1000 : fallbackDelay,
          MAX_RETRY_DELAY_MS,
        );
        if (isDebugMode) {
          console.log('D1 retry:', path, 'attempt=', attempt + 1, 'delayMs=', retryDelay, 'message=', message);
        }
        await sleep(retryDelay);
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
    if (isDebugMode) {
      console.log('D1 query:', sql.trim().replace(/\s+/g, ' ').slice(0, 120), 'params=', params.length);
    }

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
