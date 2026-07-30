-- ============================================================
-- Migration: DHA/ICD-11 Compliance — encounter_diagnoses sync
-- Date: 2026-07-30
-- Author: Francis Muhoro
--
-- Purpose:
--   Mirrors encounters.diagnoses (JSONB) into the structured
--   encounter_diagnoses table so diagnoses are:
--     • Queryable per ICD-11 code
--     • FHIR Condition resource ready
--     • SHA claims compatible (diagnosis_type, sequence)
--
-- Changes:
--   1. Add sequence column to encounter_diagnoses
--   2. Expand diagnosis_type CHECK constraint to include DHA values
--   3. Fix broken clean_and_validate_diagnosis_insert trigger
--      (was referencing diagnosis_name — correct column is icd11_title)
--   4. Create sync trigger: trg_sync_encounter_diagnoses
--   5. Backfill all existing encounters
-- ============================================================


-- ── 1. Add sequence column ────────────────────────────────────
ALTER TABLE public.encounter_diagnoses
  ADD COLUMN IF NOT EXISTS sequence integer;


-- ── 2. Expand diagnosis_type CHECK constraint ─────────────────
-- Original only allowed: primary, secondary, differential
-- DHA/FHIR requires: final, working, admission, discharge

ALTER TABLE public.encounter_diagnoses
  DROP CONSTRAINT IF EXISTS encounter_diagnoses_diagnosis_type_check;

ALTER TABLE public.encounter_diagnoses
  ADD CONSTRAINT encounter_diagnoses_diagnosis_type_check
  CHECK (diagnosis_type = ANY (ARRAY[
    'primary'::text,
    'secondary'::text,
    'differential'::text,
    'final'::text,
    'working'::text,
    'admission'::text,
    'discharge'::text
  ]));


-- ── 3. Fix broken trigger function ───────────────────────────
-- Previous version referenced NEW.diagnosis_name which does not
-- exist on encounter_diagnoses. Correct column is NEW.icd11_title.

CREATE OR REPLACE FUNCTION public.clean_and_validate_diagnosis_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_validated_title TEXT;
  v_clean_code      TEXT;
BEGIN
  IF NEW.icd11_code IS NULL
     OR UPPER(TRIM(NEW.icd11_code)) = 'NO CODE'
     OR TRIM(NEW.icd11_code) = ''
  THEN
    NEW.icd11_code := 'UNCODED';
  ELSE
    v_clean_code   := UPPER(TRIM(NEW.icd11_code));
    NEW.icd11_code := v_clean_code;

    SELECT p_title INTO v_validated_title
    FROM public.validate_and_get_icd11(v_clean_code);

    -- Fixed: was NEW.diagnosis_name (wrong), now NEW.icd11_title (correct)
    IF v_validated_title IS NOT NULL THEN
      NEW.icd11_title := v_validated_title;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;


-- ── 4. Sync trigger function ──────────────────────────────────
-- Fires after INSERT or UPDATE on encounters.
-- Mirrors encounters.diagnoses JSONB array into encounter_diagnoses rows.
-- On UPDATE: only runs when diagnoses column actually changed.
-- Sets diagnosis_type = 'final' (FHIR: confirmed / SHA compliant).
-- Sets sequence from 1-based array position (required for SHA claims).
-- Deletes rows for codes removed from the JSONB array.

CREATE OR REPLACE FUNCTION public.sync_encounter_diagnoses_from_jsonb()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  diag       jsonb;
  seq        integer := 1;
  code_list  text[];
