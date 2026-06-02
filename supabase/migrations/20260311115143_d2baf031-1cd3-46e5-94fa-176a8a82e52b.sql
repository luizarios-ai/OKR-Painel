
-- 1) Create kr_comments table
CREATE TABLE public.kr_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key_result_id UUID NOT NULL REFERENCES public.key_results(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.kr_comments ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Anyone can read kr_comments"
  ON public.kr_comments FOR SELECT
  USING (true);

CREATE POLICY "Owners and admins can manage kr_comments"
  ON public.kr_comments FOR ALL
  USING (true);

-- 2) Add indexes for API/n8n integration performance
CREATE INDEX IF NOT EXISTS idx_objectives_cycle_id ON public.objectives(cycle_id);
CREATE INDEX IF NOT EXISTS idx_objectives_area_id ON public.objectives(area_id);
CREATE INDEX IF NOT EXISTS idx_objectives_owner_user_id ON public.objectives(owner_user_id);

CREATE INDEX IF NOT EXISTS idx_key_results_objective_id ON public.key_results(objective_id);
CREATE INDEX IF NOT EXISTS idx_key_results_cycle_id ON public.key_results(cycle_id);
CREATE INDEX IF NOT EXISTS idx_key_results_area_id ON public.key_results(area_id);
CREATE INDEX IF NOT EXISTS idx_key_results_owner_user_id ON public.key_results(owner_user_id);

CREATE INDEX IF NOT EXISTS idx_checkins_key_result_id ON public.checkins(key_result_id);
CREATE INDEX IF NOT EXISTS idx_checkins_created_at ON public.checkins(created_at);

CREATE INDEX IF NOT EXISTS idx_milestones_key_result_id ON public.milestones(key_result_id);

CREATE INDEX IF NOT EXISTS idx_kr_comments_key_result_id ON public.kr_comments(key_result_id);
CREATE INDEX IF NOT EXISTS idx_kr_comments_user_id ON public.kr_comments(user_id);

CREATE INDEX IF NOT EXISTS idx_app_users_area_id ON public.app_users(area_id);
CREATE INDEX IF NOT EXISTS idx_app_users_role ON public.app_users(role);
