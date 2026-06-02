
CREATE OR REPLACE FUNCTION recalc_checkin_values()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  _kr_id uuid;
  _ms_id uuid;
  _sum numeric;
  _has_milestones boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    _kr_id := OLD.key_result_id;
    _ms_id := OLD.milestone_id;
  ELSE
    _kr_id := NEW.key_result_id;
    _ms_id := NEW.milestone_id;
  END IF;

  -- Update milestone current_value if checkin is linked to a milestone
  IF _ms_id IS NOT NULL THEN
    SELECT COALESCE(SUM(value), 0) INTO _sum
    FROM checkins WHERE milestone_id = _ms_id;
    UPDATE milestones SET current_value = _sum, updated_at = now() WHERE id = _ms_id;
  END IF;

  -- Also handle OLD milestone on UPDATE if milestone changed
  IF TG_OP = 'UPDATE' AND OLD.milestone_id IS DISTINCT FROM NEW.milestone_id AND OLD.milestone_id IS NOT NULL THEN
    SELECT COALESCE(SUM(value), 0) INTO _sum
    FROM checkins WHERE milestone_id = OLD.milestone_id;
    UPDATE milestones SET current_value = _sum, updated_at = now() WHERE id = OLD.milestone_id;
  END IF;

  -- Check if KR has milestones
  SELECT has_milestones INTO _has_milestones FROM key_results WHERE id = _kr_id;

  IF _has_milestones THEN
    -- KR value = sum of all milestone current_values
    SELECT COALESCE(SUM(current_value), 0) INTO _sum
    FROM milestones WHERE key_result_id = _kr_id AND archived = false;
    UPDATE key_results SET current_value = _sum, last_checkin_at = now(), updated_at = now() WHERE id = _kr_id;
  ELSE
    -- KR value = sum of all checkins
    SELECT COALESCE(SUM(value), 0) INTO _sum
    FROM checkins WHERE key_result_id = _kr_id;
    UPDATE key_results SET current_value = _sum, last_checkin_at = now(), updated_at = now() WHERE id = _kr_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Recreate trigger
DROP TRIGGER IF EXISTS trg_recalc_checkin_values ON checkins;
CREATE TRIGGER trg_recalc_checkin_values
  AFTER INSERT OR UPDATE OR DELETE ON checkins
  FOR EACH ROW EXECUTE FUNCTION recalc_checkin_values();
