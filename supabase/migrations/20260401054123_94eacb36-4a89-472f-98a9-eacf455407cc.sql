-- Drop the overly permissive policies
DROP POLICY IF EXISTS "Anyone can create shares" ON public.shares;
DROP POLICY IF EXISTS "Anyone can view shares" ON public.shares;

-- SELECT: Only allow direct reads for non-password shares (password shares go through edge function)
CREATE POLICY "Public can view non-password shares"
ON public.shares
FOR SELECT
TO public
USING (password_hash IS NULL AND deleted_at IS NULL);

-- No INSERT/UPDATE/DELETE for public roles - all mutations go through edge functions with service role
-- (service_role bypasses RLS entirely)