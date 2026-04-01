
CREATE OR REPLACE FUNCTION public.fetch_share_for_view(p_id text, p_password_hash text DEFAULT NULL::text)
 RETURNS TABLE(id text, title text, data jsonb, view_count integer, status text, requires_password boolean, access_granted boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  IF v_share.deleted_at IS NOT NULL THEN
    RETURN QUERY SELECT p_id, v_share.title, NULL::jsonb, v_share.view_count, 'deleted'::text, false, false;
    RETURN;
  END IF;

  IF v_share.auto_delete_at IS NOT NULL AND v_share.auto_delete_at <= now() THEN
    RETURN QUERY SELECT p_id, v_share.title, NULL::jsonb, v_share.view_count, 'expired'::text, false, false;
    RETURN;
  END IF;

  IF v_share.password_hash IS NOT NULL AND (p_password_hash IS NULL OR p_password_hash = '') THEN
    RETURN QUERY SELECT p_id, v_share.title, NULL::jsonb, v_share.view_count, 'password_required'::text, true, false;
    RETURN;
  END IF;

  IF v_share.password_hash IS NOT NULL AND v_share.password_hash <> p_password_hash THEN
    RETURN QUERY SELECT p_id, v_share.title, NULL::jsonb, v_share.view_count, 'password_required'::text, true, false;
    RETURN;
  END IF;

  UPDATE public.shares s2 SET view_count = s2.view_count + 1 WHERE s2.id = p_id;

  RETURN QUERY SELECT p_id, v_share.title, v_share.data, v_share.view_count + 1, 'ok'::text, (v_share.password_hash IS NOT NULL), true;
END;
$function$;
