DROP TRIGGER IF EXISTS trg_recalc_checkin_values ON public.checkins;

CREATE TRIGGER trg_recalc_checkin_values
AFTER INSERT OR UPDATE OR DELETE ON public.checkins
FOR EACH ROW
EXECUTE FUNCTION public.recalc_checkin_values();