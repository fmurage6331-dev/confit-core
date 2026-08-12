-- ============================================================
-- Sprint 15E: Insurance per-visit limit enforcement trigger
-- ============================================================

CREATE OR REPLACE FUNCTION public.enforce_insurance_visit_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rule        text;
  v_limit       numeric;
  v_covered     numeric;
BEGIN
  -- Only check insurance encounters
  IF NEW.payment_mode IS DISTINCT FROM 'insurance' THEN
    RETURN NEW;
  END IF;

  -- No provider set — nothing to check
  IF NEW.insurance_provider_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Fetch the insurer rule
  SELECT coverage_rule, per_visit_limit
  INTO v_rule, v_limit
  FROM public.insurance_providers
  WHERE id = NEW.insurance_provider_id;

  -- Only enforce for capped rules
  IF v_rule NOT IN ('fixed_per_visit', 'percentage_with_cap') THEN
    RETURN NEW;
  END IF;

  -- No limit configured — nothing to enforce
  IF v_limit IS NULL OR v_limit <= 0 THEN
    RETURN NEW;
  END IF;

  v_covered := COALESCE(NEW.insurance_covered, 0);

  -- Block if insurance_covered exceeds the per-visit limit
  IF v_covered > v_limit THEN
    RAISE EXCEPTION
      'Insurance visit limit reached (KSh %). '
      'Patient balance of KSh % must be settled at the billing desk before further services can be added.',
      v_limit::text,
      (COALESCE(NEW.patient_due, 0))::text
    USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_insurance_visit_limit ON public.encounters;
CREATE TRIGGER trg_enforce_insurance_visit_limit
  BEFORE INSERT OR UPDATE OF insurance_covered, insurance_provider_id, payment_mode
  ON public.encounters
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_insurance_visit_limit();
