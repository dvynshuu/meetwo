# Meetwo — Production Deployment & Infrastructure Guide

This guide covers deploying Meetwo to production on **Cloudflare Pages**, configuring **Supabase (PostgreSQL & Auth)**, and integrating **LiveKit Cloud SFU**.

---

## 1. Architecture & Infrastructure Topology

```text
┌─────────────────────────────────────────────────────────────┐
│                   CLOUDFLARE PAGES EDGE                     │
│                                                             │
│  Static Client SPA              Pages Function              │
│  (meetwo.pages.dev)      ───►   (/api/livekit-token)        │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
               │ (Direct Client Connection)   │ (Authoritative JWT Verification)
               ▼                              ▼
┌──────────────────────────────┐ ┌────────────────────────────┐
│      SUPABASE BACKEND        │ │       LIVEKIT SFU          │
│                              │ │                            │
│ - PostgreSQL 15 + RLS        │ │ - Low-latency SFU          │
│ - Auth & Session JWTs        │ │ - 1080p, 30fps Video       │
│ - Realtime CDC Subscriptions │ │ - Opus 320kbps Audio       │
│ - Storage Bucket: attachments│ │ - Dynamic adaptation       │
└──────────────────────────────┘ └────────────────────────────┘
```

---

## 2. Environment Variables

### A. Client Build Environment (`.env` or Cloudflare Pages Build Variables)

These variables are prefixed with `VITE_` and are bundled into the static client:

| Variable | Description | Production Example |
|---|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL | `https://bbsniwtqahigsnqcwkzl.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Public Supabase anon/public key | `eyJhbGciOiJIUzI1NiIsInR5cCI6...` |
| `VITE_LIVEKIT_URL` | LiveKit SFU WebSocket gateway | `wss://meetwo-yaledeyd.livekit.cloud` |
| `VITE_LIVEKIT_TOKEN_ENDPOINT`| Relative or absolute token endpoint | `/api/livekit-token` |
| `VITE_APP_ENV` | Environment identifier | `production` |

### B. Serverless Runtime Secrets (Cloudflare Pages Function Settings)

Configure these secrets in **Cloudflare Pages Dashboard -> Settings -> Environment Variables**:

| Variable | Description | Security Level |
|---|---|---|
| `LIVEKIT_API_KEY` | LiveKit project API key | Secret |
| `LIVEKIT_API_SECRET` | LiveKit project API secret | Secret (Never expose to client) |
| `SUPABASE_URL` | Supabase project URL | Variable |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role secret | Secret (For privileged admin tasks) |

---

## 3. Database Setup & Migration

1. Open the [Supabase Dashboard](https://supabase.com/dashboard) and select your project.
2. Navigate to **SQL Editor**.
3. Open [`supabase/migrations/001_production_schema.sql`](file:///c:/CodeBase/Projects/meetwo/supabase/migrations/001_production_schema.sql).
4. Run the query. It is fully idempotent and creates:
   - `categories`, `bookmarks`, `threads`, `thread_messages`
   - `forum_posts`, `forum_replies`
   - `dm_conversations`, `dm_participants`, `dm_messages`
   - `friends`, `friend_requests`, `read_states`
   - RLS security policies and `REPLICA IDENTITY FULL`
5. Navigate to **Storage**:
   - Create a public bucket named `attachments`.
   - Add policy: allow authenticated users to `INSERT` and `SELECT`.
6. Navigate to **Database -> Replication**:
   - Confirm `messages`, `message_reactions`, `thread_messages`, `forum_posts`, and `dm_messages` are included in the `supabase_realtime` publication.

---

## 4. Continuous Deployment via Cloudflare Pages

### Build Configuration
- **Framework Preset**: Vite
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Node.js Version**: `18` or `20` (Set `NODE_VERSION: 20` in Environment Variables)

### Verification Commands
Before pushing to production, verify locally:
```bash
# 1. Full TypeScript check and Vite production bundle
npm run build

# 2. Local preview server
npm run preview
```

---

## 5. Production Health Checks & Diagnostics

1. **Token Endpoint Health**:
   ```bash
   curl -X POST https://meetwo.pages.dev/api/livekit-token \
     -H "Content-Type: application/json" \
     -d '{"room":"test-room","identity":"test-user"}'
   ```
   *Expected result*: HTTP 401 Unauthorized (`Authorization header required`).

2. **Call Diagnostics (`Ctrl+Shift+D`)**:
   - Press `Ctrl+Shift+D` inside any voice or stage room to inspect measured RTT, packet loss, codec profiles, and candidate pairs.

3. **Authentication Gate**:
   - Visiting `meetwo.pages.dev` while logged out displays the calm `AuthScreen.tsx` without leaking workspace or channel data.
