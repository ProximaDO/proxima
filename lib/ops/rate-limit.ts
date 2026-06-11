type Entry = {
  count: number;
  resetAt: number;
};

type Result = {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
};

const store = new Map<string, Entry>();

export function consumeRateLimit(key: string, max: number, windowMs: number): Result {
  const now = Date.now();
  const current = store.get(key);

  if (!current || now >= current.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return {
      allowed: true,
      remaining: Math.max(0, max - 1),
      retryAfterSec: Math.ceil(windowMs / 1000),
    };
  }

  if (current.count >= max) {
    const retryAfterMs = Math.max(0, current.resetAt - now);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil(retryAfterMs / 1000)),
    };
  }

  current.count += 1;
  store.set(key, current);

  return {
    allowed: true,
    remaining: Math.max(0, max - current.count),
    retryAfterSec: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
  };
}
