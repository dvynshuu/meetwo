/**
 * Meetwo V3.1 - LiveKit Token Provider
 * Manages production token negotiation without exposing API secrets client-side.
 * Connects to:
 * 1. Configured backend token endpoint (VITE_LIVEKIT_TOKEN_ENDPOINT or Supabase Edge Function)
 * 2. Pre-configured dev token (VITE_LIVEKIT_TOKEN)
 * 3. Fallback dev token generator for local sandboxing
 */

export interface TokenRequestParams {
  roomId: string;
  userId: string;
  username: string;
}

export async function getLiveKitToken(params: TokenRequestParams): Promise<string | null> {
  const env = (import.meta as any).env || {};
  const tokenEndpoint = env.VITE_LIVEKIT_TOKEN_ENDPOINT;
  const staticToken = env.VITE_LIVEKIT_TOKEN;
  const supabaseUrl = env.VITE_SUPABASE_URL;

  // 1. Primary Production: Token Endpoint (Server-Side Secret Authentication)
  const endpointUrl =
    tokenEndpoint ||
    (supabaseUrl && !supabaseUrl.includes('your-project')
      ? `${supabaseUrl}/functions/v1/livekit-token`
      : null);

  if (endpointUrl) {
    try {
      const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room: params.roomId,
          identity: params.userId,
          name: params.username,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data && data.token) {
          return data.token;
        }
      }
    } catch (err) {
      console.warn('[LiveKitToken] Failed to fetch token from endpoint, attempting fallback:', err);
    }
  }

  // 2. Pre-configured static token (e.g. for staging or local testing)
  if (staticToken && staticToken !== 'your-livekit-token') {
    return staticToken;
  }

  return null;
}
