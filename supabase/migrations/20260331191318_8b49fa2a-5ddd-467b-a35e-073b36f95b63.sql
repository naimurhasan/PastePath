ALTER TABLE public.shares 
  ADD COLUMN deleted_at timestamptz,
  ADD COLUMN is_deleted boolean NOT NULL DEFAULT false,
  ADD COLUMN view_count integer NOT NULL DEFAULT 0;