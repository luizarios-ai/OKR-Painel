
-- Create update_updated_at function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Cycles
CREATE TABLE public.cycles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  expected_progress_mode TEXT NOT NULL DEFAULT 'linear',
  stagnation_days INT NOT NULL DEFAULT 14,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.cycles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read cycles" ON public.cycles FOR SELECT USING (true);
CREATE POLICY "Admins can manage cycles" ON public.cycles FOR ALL USING (true);

-- Areas
CREATE TABLE public.areas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read areas" ON public.areas FOR SELECT USING (true);
CREATE POLICY "Admins can manage areas" ON public.areas FOR ALL USING (true);

-- Teams
CREATE TABLE public.teams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  area_id UUID NOT NULL REFERENCES public.areas(id),
  archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read teams" ON public.teams FOR SELECT USING (true);
CREATE POLICY "Admins can manage teams" ON public.teams FOR ALL USING (true);

-- App Users (OKR user registry)
CREATE TABLE public.app_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'owner', 'viewer')),
  team_id UUID REFERENCES public.teams(id),
  archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read app_users" ON public.app_users FOR SELECT USING (true);
CREATE POLICY "Admins can manage app_users" ON public.app_users FOR ALL USING (true);

-- Objectives
CREATE TABLE public.objectives (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cycle_id UUID NOT NULL REFERENCES public.cycles(id),
  team_id UUID NOT NULL REFERENCES public.teams(id),
  owner_user_id UUID NOT NULL REFERENCES public.app_users(id),
  external_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  weight NUMERIC NOT NULL DEFAULT 1,
  archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(cycle_id, external_id)
);
ALTER TABLE public.objectives ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read objectives" ON public.objectives FOR SELECT USING (true);
CREATE POLICY "Owners and admins can manage objectives" ON public.objectives FOR ALL USING (true);
CREATE TRIGGER update_objectives_updated_at BEFORE UPDATE ON public.objectives FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Key Results
CREATE TABLE public.key_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  objective_id UUID NOT NULL REFERENCES public.objectives(id),
  cycle_id UUID NOT NULL REFERENCES public.cycles(id),
  team_id UUID NOT NULL REFERENCES public.teams(id),
  owner_user_id UUID NOT NULL REFERENCES public.app_users(id),
  external_id TEXT,
  title TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'number' CHECK (unit IN ('number', 'percent', 'currency', 'boolean')),
  direction TEXT NOT NULL DEFAULT 'increase' CHECK (direction IN ('increase', 'decrease')),
  grade0_value NUMERIC NOT NULL DEFAULT 0,
  grade1_value NUMERIC NOT NULL DEFAULT 100,
  current_value NUMERIC,
  has_milestones BOOLEAN NOT NULL DEFAULT false,
  last_checkin_at TIMESTAMPTZ,
  archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(cycle_id, external_id)
);
ALTER TABLE public.key_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read key_results" ON public.key_results FOR SELECT USING (true);
CREATE POLICY "Owners and admins can manage key_results" ON public.key_results FOR ALL USING (true);
CREATE TRIGGER update_key_results_updated_at BEFORE UPDATE ON public.key_results FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Milestones
CREATE TABLE public.milestones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key_result_id UUID NOT NULL REFERENCES public.key_results(id),
  external_id TEXT,
  title TEXT NOT NULL,
  weight NUMERIC NOT NULL DEFAULT 0.5 CHECK (weight >= 0 AND weight <= 1),
  target_value NUMERIC NOT NULL,
  current_value NUMERIC,
  due_date DATE,
  archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read milestones" ON public.milestones FOR SELECT USING (true);
CREATE POLICY "Owners and admins can manage milestones" ON public.milestones FOR ALL USING (true);
CREATE TRIGGER update_milestones_updated_at BEFORE UPDATE ON public.milestones FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Checkins
CREATE TABLE public.checkins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key_result_id UUID NOT NULL REFERENCES public.key_results(id),
  milestone_id UUID REFERENCES public.milestones(id),
  value NUMERIC NOT NULL,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_user_id UUID NOT NULL REFERENCES public.app_users(id)
);
ALTER TABLE public.checkins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read checkins" ON public.checkins FOR SELECT USING (true);
CREATE POLICY "Owners and admins can manage checkins" ON public.checkins FOR ALL USING (true);
