// Cloudflare Pages Function: /api/livekit-token
// Generates cryptographically signed LiveKit access tokens.
// Authenticates callers via Supabase JWT and enforces room authorization against PostgreSQL tables.

interface Env {
  LIVEKIT_API_KEY?: string;
  LIVEKIT_API_SECRET?: string;
  VITE_SUPABASE_URL?: string;
  SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
  SUPABASE_ANON_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
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

interface LiveKitPermissions {
  canPublish: boolean;
  canSubscribe: boolean;
  canPublishData: boolean;
}

async function createLiveKitJwt(
  apiKey: string,
  apiSecret: string,
  identity: string,
  room: string,
  name: string,
  permissions: LiveKitPermissions
): Promise<string> {
  const header = {
    alg: 'HS256',
    typ: 'JWT',
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: apiKey,
    sub: identity,
    name,
    nbf: now - 5,
    exp: now + 6 * 60 * 60, // 6 hours validity
    video: {
      room,
      roomJoin: true,
      canPublish: permissions.canPublish,
      canSubscribe: permissions.canSubscribe,
      canPublishData: permissions.canPublishData,
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

function getCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('Origin') || '';
  const isAllowedOrigin =
    origin.endsWith('meetwo.pages.dev') ||
    origin.startsWith('http://localhost:') ||
    origin.startsWith('http://127.0.0.1:');

  return {
    'Access-Control-Allow-Origin': isAllowedOrigin ? origin : 'https://meetwo.pages.dev',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  };
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request);

  try {
    const apiKey = env.LIVEKIT_API_KEY;
    const apiSecret = env.LIVEKIT_API_SECRET;
    const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
    const supabaseAnonKey = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;

    if (!apiKey || !apiSecret) {
      return new Response(
        JSON.stringify({
          error: 'LIVEKIT_CONFIGURATION_MISSING: LiveKit API credentials are not configured.',
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    if (!supabaseUrl || !supabaseAnonKey) {
      return new Response(
        JSON.stringify({
          error: 'SUPABASE_CONFIGURATION_MISSING: Supabase credentials are not configured.',
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    const body = (await request.json()) as {
      room?: string;
      identity?: string;
      name?: string;
    };

    if (!body?.room || typeof body.room !== 'string') {
      return new Response(
        JSON.stringify({ error: 'MISSING_ROOM: "room" parameter is required.' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // 1. Authenticate caller via Supabase JWT
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'UNAUTHORIZED: Missing or invalid Authorization header.' }),
        { status: 401, headers: corsHeaders }
      );
    }

    const userToken = authHeader.substring(7).trim();
    if (!userToken) {
      return new Response(
        JSON.stringify({ error: 'UNAUTHORIZED: Empty bearer token.' }),
        { status: 401, headers: corsHeaders }
      );
    }

    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${userToken}`,
      },
    });

    if (!userRes.ok) {
      return new Response(
        JSON.stringify({ error: 'UNAUTHORIZED: Invalid or expired Supabase session token.' }),
        { status: 401, headers: corsHeaders }
      );
    }

    const userData: any = await userRes.json();
    if (!userData || !userData.id) {
      return new Response(
        JSON.stringify({ error: 'UNAUTHORIZED: Unable to determine caller identity.' }),
        { status: 401, headers: corsHeaders }
      );
    }

    const authenticatedUserId = userData.id as string;
    const authenticatedUserName =
      userData.user_metadata?.display_name ||
      userData.user_metadata?.username ||
      userData.email?.split('@')[0] ||
      body.name ||
      'User';

    // Verify claimed identity matches verified JWT identity
    if (body.identity && body.identity !== authenticatedUserId) {
      return new Response(
        JSON.stringify({ error: 'IDENTITY_MISMATCH: Claimed identity does not match verified user.' }),
        { status: 403, headers: corsHeaders }
      );
    }

    const roomId = body.room.trim();

    // 2. Authorize Room Access
    // Default permissions: full publish for voice / DM, restricted for Stage audience
    let permissions: LiveKitPermissions = {
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    };

    // Use caller token to query PostgREST (enforces RLS automatically)
    const dbHeaders = {
      'apikey': supabaseAnonKey,
      'Authorization': `Bearer ${userToken}`,
      'Content-Type': 'application/json',
    };

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(roomId);

    if (isUuid) {
      // Check if room is a Channel
      const chanRes = await fetch(
        `${supabaseUrl}/rest/v1/channels?id=eq.${roomId}&select=id,server_id,type`,
        { headers: dbHeaders }
      );

      if (chanRes.ok) {
        const channels: any[] = await chanRes.json();
        if (channels && channels.length > 0) {
          const channel = channels[0];

          // Verify user is member or owner of the server
          const memRes = await fetch(
            `${supabaseUrl}/rest/v1/server_members?server_id=eq.${channel.server_id}&user_id=eq.${authenticatedUserId}&select=role`,
            { headers: dbHeaders }
          );
          const members: any[] = memRes.ok ? await memRes.json() : [];

          // Also check if user is server owner
          const srvRes = await fetch(
            `${supabaseUrl}/rest/v1/servers?id=eq.${channel.server_id}&owner_id=eq.${authenticatedUserId}&select=id`,
            { headers: dbHeaders }
          );
          const srvs: any[] = srvRes.ok ? await srvRes.json() : [];

          const isMember = members.length > 0 || srvs.length > 0;
          if (!isMember) {
            return new Response(
              JSON.stringify({ error: 'FORBIDDEN: User is not a member of this workspace.' }),
              { status: 403, headers: corsHeaders }
            );
          }

          // If Stage channel, verify speaker/moderator status
          if (channel.type === 'stage') {
            const isServerAdmin =
              srvs.length > 0 ||
              (members[0] && (members[0].role === 'owner' || members[0].role === 'admin' || members[0].role === 'moderator'));

            let isStageSpeaker = isServerAdmin;

            if (!isStageSpeaker) {
              const stageRes = await fetch(
                `${supabaseUrl}/rest/v1/stage_states?channel_id=eq.${channel.id}&select=host_id,speakers`,
                { headers: dbHeaders }
              );
              if (stageRes.ok) {
                const stages: any[] = await stageRes.json();
                if (stages && stages.length > 0) {
                  const stage = stages[0];
                  if (stage.host_id === authenticatedUserId || (Array.isArray(stage.speakers) && stage.speakers.includes(authenticatedUserId))) {
                    isStageSpeaker = true;
                  }
                }
              }
            }

            // Audience gets subscribe & data only
            permissions = {
              canPublish: isStageSpeaker,
              canSubscribe: true,
              canPublishData: true,
            };
          }
        } else {
          // If not a channel, check if room is a DM Conversation
          const dmRes = await fetch(
            `${supabaseUrl}/rest/v1/dm_participants?conversation_id=eq.${roomId}&user_id=eq.${authenticatedUserId}&select=conversation_id`,
            { headers: dbHeaders }
          );
          const dmParts: any[] = dmRes.ok ? await dmRes.json() : [];

          if (dmParts.length === 0) {
            return new Response(
              JSON.stringify({ error: 'FORBIDDEN: Room not found or user is not an authorized participant.' }),
              { status: 403, headers: corsHeaders }
            );
          }
        }
      }
    }

    // 3. Generate signed, scoped LiveKit JWT
    const token = await createLiveKitJwt(
      apiKey,
      apiSecret,
      authenticatedUserId,
      roomId,
      authenticatedUserName,
      permissions
    );

    return new Response(
      JSON.stringify({
        token,
        identity: authenticatedUserId,
        name: authenticatedUserName,
        permissions,
      }),
      {
        status: 200,
        headers: corsHeaders,
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || 'Failed to generate token' }),
      { status: 500, headers: corsHeaders }
    );
  }
};

export const onRequestOptions: PagesFunction = async (context) => {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(context.request),
  });
};
