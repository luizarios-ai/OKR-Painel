ALTER TABLE public.key_results
ADD COLUMN measurement_type text NOT NULL DEFAULT 'accumulated';

COMMENT ON COLUMN public.key_results.measurement_type IS 'Tipo de medição: accumulated, average, milestone';