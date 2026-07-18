const DEFAULT_RATE_LIMIT_PER_MINUTE = 30;
const DEFAULT_RATE_LIMIT_WINDOW_MS = 60000;

function readEnvNumber(envVar: string, fallback: number): number {
  const raw = process.env[envVar];
  const parsed = raw !== undefined ? Number(raw) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getRateLimitPerMinute(): number {
  return readEnvNumber("MCP_RATE_LIMIT_PER_MINUTE", DEFAULT_RATE_LIMIT_PER_MINUTE);
}

export function getRateLimitWindowMs(): number {
  return readEnvNumber("MCP_RATE_LIMIT_WINDOW_MS", DEFAULT_RATE_LIMIT_WINDOW_MS);
}

interface Window {
  windowStartMs: number;
  count: number;
}

const windows = new Map<string, Window>();

export function checkRateLimit(tokenId: string): { allowed: boolean; retryAfterMs?: number } {
  const now = Date.now();
  const limit = getRateLimitPerMinute();
  const windowMs = getRateLimitWindowMs();

  let entry = windows.get(tokenId);
  if (!entry || now - entry.windowStartMs >= windowMs) {
    entry = { windowStartMs: now, count: 0 };
    windows.set(tokenId, entry);
  }

  entry.count += 1;

  if (entry.count > limit) {
    return { allowed: false, retryAfterMs: windowMs - (now - entry.windowStartMs) };
  }

  return { allowed: true };
}
