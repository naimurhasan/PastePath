import crypto from 'node:crypto';
import express, { type Response } from 'express';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { createD1Client, type D1Client } from './d1-client.ts';
import { buildOgHtml, isBotRequest } from './og-html.ts';
import { createD1ShareRepository, type ShareRepository } from './share-repository.ts';
import { ensureSchema } from './schema-migrations.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const distDir = path.join(projectRoot, 'dist');
const indexHtmlPath = path.join(distDir, 'index.html');

const port = Number(process.env.SHARE_SERVER_PORT || process.env.PORT || 4173);
const siteUrl = (process.env.VITE_PUBLIC_SITE_URL || 'http://localhost:4173').replace(/\/+$/, '');
const frontendOrigin = process.env.FRONTEND_ORIGIN?.replace(/\/+$/, '') || 'http://localhost:5173';
const publicOgImageUrl = `${siteUrl}/og-image.png`;
const isDebugMode = process.env.MODE === 'debug' || process.env.SHARE_SERVER_MODE === 'debug';

const MAX_TITLE_LENGTH = 200;
const MAX_PASSWORD_LENGTH = 200;
const MAX_IMAGES_PER_SHARE = 20;
const MAX_SHARE_PAYLOAD_BYTES = 25 * 1024 * 1024;
const CREATE_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const CREATE_RATE_LIMIT_MAX = 30;

let d1: D1Client | null = null;
let shareRepository: ShareRepository | null = null;
let d1InitError: unknown = null;

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function debugLog(...args: unknown[]) {
  if (isDebugMode) {
    console.log(...args);
  }
}

function debugError(...args: unknown[]) {
  if (isDebugMode) {
    console.error(...args);
  }
}

try {
  d1 = createD1Client();
  shareRepository = createD1ShareRepository(d1);
} catch (error) {
  d1InitError = error;
  console.warn(getErrorMessage(error));
}

const app = express();
app.use((req, _res, next) => {
  debugLog(
    new Date().toISOString(),
    req.method,
    req.url,
    'content-length=',
    req.headers['content-length'] || 'unknown',
  );
  next();
});
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
app.use((_req, res, next) => {
  res.header('X-Content-Type-Options', 'nosniff');
  res.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});
app.use((req, res, next) => {
  const origin = req.get('origin');
  if (origin && (origin === frontendOrigin || origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:'))) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Vary', 'Origin');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  }

  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }

  next();
});

const shareIdRegex = /^[a-f0-9]{8}$/i;
const createAttemptsByIp = new Map<string, { count: number; resetAt: number }>();

function getD1() {
  if (!d1) {
    throw d1InitError || new Error('Cloudflare D1 is not configured');
  }
  return d1;
}

function getShareRepository(): ShareRepository {
  getD1();
  if (!shareRepository) {
    throw new Error('Share repository is not configured');
  }
  return shareRepository;
}

function isExpired(autoDeleteAt: string | null | undefined) {
  return Boolean(autoDeleteAt && new Date(autoDeleteAt).getTime() <= Date.now());
}

function isValidAutoDeleteAt(value: unknown) {
  if (value === null || value === undefined || value === '') return true;
  if (typeof value !== 'string') return false;
  const time = new Date(value).getTime();
  return Number.isFinite(time) && time > Date.now();
}

function checkCreateRateLimit(req: express.Request) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const existing = createAttemptsByIp.get(ip);

  if (!existing || now > existing.resetAt) {
    createAttemptsByIp.set(ip, { count: 1, resetAt: now + CREATE_RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (existing.count >= CREATE_RATE_LIMIT_MAX) {
    return false;
  }

  existing.count += 1;
  return true;
}

async function getShareMetadata(repository: ShareRepository, shareId: string) {
  try {
    const share = await repository.findMetadataById(shareId);

    if (!share) {
      return { status: 'not_found', title: 'Share not found' };
    }

    if (share.deleted_at) {
      return { status: 'deleted', title: share.title || 'Share unavailable' };
    }

    if (isExpired(share.auto_delete_at)) {
      return { status: 'expired', title: share.title || 'Share expired' };
    }

    return {
      status: 'ok',
      title: share.title || 'Shared annotation',
    };
  } catch (error) {
    console.error('Metadata lookup failed:', error);
    return { status: 'server_not_configured', title: 'Shared annotation' };
  }
}

function sendSpaIndex(res: Response) {
  if (!existsSync(indexHtmlPath)) {
    res.status(503).send('Build output is missing. Run pnpm build before starting the share server.');
    return;
  }

  res.sendFile(indexHtmlPath);
}

if (existsSync(distDir)) {
  app.use(express.static(distDir, { index: false }));
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, database: d1 ? 'configured' : 'missing_env' });
});