BEGIN
  -- Skip if diagnoses column did not change
  IF TG_OP = 'UPDATE' AND NEW.diagnoses IS NOT DISTINCT FROM OLD.diagnoses THEN
    RETURN NEW;
  END IF;

  -- Clear all diagnoses if JSONB is null or empty
  IF NEW.diagnoses IS NULL OR jsonb_array_length(NEW.diagnoses) = 0 THEN
    DELETE FROM public.encounter_diagnoses WHERE encounter_id = NEW.id;
    RETURN NEW;
  END IF;

  -- Build list of current ICD-11 codes for the delete-removed step
  SELECT ARRAY(
    SELECT trim(elem->>'icd11_code')
    FROM jsonb_array_elements(NEW.diagnoses) AS elem
    WHERE elem->>'icd11_code' IS NOT NULL
      AND trim(elem->>'icd11_code') <> ''
  ) INTO code_list;

  -- Upsert each diagnosis from the JSONB array
  FOR diag IN SELECT * FROM jsonb_array_elements(NEW.diagnoses)
  LOOP
    CONTINUE WHEN diag->>'icd11_code' IS NULL
               OR trim(diag->>'icd11_code') = '';

    INSERT INTO public.encounter_diagnoses (
      id, encounter_id, icd11_code, icd11_title, icd11_uri,
      diagnosis_type, sequence, notes, created_by, created_at, updated_at
    )
    VALUES (
      gen_random_uuid(),
      NEW.id,
      trim(diag->>'icd11_code'),
      COALESCE(trim(diag->>'description'), ''),
      (SELECT uri FROM public.icd11_codes
       WHERE code = trim(diag->>'icd11_code') LIMIT 1),
      'final',
      seq,
      NULLIF(trim(diag->>'notes'), ''),
      NEW.created_by,
      NOW(),
      NOW()
    )
    ON CONFLICT ON CONSTRAINT encounter_diagnoses_encounter_code_uniq
    DO UPDATE SET
      icd11_title    = EXCLUDED.icd11_title,
      icd11_uri      = EXCLUDED.icd11_uri,
      diagnosis_type = EXCLUDED.diagnosis_type,
      sequence       = EXCLUDED.sequence,
      notes          = EXCLUDED.notes,
      updated_at     = NOW();

    seq := seq + 1;
  END LOOP;

  -- Delete rows for codes removed from the JSONB array
  DELETE FROM public.encounter_diagnoses
  WHERE encounter_id = NEW.id
    AND icd11_code != ALL(code_list);

  RETURN NEW;
END;
$function$;


-- ── 5. Attach trigger ─────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_sync_encounter_diagnoses ON public.encounters;

CREATE TRIGGER trg_sync_encounter_diagnoses
  AFTER INSERT OR UPDATE ON public.encounters
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_encounter_diagnoses_from_jsonb();


-- ── 6. Backfill existing encounters ──────────────────────────
-- Direct INSERT/ON CONFLICT — does not rely on triggering the
-- AFTER UPDATE trigger (which Postgres optimises away for no-op updates).

INSERT INTO public.encounter_diagnoses (
  id, encounter_id, icd11_code, icd11_title, icd11_uri,
  diagnosis_type, sequence, notes, created_by, created_at, updated_at
)
SELECT
  gen_random_uuid(),
  e.id,
  trim(diag->>'icd11_code'),
  COALESCE(trim(diag->>'description'), ''),
  (SELECT uri FROM public.icd11_codes
   WHERE code = trim(diag->>'icd11_code') LIMIT 1),
  'final',
  (row_number() OVER (PARTITION BY e.id ORDER BY ordinality))::integer,
  NULLIF(trim(diag->>'notes'), ''),
  e.created_by,
  NOW(),
  NOW()
FROM public.encounters e
CROSS JOIN LATERAL jsonb_array_elements(e.diagnoses)
  WITH ORDINALITY AS arr(diag, ordinality)
WHERE e.diagnoses IS NOT NULL
  AND jsonb_array_length(e.diagnoses) > 0
  AND diag->>'icd11_code' IS NOT NULL
  AND trim(diag->>'icd11_code') <> ''
ON CONFLICT ON CONSTRAINT encounter_diagnoses_encounter_code_uniq
DO UPDATE SET
  icd11_title    = EXCLUDED.icd11_title,
  icd11_uri      = EXCLUDED.icd11_uri,
  diagnosis_type = EXCLUDED.diagnosis_type,
  sequence       = EXCLUDED.sequence,
  notes          = EXCLUDED.notes,
  updated_at     = NOW();