
-- Step 1: Add area_id columns
ALTER TABLE public.app_users ADD COLUMN area_id uuid REFERENCES public.areas(id);
ALTER TABLE public.objectives ADD COLUMN area_id uuid REFERENCES public.areas(id);
ALTER TABLE public.key_results ADD COLUMN area_id uuid REFERENCES public.areas(id);

-- Step 2: Migrate data from team_id → teams.area_id → area_id
UPDATE public.app_users SET area_id = t.area_id FROM public.teams t WHERE t.id = app_users.team_id;
UPDATE public.objectives SET area_id = t.area_id FROM public.teams t WHERE t.id = objectives.team_id;
UPDATE public.key_results SET area_id = t.area_id FROM public.teams t WHERE t.id = key_results.team_id;

-- Step 3: Drop foreign keys to teams
ALTER TABLE public.app_users DROP CONSTRAINT IF EXISTS app_users_team_id_fkey;
ALTER TABLE public.objectives DROP CONSTRAINT IF EXISTS objectives_team_id_fkey;
ALTER TABLE public.key_results DROP CONSTRAINT IF EXISTS key_results_team_id_fkey;

-- Step 4: Drop team_id columns
ALTER TABLE public.app_users DROP COLUMN team_id;
ALTER TABLE public.objectives DROP COLUMN team_id;
ALTER TABLE public.key_results DROP COLUMN team_id;

-- Step 5: Drop teams table
DROP TABLE IF EXISTS public.teams;
