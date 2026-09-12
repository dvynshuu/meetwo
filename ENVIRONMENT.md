# Meetwo V3.1 — Environment Configuration Guide

This document outlines environment variables, deployment tiers, and security constraints for Meetwo V3.1.

---

## 1. Environment Tiers

| Tier | Supabase Mode | Media Transport | Token Generation |
| :--- | :--- | :--- | :--- |
| **Development** | Zero-config `MockStore` or Local Supabase | Enhanced Direct Engine or Local LiveKit | Dynamic Token or Dev Fallback |
| **Staging** | Staging Supabase Project | LiveKit Cloud / SFU Staging | Supabase Edge Function (`livekit-token`) |
| **Production** | Production Supabase Project with RLS | LiveKit Cloud / Dedicated SFU | Server-Side Endpoint with JWT Verification |

---

## 2. Environment Variables Reference

### Application Configuration
```env
# Application environment mode
# Values: development | staging | production
VITE_APP_ENV=production
```

### Supabase Configuration
```env
# Supabase project URL
VITE_SUPABASE_URL=https://your-project.supabase.co

# Supabase public anonymous API key
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### LiveKit SFU Configuration
```env
# LiveKit SFU WebSocket endpoint (wss://...)
VITE_LIVEKIT_URL=wss://your-livekit-project.livekit.cloud

# Production Token Endpoint (Recommended):
# Resolves dynamic JWT access tokens per user and per room securely.
# If using Supabase Edge Functions, this defaults to:
# ${VITE_SUPABASE_URL}/functions/v1/livekit-token
VITE_LIVEKIT_TOKEN_ENDPOINT=https://your-project.supabase.co/functions/v1/livekit-token

# Staging / Dev Sandbox Token (Optional):
# Used only for single-user local debugging.
VITE_LIVEKIT_TOKEN=
```

---

## 3. Security Guidelines

1. **Client-Side Secret Ban**:
   - **NEVER** prefix private secrets with `VITE_`.
   - **NEVER** include `LIVEKIT_API_SECRET` or Supabase `SERVICE_ROLE_KEY` in frontend environment files.
   - All LiveKit access tokens must be minted server-side with user identity authorization.

2. **Supabase Row Level Security (RLS)**:
   - Ensure the database schema in `supabase/schema.sql` is applied with RLS policies enabled.
   - Client queries are authenticated using JWT sessions issued by Supabase Auth.
