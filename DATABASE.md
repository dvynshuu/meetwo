# Meetwo — Database Architecture & Service Layer

Meetwo uses **Supabase (PostgreSQL 15+)** as its primary authoritative data store, with Row-Level Security (RLS) and Realtime change-data-capture (CDC) subscriptions.

---

## 1. Production Database Schema

The schema migration is codified in [`supabase/migrations/001_production_schema.sql`](file:///c:/CodeBase/Projects/meetwo/supabase/migrations/001_production_schema.sql).

### Core Tables

| Table | Description | Key Columns |
|---|---|---|
| `profiles` | User profiles synced with Supabase Auth | `id` (UUID PK), `username`, `display_name`, `avatar_url`, `status`, `custom_status` (JSONB) |
| `servers` | Workspaces/Communities | `id` (UUID PK), `name`, `icon_url`, `description`, `owner_id` (FK to profiles) |
| `server_members` | Server membership & roles | `server_id`, `user_id`, `role` (`'owner'` \| `'admin'` \| `'member'`), `joined_at` |
| `categories` | Channel organizational categories | `id` (UUID PK), `server_id`, `name`, `position` |
| `channels` | Text, voice, stage, and forum channels | `id` (UUID PK), `server_id`, `category_id`, `name`, `type`, `topic`, `position` |
| `messages` | Channel chat messages | `id` (UUID PK), `channel_id`, `author_id`, `content`, `reply_to_id`, `created_at` |
| `message_reactions`| Message emoji reactions | `id` (UUID PK), `message_id`, `user_id`, `emoji` |
| `attachments` | File and media metadata | `id` (UUID PK), `message_id`, `url`, `filename`, `file_size`, `content_type` |
| `invites` | Shareable workspace invite links | `id` (UUID PK), `server_id`, `code`, `creator_id`, `max_uses`, `uses_count`, `expires_at` |

### Small-Group & Collaboration Tables

| Table | Description | Key Columns |
|---|---|---|
| `bookmarks` | Saved/bookmarked messages | `id` (UUID PK), `user_id`, `message_id`, `created_at` |
| `threads` | Message conversation threads | `id` (UUID PK), `channel_id`, `parent_message_id`, `created_at` |
| `thread_messages` | Replies in a specific thread | `id` (UUID PK), `thread_id`, `author_id`, `content`, `created_at` |
| `forum_posts` | Structured forum discussions | `id` (UUID PK), `channel_id`, `author_id`, `title`, `content`, `is_pinned`, `is_solved`, `tags` |
| `forum_replies` | Forum thread replies | `id` (UUID PK), `post_id`, `author_id`, `content`, `is_solution`, `created_at` |
| `dm_conversations`| 1:1 and small-group direct chats | `id` (UUID PK), `created_at`, `updated_at` |
| `dm_participants` | Participants in direct chats | `conversation_id`, `user_id`, `joined_at` |
| `dm_messages` | Messages inside direct chats | `id` (UUID PK), `conversation_id`, `sender_id`, `content`, `read_by`, `created_at` |
| `friends` | Friend relationships & requests | `user_id`, `friend_id`, `status` (`'pending_sent'` \| `'pending_received'` \| `'accepted'`), `created_at` |
| `read_states` | Attention & unread tracking | `user_id`, `entity_type` (`'channel'` \| `'dm'`), `entity_id`, `last_read_message_id`, `last_read_at` |

---

## 2. Realtime Subscriptions & CDC

To support instantaneous live updates across multiple users:
1. **`REPLICA IDENTITY FULL`**: Enabled on `messages` and `message_reactions` so Postgres change events include full previous records for delete and unreaction events.
2. **Channel Postgres Subscriptions**:
   - `supabase.channel('channel:${channelId}').on('postgres_changes', ...)` for new messages, edits, and deletions.
   - `supabase.channel('thread:${threadId}')` for real-time thread messages.
   - `supabase.channel('forum:${channelId}')` for real-time forum discussions.
   - `supabase.channel('user_dms:${userId}')` for instant notifications and direct messages.

---

## 3. Modular Service Layer (`src/lib/services/`)

All database interactions flow through dedicated, strongly-typed service classes with fallback resilience:

1. **`StorageService`**: Validates file size (≤ 25MB), uploads files to Supabase Storage bucket `attachments`, generates public download URLs, and provides inline fallback if storage bucket is inaccessible.
2. **`MessageService`**: Handles channel message persistence, attachment linking, edits, deletions, and emoji reactions with optimistic client-side UI updates.
3. **`ThreadService`**: Manages thread creation from messages, reply posting, and real-time subscription.
4. **`BookmarkService`**: Toggles and persists user message bookmarks in the `bookmarks` table.
5. **`ForumService`**: Manages forum posts, replies, and solution marking (`is_solved = true`).
6. **`DMService`**: Manages 1:1 direct conversations, participant verification, direct message sending, and real-time subscriptions.
7. **`FriendService`**: User search by handle/display name, friend request lifecycle, and removal.
8. **`SearchService`**: Multi-entity search across channels, messages, and forum posts with author and channel filters.
9. **`ReadStateService`**: Cursor-based unread tracking for channels and direct conversations.

---

## 4. Zero-Downtime & Graceful Degradation

If any table from the migration hasn't yet been executed in a development Supabase instance:
- Service methods intercept Postgres errors (`PGRST204`, table missing).
- The service gracefully falls back to local reactive storage (`mockStore`) rather than throwing an unhandled exception or breaking UI rendering.
- Production users with the migration applied automatically enjoy full remote persistence and multi-device sync.
