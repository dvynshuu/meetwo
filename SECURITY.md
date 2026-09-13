# Meetwo — Security & Authentication Architecture

Meetwo implements defense-in-depth across authentication, real-time media negotiation, workspace membership, and file storage.

---

## 1. LiveKit Token Endpoint Security (`functions/api/livekit-token.ts`)

In production, Meetwo connects to LiveKit SFU (`wss://meetwo-yaledeyd.livekit.cloud`). Media tokens granting room join permissions are generated exclusively through a secured Cloudflare Pages Function endpoint (`/api/livekit-token`).

### Security Controls:
1. **Authorization Header Enforcement**:
   - Every token request must supply an `Authorization: Bearer <supabase_access_token>` header.
   - Unauthenticated callers receive HTTP 401 Unauthorized immediately.
2. **Authoritative JWT Verification**:
   - The endpoint contacts the Supabase Auth server (`${SUPABASE_URL}/auth/v1/user`) to verify the JWT signature, claims, and active user status.
3. **Identity Match Verification**:
   - The token endpoint checks that the `identity` requested in the POST payload matches the authenticated user ID (`user.id`).
   - Callers cannot impersonate other users or acquire tokens under arbitrary identities.
4. **Restricted Room Scopes**:
   - Generated tokens grant access solely to the requested `roomId` with a bounded TTL.
   - API secret keys (`LIVEKIT_API_SECRET`) are stored in server-side environment variables and are never bundled into the client build.

---

## 2. Authentication & Session Lifecycle (`src/app/providers/AuthContext.tsx`)

1. **Production Identity Truth**:
   - In production (`isSupabaseConfigured === true`), users authenticate via Supabase Auth (Email/Password or magic link).
   - The `onAuthStateChange` listener synchronizes login, logout, and token refresh events across browser tabs.
2. **Zero Guest Personas on Logout**:
   - When a user logs out, the Supabase session is destroyed and `currentUser` is set to `null`.
   - The application does not silently invent fake "Guest" or mock personas in production.
3. **Calm Production Auth Gate (`AuthScreen.tsx`)**:
   - Unauthenticated visitors in production are greeted with a calm, high-craft authentication screen styled in Meetwo's Mineral Graphite aesthetic.
   - Application views and data remain protected behind the authentication gate.

---

## 3. Workspace Invites & Membership Protection (`src/app/providers/ServerContext.tsx`)

1. **No Direct Server Injection**:
   - `joinServer(serverId)` requires authoritative proof of membership:
     - The user must already exist in `server_members` for that `serverId`, or
     - The user must be the recorded `owner_id`.
   - Bypassing this check via raw server IDs throws an unauthorized error.
2. **Invite Code Resolution**:
   - New members join exclusively through validated invite links (`/invite/:code`).
   - Invites are checked for expiration (`expires_at`) and usage capacity (`uses_count >= max_uses`).

---

## 4. Storage & Attachment Security (`src/lib/services/storageService.ts`)

1. **Size Limits**:
   - Attachments are strictly validated client-side and capped at 25MB before upload.
2. **Storage Isolation**:
   - User uploads are organized by unique path prefixes (`attachments/${Date.now()}_${sanitizedFilename}`) to prevent path traversal and file collisions.
3. **Safe Fallback**:
   - If the storage bucket is inaccessible or restricted, files fall back safely to data URLs without exposing server internals.

---

## 5. Media Privacy & Hardware Security (`src/lib/webrtc/`)

1. **Track Teardown on Leave**:
   - When a user leaves a call or closes the browser tab, all media tracks (`MediaStreamTrack.stop()`) are explicitly terminated, releasing the hardware camera and microphone locks immediately.
2. **Hardware-Level Muting**:
   - Muting disables track transmission at the WebRTC sender level (`track.enabled = false`), ensuring zero audio/video packets leave the device while muted.
3. **Server-Authoritative Stage Moderation**:
   - Listeners in Stage channels cannot self-promote to speaker. All speaking permissions are validated through stage state management and moderation checks.
