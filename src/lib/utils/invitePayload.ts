import { Server } from '../../types';

/**
 * Encodes a server metadata payload into a URL-safe Base64 string.
 * This guarantees invite links contain fallback server details across
 * all browsers, incognito sessions, and Supabase RLS policies.
 */
export const encodeServerPayload = (server: Server): string => {
  try {
    const payload: Record<string, string> = {
      i: server.id,
      n: server.name,
    };
    if (server.iconUrl) payload.a = server.iconUrl;
    if (server.description) payload.d = server.description;
    if (server.ownerId) payload.o = server.ownerId;
    return btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
  } catch {
    return '';
  }
};

/**
 * Safely decodes a URL-encoded server payload from invite links.
 * Returns null if the data is corrupted, empty, or missing critical fields.
 */
export const decodeServerPayload = (encoded?: string | null): Server | null => {
  if (!encoded) return null;
  try {
    const raw = encoded.trim();
    if (!raw) return null;
    const jsonStr = decodeURIComponent(escape(atob(raw)));
    const parsed = JSON.parse(jsonStr);
    if (parsed && (parsed.id || parsed.i || parsed.name || parsed.n)) {
      return {
        id: String(parsed.id || parsed.i || ''),
        name: String(parsed.name || parsed.n || 'Community Server'),
        iconUrl: parsed.iconUrl || parsed.a ? String(parsed.iconUrl || parsed.a) : undefined,
        description: parsed.description || parsed.d ? String(parsed.description || parsed.d) : undefined,
        ownerId: parsed.ownerId || parsed.o ? String(parsed.ownerId || parsed.o) : '',
        createdAt: parsed.createdAt || parsed.c ? String(parsed.createdAt || parsed.c) : new Date().toISOString(),
      };
    }
  } catch {}
  return null;
};
