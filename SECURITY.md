# Meetwo — Security & Authentication Architecture

Meetwo implements defense-in-depth across authentication, real-time media negotiation, workspace membership, and database access.

---

## 1. Authoritative LiveKit SFU Token Security (`functions/api/livekit-token.ts`)

In production, Meetwo connects to LiveKit SFU (`wss://meetwo-yaledeyd.livekit.cloud`). Media tokens are generated exclusively through a secured Cloudflare Pages Function endpoint (`/api/livekit-token`).

### Security Controls:
1. **Zero Development Backdoors**:
   - The insecure `identity.startsWith('dev-')` mock token bypass has been permanently removed.
   - Every request requires a valid Supabase JWT bearer token.
2. **Authoritative JWT Cryptographic Verification**:
   - The endpoint validates caller identity by calling `${SUPABASE_URL}/auth/v1/user` with the caller's bearer token.
   - The token's user identity (`user.id`) MUST match the requested participant identity. Impersonation is rejected with HTTP 403.
3. **Room Authorization Enforcement**:
   - Before issuing a token, the endpoint verifies the caller has permission to enter `roomId`:
     - For server channels: queries PostgreSQL to confirm the caller is an active member in `server_members` for the channel's server.
     - For direct message conversations: queries PostgreSQL to confirm the caller is listed in `dm_participants` for that conversation.
   - Non-members are rejected with HTTP 403 Forbidden.
4. **Scoped Stage Grants**:
   - For stage channels, tokens issued to general audience members explicitly set `canPublish: false`.
   - Only approved stage speakers and hosts receive `canPublish: true`.
5. **Secret Protection**:
   - `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET` reside solely in server environment variables and are never exposed to the client.

---

## 2. Authentication & Session Lifecycle (`src/app/providers/AuthContext.tsx`)

1. **Production Identity Truth**:
   - In production (`isSupabaseConfigured === true`), authentication is backed by Supabase Auth (`auth.users`).
   - Sessions are restored on page reload; auth state changes broadcast across tabs.
2. **Zero Fake Personas on Logout**:
   - Logging out completely destroys the Supabase session and resets `currentUser` to `null`.
   - No mock user or fallback persona is substituted in production.
3. **Protected Navigation Gate**:
   - Unauthenticated visitors are presented with `AuthScreen.tsx` styled in Meetwo's Obsidian aesthetic.
   - Application workspaces, calls, and chat views are guarded behind authenticated state.

---

## 3. Workspace Invites & Membership Protection

1. **Atomic PostgreSQL RPC (`join_server_with_invite`)**:
   - Client direct `INSERT` onto `server_members` is restricted to server creators creating their workspace.
   - All other joins must execute `join_server_with_invite(p_code)` with a valid, non-expired invite code.
   - Direct `UPDATE` of `invites.uses_count` is revoked from public roles and executed exclusively inside the atomic RPC.
2. **RLS Row-Level Security**:
   - Server channels, messages, and stage states are restricted to verified `server_members`.
   - DM conversations and messages are restricted to `dm_participants`.

---

## 4. File Storage Security (`src/lib/services/storageService.ts`)

1. **Strict Client-Side Validation**:
   - Files exceeding 25MB are rejected prior to network transmission.
2. **MIME & Name Sanitization**:
   - File extensions and names are sanitized to prevent directory traversal attacks.
3. **Secure Bucket Policy**:
   - Supabase Storage bucket `attachments` enforces authenticated uploads and public reads for channel participants.
