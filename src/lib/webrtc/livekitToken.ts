/**
 * Meetwo V3 Production - LiveKit Token Provider
 * Features:
 * - Sub-millisecond in-memory token caching with TTL
 * - Fast-fail AbortController (3s timeout)
 * - Authenticated Supabase JWT pass-through
 * - Authoritative room authorization error propagation
 */

import { supabase, isSupabaseConfigured } from '../supabase/client';

export interface TokenRequestParams {
  roomId: string;
  userId: string;
  username: string;
}

interface CachedToken {
  token: string;
  expiresAt: number;
}

const tokenCache = new Map<string, CachedToken>();

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

  // 1. Check in-memory cache
  const cached = tokenCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.token;
  }

  const env = (import.meta as any).env || {};
  const tokenEndpoint = env.VITE_LIVEKIT_TOKEN_ENDPOINT;
  const staticToken = env.VITE_LIVEKIT_TOKEN;
  const supabaseUrl = env.VITE_SUPABASE_URL;

  // Retrieve current Supabase session token
  let authToken: string | null = null;
  try {
    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.access_token) {
        authToken = data.session.access_token;
      }
    }
  } catch {}

  // Pre-configured static token check
  if (staticToken && staticToken !== 'your-livekit-token') {
    return staticToken;
  }

  // If no auth token is present (e.g. demo mode / unauthenticated), cannot mint server-signed LiveKit JWT
  if (!authToken) {
    console.info('[LiveKitToken] No active Supabase session token found; skipping LiveKit token request.');
    return null;
  }

  // Candidate token endpoints
  const candidateEndpoints: string[] = [];
  if (tokenEndpoint && !tokenEndpoint.startsWith('/')) {
    candidateEndpoints.push(tokenEndpoint);
  }
  // Local Vite proxy or same-origin Cloudflare Pages route
  candidateEndpoints.push('/api/livekit-token');
  // Direct production endpoint fallback
  if (!candidateEndpoints.includes('https://meetwo.pages.dev/api/livekit-token')) {
    candidateEndpoints.push('https://meetwo.pages.dev/api/livekit-token');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${authToken}`,
  };

  let lastError: string | null = null;

  for (const endpoint of candidateEndpoints) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
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
          tokenCache.set(cacheKey, {
            token: data.token,
            expiresAt: Date.now() + 5 * 60 * 60 * 1000,
          });
          return data.token;
        }
      } else {
        const errJson = await response.json().catch(() => null);
        lastError = errJson?.error || `HTTP ${response.status}: ${response.statusText}`;
        console.warn(`[LiveKitToken] Token request to ${endpoint} returned ${response.status}:`, lastError);

        // If forbidden (e.g., user not a room member), don't try other endpoints
        if (response.status === 403) {
          throw new Error(lastError || 'Access denied to voice/video room.');
        }
      }
    } catch (e: any) {
      clearTimeout(timeoutId);
      if (e.message?.includes('Access denied') || e.message?.includes('FORBIDDEN')) {
        throw e;
      }
      lastError = e.message || 'Network error connecting to token endpoint';
    }
  }

  if (lastError) {
    console.warn(`[LiveKitToken] All token endpoints failed: ${lastError}`);
  }

  return null;
}
