# Meetwo — Database Architecture & Repository Pattern

Meetwo uses **Supabase (PostgreSQL 15+)** as its authoritative, primary persistence layer with Row-Level Security (RLS) policies, Realtime Change Data Capture (CDC), and atomic PostgreSQL RPC functions.

---

## 1. Authoritative Production Hierarchy

1. **Identity & Auth**: Supabase Auth (`auth.users`) linked directly to `public.profiles`.
2. **Application State & Persistence**: PostgreSQL (`profiles`, `servers`, `channels`, `messages`, `bookmarks`, `threads`, `forums`, `dms`, `friends`, `read_states`, `notifications`, `stage_states`).
3. **Realtime Engine**: Supabase Realtime WebSocket subscriptions on PostgreSQL tables.
4. **Media SFU**: LiveKit SFU (1080p, 30fps, Opus; no silent P2P fallback in production).
5. **Mocks & Local Adapters**: Development/test harness adapters only; **zero silent mock fallbacks in production**.

---

## 2. Production Database Schema

The database migrations are codified in:
- [`supabase/migrations/001_production_schema.sql`](file:///c:/CodeBase/Projects/meetwo/supabase/migrations/001_production_schema.sql)
- [`supabase/migrations/002_coherent_production_schema.sql`](file:///c:/CodeBase/Projects/meetwo/supabase/migrations/002_coherent_production_schema.sql)
- Consolidated: [`supabase/schema.sql`](file:///c:/CodeBase/Projects/meetwo/supabase/schema.sql)

### Core Tables

| Table | Description | Key Columns |
|---|---|---|
| `profiles` | User profiles synced with Supabase Auth | `id` (UUID PK), `username`, `display_name`, `avatar_url`, `status`, `custom_status` (JSONB) |
| `servers` | Workspaces / Communities | `id` (UUID PK), `name`, `icon_url`, `description`, `owner_id` (FK to profiles) |
| `server_members` | Server membership & roles | `server_id`, `user_id`, `role` (`'owner'` \| `'admin'` \| `'member'`), `joined_at` |
| `categories` | Channel organizational categories | `id` (UUID PK), `server_id`, `name`, `position` |
| `channels` | Text, voice, stage, and forum channels | `id` (UUID PK), `server_id`, `category_id`, `name`, `type`, `topic`, `position` |
| `messages` | Channel chat messages | `id` (UUID PK), `channel_id`, `author_id`, `content`, `reply_to_id`, `created_at` |
| `message_reactions`| Message emoji reactions | `id` (UUID PK), `message_id`, `user_id`, `emoji` |
| `attachments` | File and media metadata | `id` (UUID PK), `message_id`, `url`, `filename`, `file_size`, `content_type` |
| `invites` | Shareable workspace invite links | `id` (UUID PK), `server_id`, `code`, `creator_id`, `max_uses`, `uses_count`, `expires_at` |

### Attention, Stage & Collaboration Tables

| Table | Description | Key Columns |
|---|---|---|
| `notifications` | Cross-device attention feed (mentions, replies, DMs) | `id` (UUID PK), `user_id`, `type`, `source_id`, `actor_id`, `server_id`, `channel_id`, `content`, `is_read`, `created_at` |
| `stage_states` | Authoritative stage queue & approved speakers | `channel_id` (UUID PK), `host_id`, `speakers` (JSONB), `hand_raised_queue` (JSONB), `stage_settings` (JSONB) |
| `bookmarks` | Saved/bookmarked messages | `id` (UUID PK), `user_id`, `message_id`, `created_at` |
| `threads` | Message conversation threads | `id` (UUID PK), `channel_id`, `parent_message_id`, `created_at` |
| `thread_messages` | Replies in a specific thread | `id` (UUID PK), `thread_id`, `author_id`, `content`, `created_at` |
| `forum_posts` | Structured forum discussions | `id` (UUID PK), `channel_id`, `author_id`, `title`, `content`, `is_pinned`, `is_solved`, `tags` |
| `forum_replies` | Forum thread replies | `id` (UUID PK), `post_id`, `author_id`, `content`, `is_solution`, `created_at` |
| `dm_conversations`| 1:1 and small-group direct chats | `id` (UUID PK), `created_at`, `updated_at` |
| `dm_participants` | Participants in direct chats | `conversation_id`, `user_id`, `joined_at` |
| `dm_messages` | Messages inside direct chats | `id` (UUID PK), `conversation_id`, `sender_id`, `content`, `read_by`, `created_at` |
| `friends` | Friend relationships & requests | `user_id`, `friend_id`, `status` (`'pending_sent'` \| `'pending_received'` \| `'accepted'`), `created_at` |
| `read_states` | Cursor-based attention & unread tracking | `user_id`, `entity_type` (`'channel'` \| `'dm'`), `entity_id`, `last_read_message_id`, `last_read_at` |

---

## 3. Atomic PostgreSQL RPC Functions

To eliminate race conditions, invite leaks, and client-side privilege escalation:
1. **`join_server_with_invite(p_code TEXT)`**:
   - `SECURITY DEFINER` function executed under caller authentication (`auth.uid()`).
   - Validates that the invite code exists, has not expired, and has not exceeded `max_uses`.
   - Idempotently adds caller to `server_members` with role `'member'`.
   - Atomically increments `uses_count`.
   - Returns `{ success: true, server_id, server_name, icon_url }`.
2. **Stage RPCs (`raise_stage_hand`, `lower_stage_hand`, `moderate_stage_speaker`)**:
   - Manages stage audience queues and speaker role transitions server-side with strict permission verification.
3. **`handle_new_message_notifications()`**:
   - Database trigger that scans new messages for `@username` mentions and reply targets, automatically populating `public.notifications`.

---

## 4. Repository Pattern (`src/lib/repositories/`)

Data access is fully abstracted using repository interfaces:

- `IMessageRepository`
- `IServerRepository`
- `IChannelRepository`
- `IDMRepository`
- `IBookmarkRepository`
- `IThreadRepository`
- `IForumRepository`
- `INotificationRepository`
- `IReadStateRepository`
- `IStageRepository`
- `ISearchRepository`
- `IFriendRepository`

### Behavior Guarantee:
- When running in **Production** (`VITE_APP_ENV=production` or `PROD`), Supabase repositories execute all database queries and throw typed `ServiceError` on failures. **There is no silent fallback to mocks in production.**
- In local development without database credentials, `MockRepository` adapters provide multi-tab simulation.
