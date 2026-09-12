/**
 * Meetwo V3.2 - High-Performance LiveKit Token Provider
 * Features:
 * - Sub-millisecond in-memory token caching (20-hour TTL)
 * - Fast-fail AbortController (2.5s network timeout)
 * - Multi-tiered endpoint fallback (Cloudflare Pages Function -> Supabase Edge Function -> Dev static)
 */

export interface TokenRequestParams {
  roomId: string;
  userId: string;
  username: string;
}

interface CachedToken {
  token: string;
  expiresAt: number;
}

// In-memory cache keyed by "roomId:userId" to prevent redundant network fetches
const tokenCache = new Map<string, CachedToken>();

/**
 * Invalidate cached token for a specific room or clear entire cache.
 */
export function invalidateLiveKitToken(roomId?: string, userId?: string): void {
  if (roomId && userId) {
    tokenCache.delete(`${roomId}:${userId}`);
  } else if (roomId) {
    for (const key of tokenCache.keys()) {
      if (key.startsWith(`${roomId}:`)) {
        tokenCache.delete(key);
      }
    }
  } else {
    tokenCache.clear();
  }
}

export async function getLiveKitToken(params: TokenRequestParams): Promise<string | null> {
  const cacheKey = `${params.roomId}:${params.userId}`;

  // 1. Check in-memory cache (0ms instant return if valid)
  const cached = tokenCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.token;
  }

  const env = (import.meta as any).env || {};
  const tokenEndpoint = env.VITE_LIVEKIT_TOKEN_ENDPOINT;
  const staticToken = env.VITE_LIVEKIT_TOKEN;
  const supabaseUrl = env.VITE_SUPABASE_URL;

  // 2. Candidate token endpoints (prioritizing same-origin Cloudflare Pages Function)
  const candidateEndpoints: string[] = [];
  if (tokenEndpoint) candidateEndpoints.push(tokenEndpoint);
  candidateEndpoints.push('/api/livekit-token');
  if (supabaseUrl && !supabaseUrl.includes('your-project')) {
    candidateEndpoints.push(`${supabaseUrl}/functions/v1/livekit-token`);
  }

  for (const endpoint of candidateEndpoints) {
    // 2.5s timeout controller to prevent connection hangs on slow networks
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room: params.roomId,
          identity: params.userId,
          name: params.username,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        if (data && data.token) {
          // Cache token for 20 hours (tokens expire in 24 hours)
          tokenCache.set(cacheKey, {
            token: data.token,
            expiresAt: Date.now() + 20 * 60 * 60 * 1000,
          });
          return data.token;
        }
      }
    } catch {
      clearTimeout(timeoutId);
      // Fast fallback to next candidate endpoint
    }
  }

  // 3. Pre-configured static token (e.g. for staging or local testing)
  if (staticToken && staticToken !== 'your-livekit-token') {
    return staticToken;
  }

  return null;
}
