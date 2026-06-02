
-- Function to recalculate milestone current_value from checkins
CREATE OR REPLACE FUNCTION public.recalc_checkin_values()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _milestone_id uuid;
  _kr_id uuid;
  _sum numeric;
BEGIN
  -- Determine affected milestone and KR
  IF TG_OP = 'DELETE' THEN
    _milestone_id := OLD.milestone_id;
    _kr_id := OLD.key_result_id;
  ELSE
    _milestone_id := NEW.milestone_id;
    _kr_id := NEW.key_result_id;
  END IF;

  -- Also handle old milestone if milestone changed on UPDATE
  IF TG_OP = 'UPDATE' AND OLD.milestone_id IS DISTINCT FROM NEW.milestone_id AND OLD.milestone_id IS NOT NULL THEN
    SELECT COALESCE(SUM(value), 0) INTO _sum FROM checkins WHERE milestone_id = OLD.milestone_id;
    UPDATE milestones SET current_value = _sum WHERE id = OLD.milestone_id;
  END IF;

  -- Recalculate milestone current_value
  IF _milestone_id IS NOT NULL THEN
    SELECT COALESCE(SUM(value), 0) INTO _sum FROM checkins WHERE milestone_id = _milestone_id;
    UPDATE milestones SET current_value = _sum WHERE id = _milestone_id;
  END IF;

  -- Recalculate KR current_value (sum of all checkins for this KR)
  SELECT COALESCE(SUM(value), 0) INTO _sum FROM checkins WHERE key_result_id = _kr_id;
  UPDATE key_results SET current_value = _sum, last_checkin_at = now() WHERE id = _kr_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger on checkins table
CREATE TRIGGER trg_recalc_checkin_values
AFTER INSERT OR UPDATE OR DELETE ON public.checkins
FOR EACH ROW
EXECUTE FUNCTION public.recalc_checkin_values();