app.post('/api/shares/create', async (req, res) => {
  try {
    debugLog('create route hit');
    debugLog('body keys:', Object.keys(req.body || {}));
    debugLog('title:', req.body?.title);
    debugLog('images:', req.body?.data?.images?.length);
    debugLog('payload chars:', JSON.stringify(req.body || {}).length);

    const repository = getShareRepository();
    const { title, password, data, auto_delete_at } = req.body;

    if (!checkCreateRateLimit(req)) {
      return res.status(429).json({ error: 'Too many share links created. Please try again later.' });
    }

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json({ error: 'Title is required' });
    }
    if (title.length > MAX_TITLE_LENGTH) {
      return res.status(400).json({ error: 'Title too long' });
    }
    if (!data?.images || !Array.isArray(data.images) || data.images.length === 0) {
      return res.status(400).json({ error: 'At least one image required' });
    }
    if (data.images.length > MAX_IMAGES_PER_SHARE) {
      return res.status(400).json({ error: 'Max 20 images' });
    }
    if (password && (typeof password !== 'string' || password.length > MAX_PASSWORD_LENGTH)) {
      return res.status(400).json({ error: 'Invalid password' });
    }
    if (!isValidAutoDeleteAt(auto_delete_at)) {
      return res.status(400).json({ error: 'Invalid auto-delete date' });
    }

    const serializedData = JSON.stringify(data);
    if (Buffer.byteLength(serializedData, 'utf8') > MAX_SHARE_PAYLOAD_BYTES) {
      return res.status(413).json({ error: 'Payload too large. Try fewer or smaller images.' });
    }

    const shareId = crypto.randomUUID().slice(0, 8);

    let passwordHash = null;
    if (password && password.length > 0) {
      const salt = await bcrypt.genSalt(12);
      passwordHash = await bcrypt.hash(password, salt);
    }

    debugLog('before insert');
    await repository.createShare({
      id: shareId,
      title: title.trim(),
      data,
      passwordHash,
      autoDeleteAt: auto_delete_at || null,
    });
    debugLog('after insert');

    return res.json({ id: shareId });
  } catch (error) {
    console.error('Create share error:', error);
    if (getErrorMessage(error).includes('environment variable')) {
      return res.status(503).json({ error: 'Server not configured' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/shares/view', async (req, res) => {
  try {
    const repository = getShareRepository();
    const { id, password } = req.body;

    if (!id || typeof id !== 'string' || !shareIdRegex.test(id)) {
      return res.status(400).json({ error: 'Invalid request' });
    }

    const share = await repository.findById(id);

    if (!share) {
      return res.json({ status: 'not_found', requires_password: false, access_granted: false });
    }

    if (share.deleted_at) {
      return res.json({ status: 'deleted', title: share.title, requires_password: false, access_granted: false });
    }

    if (isExpired(share.auto_delete_at)) {
      return res.json({ status: 'expired', title: share.title, requires_password: false, access_granted: false });
    }

    if (share.password_hash) {
      if (!password) {
        return res.json({ status: 'password_required', title: share.title, requires_password: true, access_granted: false });
      }

      const passwordValid = await bcrypt.compare(password, share.password_hash);
      if (!passwordValid) {
        return res.json({ status: 'password_required', title: share.title, requires_password: true, access_granted: false });
      }
    }

    await repository.incrementViewCount(id);

    return res.json({
      status: 'ok',
      id: share.id,
      title: share.title,
      data: share.data,
      view_count: share.view_count + 1,
      requires_password: !!share.password_hash,
      access_granted: true,
    });
  } catch (error) {
    console.error('View share error:', error);
    if (getErrorMessage(error).includes('environment variable')) {
      return res.status(503).json({ error: 'Server not configured' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/view/:id', async (req, res) => {
  const userAgent = req.get('user-agent') || '';

  if (!isBotRequest(userAgent)) {
    sendSpaIndex(res);
    return;
  }

  const shareId = req.params.id;
  const metadata = await getShareMetadata(getShareRepository(), shareId);
  const viewUrl = `${siteUrl}/view/${encodeURIComponent(shareId)}`;

  const description =
    metadata.status === 'ok'
      ? 'View this shared annotation from PastePath.'
      : 'This shared annotation is unavailable.';

  const html = buildOgHtml({
    title: metadata.title,
    description,
    url: viewUrl,
    imageUrl: publicOgImageUrl,
  });

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

app.use((error: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
  debugError('request failed:', req.method, req.url, error);

  if (res.headersSent) {
    next(error);
    return;
  }

  if (getErrorMessage(error).includes('request entity too large')) {
    res.status(413).json({ error: 'Payload too large. Try fewer or smaller images.' });
    return;
  }

  res.status(500).json({ error: 'Internal server error' });
});

app.get('*', (_req, res) => {
  sendSpaIndex(res);
});

if (isDebugMode) {
  process.on('uncaughtException', (err) => {
    console.error('uncaughtException:', err);
  });

  process.on('unhandledRejection', (err) => {
    console.error('unhandledRejection:', err);
  });
}

ensureSchema(getD1())
  .then(() => {
    app.listen(port, () => {
      console.log(`Share metadata server listening on http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.error('Failed to initialize Cloudflare D1 schema:', error);
    process.exit(1);
  });
