-- Migration: 003_fix_friends_rls.sql
-- Description: Fix Row Level Security policies on public.friends to allow users to insert their own friendships, view reciprocal friends, and allow either participant to update/remove friendships.

-- 1. Ensure RLS is enabled on friends
ALTER TABLE public.friends ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing monolithic or restrictive policies
DROP POLICY IF EXISTS "Users can manage their friendships" ON public.friends;
DROP POLICY IF EXISTS "Users can insert their friendships" ON public.friends;
DROP POLICY IF EXISTS "Users can update their friendships" ON public.friends;
DROP POLICY IF EXISTS "Users can delete their friendships" ON public.friends;
DROP POLICY IF EXISTS "Users can view their friends" ON public.friends;

-- 3. Granular RLS Policies

-- SELECT: Users can view any friendship where they are the initiator (user_id) or recipient (friend_id)
CREATE POLICY "Users can view their friends"
  ON public.friends FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- INSERT: Authenticated users can insert friendships where auth.uid() matches user_id
CREATE POLICY "Users can insert their friendships"
  ON public.friends FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: Either party can update the friendship status (e.g., status: 'accepted' or 'blocked')
CREATE POLICY "Users can update their friendships"
  ON public.friends FOR UPDATE
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- DELETE: Either party can delete / remove the friendship
CREATE POLICY "Users can delete their friendships"
  ON public.friends FOR DELETE
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- 4. Automatic Reciprocal Trigger (SECURITY DEFINER)
-- Ensures that when User A adds User B, a reciprocal row (B, A) is also maintained automatically
-- and when either row is deleted, the reverse row is cleaned up.
CREATE OR REPLACE FUNCTION public.handle_friend_bidirectional()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.friends
      WHERE user_id = NEW.friend_id AND friend_id = NEW.user_id
    ) THEN
      INSERT INTO public.friends (user_id, friend_id, status, created_at)
      VALUES (NEW.friend_id, NEW.user_id, NEW.status, NEW.created_at)
      ON CONFLICT (user_id, friend_id) DO NOTHING;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM public.friends
    WHERE user_id = OLD.friend_id AND friend_id = OLD.user_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS tr_friend_bidirectional ON public.friends;
CREATE TRIGGER tr_friend_bidirectional
AFTER INSERT OR DELETE ON public.friends
FOR EACH ROW EXECUTE FUNCTION public.handle_friend_bidirectional();
