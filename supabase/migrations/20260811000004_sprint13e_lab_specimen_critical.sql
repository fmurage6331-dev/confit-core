-- Sprint 13E: Lab specimen tracking, critical flag, dual verifier
-- Adds pre-analytical and result verification fields

-- ============================================================
-- 1. lab_orders — specimen + critical flag
-- ============================================================
ALTER TABLE public.lab_orders
  ADD COLUMN IF NOT EXISTS specimen_type  text,
  ADD COLUMN IF NOT EXISTS collected_at   timestamptz,
  ADD COLUMN IF NOT EXISTS is_critical    boolean NOT NULL DEFAULT false;

-- ============================================================
-- 2. lab_results — critical flag + dual verifier
-- ============================================================
ALTER TABLE public.lab_results
  ADD COLUMN IF NOT EXISTS is_critical  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verified_by  text,
  ADD COLUMN IF NOT EXISTS verified_at  timestamptz;

-- ============================================================
-- 3. Index critical results for alerting queries
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_lab_results_critical
  ON public.lab_results (is_critical)
  WHERE is_critical = true;

CREATE INDEX IF NOT EXISTS idx_lab_orders_critical
  ON public.lab_orders (is_critical)
  WHERE is_critical = true;

-- ============================================================
-- 4. Verify columns landed
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lab_orders'
    AND column_name = 'is_critical'
  ) THEN
    RAISE EXCEPTION 'Sprint 13E: is_critical on lab_orders not found';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lab_results'
    AND column_name = 'verified_by'
  ) THEN
    RAISE EXCEPTION 'Sprint 13E: verified_by on lab_results not found';
  END IF;
END;
$$;
