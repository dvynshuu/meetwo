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

  // Candidate token endpoints
  const candidateEndpoints: string[] = [];
  if (tokenEndpoint) candidateEndpoints.push(tokenEndpoint);
  candidateEndpoints.push('/api/livekit-token');
  if (supabaseUrl && !supabaseUrl.includes('your-project')) {
    candidateEndpoints.push(`${supabaseUrl}/functions/v1/livekit-token`);
  }

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

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  let lastError: string | null = null;

  for (const endpoint of candidateEndpoints) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

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

        // If forbidden or unauthorized, don't fall through to other endpoints
        if (response.status === 401 || response.status === 403) {
          throw new Error(lastError || 'Access denied to voice/video room.');
        }
      }
    } catch (e: any) {
      clearTimeout(timeoutId);
      if (e.message?.includes('Access denied') || e.message?.includes('FORBIDDEN') || e.message?.includes('UNAUTHORIZED')) {
        throw e;
      }
    }
  }

  // Pre-configured static token (local development fallback only)
  if (staticToken && staticToken !== 'your-livekit-token') {
    return staticToken;
  }

  if (lastError) {
    throw new Error(`LIVEKIT_TOKEN_ERROR: ${lastError}`);
  }

  return null;
}
