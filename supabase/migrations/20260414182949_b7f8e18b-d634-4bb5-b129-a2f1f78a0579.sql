
-- Junction table for many-to-many user <-> area
CREATE TABLE public.user_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  area_id uuid NOT NULL REFERENCES public.areas(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, area_id)
);

ALTER TABLE public.user_areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read user_areas" ON public.user_areas FOR SELECT USING (true);
CREATE POLICY "Admins can manage user_areas" ON public.user_areas FOR ALL USING (true);

-- Migrate existing area_id data
INSERT INTO public.user_areas (user_id, area_id)
SELECT id, area_id FROM public.app_users WHERE area_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Index for fast lookups
CREATE INDEX idx_user_areas_user_id ON public.user_areas(user_id);
CREATE INDEX idx_user_areas_area_id ON public.user_areas(area_id);
