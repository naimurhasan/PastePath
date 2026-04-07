import type { AnnotatedImage } from '@/types/annotation';

const API_BASE = import.meta.env.VITE_API_BASE_URL as string | undefined;

function getApiBase(): string | null {
  if (API_BASE && API_BASE.trim().length > 0) {
    return API_BASE.replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined') {
    const { hostname, origin } = window.location;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:4173';
    }
    return origin.replace(/\/+$/, '');
  }
  return null;
}

async function requestApi<T>(path: string, body: unknown): Promise<T> {
  const base = getApiBase();
  if (base === null) {
    throw new Error('API base URL is not configured');
  }

  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const responseBody = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      typeof responseBody?.error === 'string'
        ? responseBody.error
        : 'Request failed';
    throw new Error(message);
  }

  return responseBody as T;
}

export async function createShare(payload: {
  title: string;
  password: string | null;
  data: { images: unknown[] };
  auto_delete_at: string | null;
}): Promise<{ id: string }> {
  return requestApi('/api/shares/create', payload);
}

export async function viewShare(payload: {
  id: string;
  password?: string | null;
}): Promise<{
  id?: string;
  title?: string | null;
  data?: { images?: AnnotatedImage[] };
  view_count?: number;
  status: string;
  requires_password: boolean;
  access_granted: boolean;
}> {
  return requestApi('/api/shares/view', payload);
}
