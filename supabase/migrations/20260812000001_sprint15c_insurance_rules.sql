-- Sprint 15C-A: Insurance benefit rules
-- Adds coverage_rule and per_visit_limit to insurance_providers

ALTER TABLE public.insurance_providers
  ADD COLUMN IF NOT EXISTS coverage_rule text NOT NULL DEFAULT 'percentage'
    CHECK (coverage_rule IN ('percentage', 'fixed_per_visit', 'percentage_with_cap')),
  ADD COLUMN IF NOT EXISTS per_visit_limit numeric;

COMMENT ON COLUMN public.insurance_providers.coverage_rule IS
  'percentage = % of subtotal | fixed_per_visit = flat KSh cap | percentage_with_cap = % but never more than per_visit_limit';
COMMENT ON COLUMN public.insurance_providers.per_visit_limit IS
  'Maximum KSh the insurer pays per visit (used by fixed_per_visit and percentage_with_cap rules)';

-- Update existing insurers to percentage rule (already the behaviour)
UPDATE public.insurance_providers
SET coverage_rule = 'percentage'
WHERE coverage_rule IS NULL OR coverage_rule = 'percentage';
