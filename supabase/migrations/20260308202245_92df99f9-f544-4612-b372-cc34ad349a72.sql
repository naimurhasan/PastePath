
-- Create shares table for public sharing (no auth required)
CREATE TABLE public.shares (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  password_hash TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.shares ENABLE ROW LEVEL SECURITY;

-- Anyone can read shares (public viewing)
CREATE POLICY "Anyone can view shares"
  ON public.shares FOR SELECT
  USING (true);

-- Anyone can create shares (no auth required)
CREATE POLICY "Anyone can create shares"
  ON public.shares FOR INSERT
  WITH CHECK (true);
