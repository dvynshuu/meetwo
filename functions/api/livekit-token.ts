// Cloudflare Pages Function: /api/livekit-token
// Generates secure LiveKit room access tokens server-side using Web Crypto (HMAC-SHA256)

interface Env {
  LIVEKIT_API_KEY?: string;
  LIVEKIT_API_SECRET?: string;
}

function base64UrlEncodeBytes(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlEncodeString(str: string): string {
  const bytes = new TextEncoder().encode(str);
  return base64UrlEncodeBytes(bytes);
}

async function createLiveKitJwt(
  apiKey: string,
  apiSecret: string,
  identity: string,
  room: string,
  name?: string
): Promise<string> {
  const header = {
    alg: 'HS256',
    typ: 'JWT',
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: apiKey,
    sub: identity,
    name: name || identity,
    nbf: now - 10,
    exp: now + 24 * 60 * 60, // 24 hours validity
    video: {
      room: room,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    },
  };

  const headerB64 = base64UrlEncodeString(JSON.stringify(header));
  const payloadB64 = base64UrlEncodeString(JSON.stringify(payload));
  const dataToSign = `${headerB64}.${payloadB64}`;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(apiSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    enc.encode(dataToSign)
  );

  const signatureB64 = base64UrlEncodeBytes(new Uint8Array(signature));
  return `${dataToSign}.${signatureB64}`;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  try {
    const { request, env } = context;

    const apiKey = env.LIVEKIT_API_KEY;
    const apiSecret = env.LIVEKIT_API_SECRET;

    if (!apiKey || !apiSecret) {
      return new Response(
        JSON.stringify({
          error: 'LIVEKIT_API_KEY and LIVEKIT_API_SECRET must be configured in Cloudflare Pages Variables & secrets.',
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    const body = (await request.json()) as {
      room?: string;
      identity?: string;
      name?: string;
    };

    if (!body?.room || !body?.identity) {
      return new Response(
        JSON.stringify({ error: 'Both "room" and "identity" parameters are required.' }),
        { status: 400, headers: corsHeaders }
      );
    }

    const token = await createLiveKitJwt(
      apiKey,
      apiSecret,
      body.identity,
      body.room,
      body.name
    );

    return new Response(JSON.stringify({ token }), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || 'Failed to generate token' }),
      { status: 500, headers: corsHeaders }
    );
  }
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
};
