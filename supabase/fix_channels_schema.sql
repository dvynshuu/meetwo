-- ====================================================================
-- FIX: Channels category_id column and channel types constraint
-- Run this script in your Supabase Dashboard -> SQL Editor
-- ====================================================================

-- 1. Add category_id column if it doesn't exist
ALTER TABLE public.channels 
ADD COLUMN IF NOT EXISTS category_id UUID DEFAULT NULL;

-- 2. Update type constraint to support all channel types (text, voice, stage, forum, announcement)
ALTER TABLE public.channels 
DROP CONSTRAINT IF EXISTS channels_type_check;

ALTER TABLE public.channels 
ADD CONSTRAINT channels_type_check 
CHECK (type IN ('text', 'voice', 'stage', 'forum', 'announcement'));

-- 3. Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
