
-- 1. RPC for OG metadata (read-only, no password check, no view increment)
CREATE OR REPLACE FUNCTION public.get_share_metadata(p_id text)
RETURNS TABLE(
  id text,
  title text,
  deleted_at timestamptz,
  auto_delete_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.title, s.deleted_at, s.auto_delete_at
  FROM public.shares s
  WHERE s.id = p_id;
$$;

-- 2. RPC for viewing a share (password check + view count increment)
CREATE OR REPLACE FUNCTION public.fetch_share_for_view(p_id text, p_password_hash text DEFAULT NULL)
RETURNS TABLE(
  id text,
  title text,
  data jsonb,
  view_count integer,
  status text,
  requires_password boolean,
  access_granted boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_share RECORD;
BEGIN
  SELECT s.id, s.title, s.data, s.view_count, s.password_hash, s.deleted_at, s.auto_delete_at
  INTO v_share
  FROM public.shares s
  WHERE s.id = p_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT p_id, NULL::text, NULL::jsonb, 0, 'not_found'::text, false, false;
    RETURN;
  END IF;

  -- Soft-deleted
  IF v_share.deleted_at IS NOT NULL THEN
    RETURN QUERY SELECT p_id, v_share.title, NULL::jsonb, v_share.view_count, 'deleted'::text, false, false;
    RETURN;
  END IF;

  -- Expired
  IF v_share.auto_delete_at IS NOT NULL AND v_share.auto_delete_at <= now() THEN
    RETURN QUERY SELECT p_id, v_share.title, NULL::jsonb, v_share.view_count, 'expired'::text, false, false;
    RETURN;
  END IF;

  -- Password protected but no password provided
  IF v_share.password_hash IS NOT NULL AND (p_password_hash IS NULL OR p_password_hash = '') THEN
    RETURN QUERY SELECT p_id, v_share.title, NULL::jsonb, v_share.view_count, 'password_required'::text, true, false;
    RETURN;
  END IF;

  -- Wrong password
  IF v_share.password_hash IS NOT NULL AND v_share.password_hash <> p_password_hash THEN
    RETURN QUERY SELECT p_id, v_share.title, NULL::jsonb, v_share.view_count, 'password_required'::text, true, false;
    RETURN;
  END IF;

  -- Success - increment view count
  UPDATE public.shares SET view_count = view_count + 1 WHERE shares.id = p_id;

  RETURN QUERY SELECT p_id, v_share.title, v_share.data, v_share.view_count + 1, 'ok'::text, (v_share.password_hash IS NOT NULL), true;
END;
$$;

-- 3. UPDATE policy for view_count (fallback, though RPCs use SECURITY DEFINER)
CREATE POLICY "Anyone can update view_count"
ON public.shares
FOR UPDATE
TO public
USING (true)
WITH CHECK (true);
