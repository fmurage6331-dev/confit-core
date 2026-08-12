-- SHA-4: Auto-generate SHA claim on encounter sign
-- Fires AFTER UPDATE OF status ON encounters
-- Creates draft sha_claims + seeds line items from invoice_line_items

CREATE OR REPLACE FUNCTION public.auto_generate_sha_claim()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_claim_id    uuid;
  v_fund_type   text;
  v_claim_type  text;
BEGIN
  IF NEW.status IS DISTINCT FROM 'signed' THEN RETURN NEW; END IF;
  IF OLD.status = 'signed' THEN RETURN NEW; END IF;
  IF NEW.payment_mode IS DISTINCT FROM 'insurance' THEN RETURN NEW; END IF;
  IF EXISTS (
    SELECT 1 FROM public.sha_claims WHERE encounter_id = NEW.id
  ) THEN RETURN NEW; END IF;

  v_fund_type  := NEW.sha_fund_type;
  v_claim_type :=
    CASE NEW.insurer_type
      WHEN 'sha_shif'  THEN
        CASE v_fund_type
          WHEN 'PHF'   THEN 'sha_phf'
          WHEN 'ECCIF' THEN 'sha_eccif'
          ELSE              'sha_shif'
        END
      WHEN 'private'   THEN 'private'
      WHEN 'corporate' THEN 'private'
      ELSE                  'sha_shif'
    END;

  INSERT INTO public.sha_claims (
    encounter_id, patient_id, claim_number, claim_type,
    fund_type, status, preauth_number, total_amount,
    submitted_by, notes
  )
  VALUES (
    NEW.id, NEW.patient_id, NEW.claim_number, v_claim_type,
    v_fund_type, 'draft', NEW.preauth_number,
    COALESCE(NEW.insurance_covered, 0),
    NEW.created_by, 'Auto-generated on encounter sign'
  )
  RETURNING id INTO v_claim_id;

  INSERT INTO public.sha_claim_items (
    claim_id, invoice_line_item_id, item_type,
    description, quantity, unit_price, amount, is_included
  )
  SELECT
    v_claim_id, ili.id, ili.item_type,
    COALESCE(ili.description, 'Service'),
    COALESCE(ili.quantity, 1),
    COALESCE(ili.unit_price, 0),
    COALESCE(ili.amount, 0),
    true
  FROM public.invoice_line_items ili
  JOIN public.invoices inv ON inv.id = ili.invoice_id
  WHERE inv.encounter_id = NEW.id
    AND ili.item_type NOT IN ('credit_note');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_generate_sha_claim ON public.encounters;
CREATE TRIGGER trg_auto_generate_sha_claim
  AFTER UPDATE OF status
  ON public.encounters
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_generate_sha_claim();
