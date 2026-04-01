-- Lock down direct reads and expose a controlled RPC for share viewing.
DROP POLICY IF EXISTS "Anyone can view shares" ON public.shares;

CREATE POLICY "No direct share reads"
  ON public.shares
  FOR SELECT
  USING (false);

CREATE OR REPLACE FUNCTION public.fetch_share_for_view(
  p_id text,
  p_password_hash text DEFAULT NULL,
  p_increment boolean DEFAULT true
)
RETURNS TABLE (
  id text,
  title text,
  data jsonb,
  view_count integer,
  requires_password boolean,
  access_granted boolean,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_share public.shares%ROWTYPE;
BEGIN
  SELECT *
  INTO v_share
  FROM public.shares
  WHERE shares.id = p_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT p_id, NULL::text, NULL::jsonb, 0, false, false, 'not_found';
    RETURN;
  END IF;

  IF v_share.deleted_at IS NOT NULL THEN
    RETURN QUERY SELECT v_share.id, v_share.title, NULL::jsonb, v_share.view_count, false, false, 'deleted';
    RETURN;
  END IF;

  IF v_share.auto_delete_at IS NOT NULL AND v_share.auto_delete_at <= now() THEN
    UPDATE public.shares
    SET deleted_at = coalesce(deleted_at, now())
    WHERE shares.id = v_share.id
      AND deleted_at IS NULL;

    RETURN QUERY SELECT v_share.id, v_share.title, NULL::jsonb, v_share.view_count, false, false, 'expired';
    RETURN;
  END IF;

  IF v_share.password_hash IS NOT NULL AND coalesce(p_password_hash, '') <> v_share.password_hash THEN
    RETURN QUERY SELECT v_share.id, v_share.title, NULL::jsonb, v_share.view_count, true, false, 'password_required';
    RETURN;
  END IF;

  IF p_increment THEN
    UPDATE public.shares
    SET view_count = view_count + 1
    WHERE shares.id = v_share.id
    RETURNING shares.view_count INTO v_share.view_count;
  END IF;

  RETURN QUERY SELECT v_share.id, v_share.title, v_share.data, v_share.view_count, (v_share.password_hash IS NOT NULL), true, 'ok';
END;
$$;

REVOKE ALL ON FUNCTION public.fetch_share_for_view(text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fetch_share_for_view(text, text, boolean) TO anon, authenticated, service_role;

-- Read-only RPC for OG metadata (no password check, no view increment)
CREATE OR REPLACE FUNCTION public.get_share_metadata(p_id text)
RETURNS TABLE (
  title text,
  deleted_at timestamp with time zone,
  auto_delete_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_share public.shares%ROWTYPE;
BEGIN
  SELECT *
  INTO v_share
  FROM public.shares
  WHERE shares.id = p_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Return only public metadata, no sensitive fields
  RETURN QUERY SELECT v_share.title, v_share.deleted_at, v_share.auto_delete_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_share_metadata(text) TO anon, authenticated, service_role;
