-- Migration: Full MOH Production Sync
-- Date: 22 Jul 2026
-- Captures all MOH-related schema changes applied directly to production
--
-- This migration:
--   1. Fixes the get_moh_705_report function (replaces the broken original)
--   2. Enhances tag_encounter_demographics with OPD_NEW/REVISIT indicators
--   3. Enhances process_encounter_indicators with fp_method and drug_class criteria
--   4. Updates the trigger to fire on INSERT and UPDATE OF tests
--   5. Adds an FP/MCH room
--   6. Adds FP stock items
--   7. Adds FP indicator definitions
--   8. Maps FP indicators to the FP/MCH room
--
-- Prerequisite: Adds missing unique constraints needed by ON CONFLICT clauses

BEGIN;

-- ============================================================================
-- SECTION 0: Missing Constraints (prerequisites for ON CONFLICT clauses)
-- ============================================================================

-- encounter_indicator_tags needs a unique constraint on (encounter_id, indicator_code)
-- for the ON CONFLICT clauses in tag_encounter_demographics and process_encounter_indicators
CREATE UNIQUE INDEX IF NOT EXISTS encounter_indicator_tags_encounter_indicator_uniq
    ON public.encounter_indicator_tags (encounter_id, indicator_code);

-- moh_indicator_definitions needs a PRIMARY KEY (id column is uuid but no PK was declared)
ALTER TABLE public.moh_indicator_definitions
    ADD CONSTRAINT moh_indicator_definitions_pkey PRIMARY KEY (id);

-- room_indicator_map needs a primary key or unique constraint for ON CONFLICT
CREATE UNIQUE INDEX IF NOT EXISTS room_indicator_map_room_indicator_uniq
    ON public.room_indicator_map (room_id, indicator_code);

-- ============================================================================
-- SECTION 1: MOH 705 Report Function
-- ============================================================================

-- Fix: Original migration used non-existent table/columns (encounter_records, dob)
-- Corrected to use actual schema (encounters, patients, diagnoses JSONB, date_of_birth)
DROP FUNCTION IF EXISTS public.get_moh_705_report(DATE, DATE, TEXT);
DROP FUNCTION IF EXISTS public.get_moh_705_report(TIMESTAMPTZ, TIMESTAMPTZ, TEXT);

CREATE OR REPLACE FUNCTION public.get_moh_705_report(
    p_start_date DATE,
    p_end_date DATE,
    p_form_type TEXT DEFAULT 'A' -- 'A' for Under 5, 'B' for Over 5
)
RETURNS TABLE (
    row_number INT,
    disease_name TEXT,
    icd11_code TEXT,
    total_cases BIGINT,
    male_cases BIGINT,
    female_cases BIGINT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$

BEGIN

    RETURN QUERY

    WITH filtered_encounters AS (

        SELECT 
            e.id AS encounter_id,
            e.status,
            e.created_at,
            p.sex AS patient_gender,
            CASE 
                WHEN p.dob_known = true THEN 
                    EXTRACT(YEAR FROM AGE(e.created_at, p.date_of_birth))::INT
                WHEN p.estimated_age IS NOT NULL THEN 
                    p.estimated_age
            END AS patient_age

        FROM public.encounters e

        JOIN public.patients p ON e.patient_id = p.id

        WHERE e.created_at >= p_start_date::TIMESTAMPTZ

          AND e.created_at < (p_end_date::DATE + INTERVAL '1 day')::TIMESTAMPTZ

          AND (

                CASE p_form_type

                    WHEN 'A' THEN (

                        CASE 
                            WHEN p.dob_known = true THEN 
                                EXTRACT(YEAR FROM AGE(e.created_at, p.date_of_birth)) < 5
                            WHEN p.estimated_age IS NOT NULL THEN 
                                p.estimated_age < 5
                            ELSE false
                        END

                    )

                    WHEN 'B' THEN (

                        CASE 
                            WHEN p.dob_known = true THEN 
                                EXTRACT(YEAR FROM AGE(e.created_at, p.date_of_birth)) >= 5
                            WHEN p.estimated_age IS NOT NULL THEN 
                                p.estimated_age >= 5
                            ELSE false
                        END

                    )

                    ELSE true

                END

            )

    ),

    diagnosis_matches AS (

        SELECT 
            fe.encounter_id,
            fe.patient_gender,
            fe.status,
            diag.icd11_code,
            diag.description

        FROM filtered_encounters fe

        CROSS JOIN LATERAL jsonb_array_elements(fe.diagnoses) WITH ORDINALITY AS arr(diag, idx)

        WHERE fe.diagnoses IS NOT NULL

          AND jsonb_array_length(fe.diagnoses) > 0

    )

    SELECT 
        m.row_number,
        m.disease_name,
        COALESCE(m.icd11_chapter_block, 'N/A') AS icd11_code,

        COUNT(DISTINCT CASE 
            WHEN (m.requires_deceased_status = FALSE OR dm.status = 'deceased') 
            THEN dm.encounter_id 
        END)::BIGINT AS total_cases,

        COUNT(DISTINCT CASE 
            WHEN dm.patient_gender ILIKE 'male' OR dm.patient_gender ILIKE 'm' 
            THEN dm.encounter_id 
        END)::BIGINT AS male_cases,

        COUNT(DISTINCT CASE 
            WHEN dm.patient_gender ILIKE 'female' OR dm.patient_gender ILIKE 'f' 
            THEN dm.encounter_id 
        END)::BIGINT AS female_cases

    FROM public.moh_705_disease_mappings m

    LEFT JOIN diagnosis_matches dm ON 
        (m.icd11_chapter_block IS NOT NULL AND dm.icd11_code LIKE (m.icd11_chapter_block || '%'))
        OR (m.keyword_pattern IS NOT NULL AND dm.description ILIKE m.keyword_pattern)

    GROUP BY m.row_number, m.disease_name, m.icd11_chapter_block

    ORDER BY m.row_number;

END;

$$;

GRANT EXECUTE ON FUNCTION public.get_moh_705_report(DATE, DATE, TEXT) TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_moh_705_report(DATE, DATE, TEXT) TO service_role;

-- ============================================================================
-- SECTION 2: Tag Encounter Demographics Function (with New/Revisit)
-- ============================================================================

-- Adds OPD_NEW_M, OPD_NEW_F, OPD_REVISIT_M, OPD_REVISIT_F indicators

CREATE OR REPLACE FUNCTION public.tag_encounter_demographics()

RETURNS trigger

LANGUAGE plpgsql

AS $$

declare 
  v_age int; 
  v_sex text; 
  v_indicator text;
  v_new_revisit text;

begin

  -- Exit if not outpatient

  if NEW.encounter_type is distinct from 'outpatient' then

    return NEW; 

  end if;

  -- Get patient demographics

  select 
    case when dob_known and date_of_birth is not null 
      then date_part('year', age(current_date, date_of_birth))::int 
      else estimated_age 
    end, 
    lower(sex)

  into v_age, v_sex 

  from patients 

  where id = NEW.patient_id;

  if v_age is null then 

    return NEW; 

  end if;

  -- Age-based tags

  if v_age >= 60 then 

    v_indicator := 'OPD_OVER60';

  elsif v_age < 5 then 

    v_indicator := case when v_sex like 'm%' then 'OPD_UNDER5_M' when v_sex like 'f%' then 'OPD_UNDER5_F' else null end;

  else 

    v_indicator := case when v_sex like 'm%' then 'OPD_OVER5_M' when v_sex like 'f%' then 'OPD_OVER5_F' else null end;

  end if;

  -- New vs Revisit tags

  -- NEW = first-ever encounter for this patient

  -- REVISIT = patient has prior encounters

  if NOT EXISTS (

    SELECT 1 FROM encounters 

    WHERE patient_id = NEW.patient_id 

      AND id != NEW.id

      AND created_at < NEW.created_at

  ) THEN

    v_new_revisit := case 
      when v_sex like 'm%' then 'OPD_NEW_M' 
      when v_sex like 'f%' then 'OPD_NEW_F' 
      else null 
    end;

  else

    v_new_revisit := case 
      when v_sex like 'm%' then 'OPD_REVISIT_M' 
      when v_sex like 'f%' then 'OPD_REVISIT_F' 
      else null 
    end;

  end if;

  -- Insert age-based tag

  if v_indicator is not null then

    insert into encounter_indicator_tags (encounter_id, indicator_code, tagged_by) 

    values (NEW.id, v_indicator, 'system') 

    on conflict (encounter_id, indicator_code) do nothing;

  end if;

  -- Insert New/Revisit tag

  if v_new_revisit is not null then

    insert into encounter_indicator_tags (encounter_id, indicator_code, tagged_by) 

    values (NEW.id, v_new_revisit, 'system') 

    on conflict (encounter_id, indicator_code) do nothing;

  end if;

  return NEW;

end;

$$;

GRANT EXECUTE ON FUNCTION public.tag_encounter_demographics() TO authenticated;

GRANT EXECUTE ON FUNCTION public.tag_encounter_demographics() TO service_role;

-- ============================================================================
-- SECTION 3: Process Encounter Indicators Function (with fp_method support)
-- ============================================================================

-- Adds support for fp_method and drug_class criteria types

CREATE OR REPLACE FUNCTION public.process_encounter_indicators()

RETURNS trigger

LANGUAGE plpgsql

AS $$

DECLARE 
  patient_age INT; 
  def RECORD;

BEGIN

  -- Get patient age

  SELECT EXTRACT(YEAR FROM AGE(date_of_birth)) INTO patient_age 

  FROM patients WHERE id = NEW.patient_id;

  FOR def IN SELECT * FROM moh_indicator_definitions LOOP

    -- Age range criteria

    IF def.criteria_type = 'age_range' THEN

      IF def.criteria_value = '<5' AND patient_age < 5 THEN

        INSERT INTO encounter_indicator_tags (encounter_id, indicator_code) 

        VALUES (NEW.id, def.indicator_code)

        ON CONFLICT (encounter_id, indicator_code) DO NOTHING;

      ELSIF def.criteria_value = '>=5' AND patient_age >= 5 THEN

        INSERT INTO encounter_indicator_tags (encounter_id, indicator_code) 

        VALUES (NEW.id, def.indicator_code)

        ON CONFLICT (encounter_id, indicator_code) DO NOTHING;

      END IF;

    -- Lab test criteria

    ELSIF def.criteria_type = 'lab_test' AND EXISTS (

      SELECT 1 FROM jsonb_array_elements(NEW.tests) t 

      JOIN lab_test_catalog c ON c.id = (t->>'id')::uuid 

      WHERE c.category = def.criteria_value

    ) THEN

      INSERT INTO encounter_indicator_tags (encounter_id, indicator_code) 

      VALUES (NEW.id, def.indicator_code)

      ON CONFLICT (encounter_id, indicator_code) DO NOTHING;

    -- FP method criteria (from prescriptions)

    ELSIF def.criteria_type = 'fp_method' AND EXISTS (

      SELECT 1 FROM prescriptions p

      JOIN stock_items s ON p.stock_item_id = s.id

      WHERE p.registration_id = NEW.id 

        AND s.category = def.criteria_value

    ) THEN

      INSERT INTO encounter_indicator_tags (encounter_id, indicator_code) 

      VALUES (NEW.id, def.indicator_code)

      ON CONFLICT (encounter_id, indicator_code) DO NOTHING;

    -- Drug class criteria (from prescriptions)

    ELSIF def.criteria_type = 'drug_class' AND EXISTS (

      SELECT 1 FROM prescriptions p

      JOIN stock_items s ON p.stock_item_id = s.id

      WHERE p.registration_id = NEW.id 

        AND s.category LIKE (def.criteria_value || '%')

    ) THEN

      INSERT INTO encounter_indicator_tags (encounter_id, indicator_code) 

      VALUES (NEW.id, def.indicator_code)

      ON CONFLICT (encounter_id, indicator_code) DO NOTHING;

    END IF;

  END LOOP;

  RETURN NEW;

END;

$$;

GRANT EXECUTE ON FUNCTION public.process_encounter_indicators() TO authenticated;

GRANT EXECUTE ON FUNCTION public.process_encounter_indicators() TO service_role;

-- ============================================================================
-- SECTION 4: Trigger - Update to fire on INSERT and UPDATE OF tests
-- ============================================================================

DROP TRIGGER IF EXISTS trg_process_moh_indicators ON encounters;

CREATE TRIGGER trg_process_moh_indicators

AFTER INSERT OR UPDATE OF tests ON encounters

FOR EACH ROW EXECUTE FUNCTION process_encounter_indicators();

-- ============================================================================
-- SECTION 5: FP/MCH Room
-- ============================================================================

INSERT INTO rooms (id, name, kind, is_active)

VALUES ('a1111111-1111-1111-1111-111111111111', 'Family Planning / MCH', 'general', true)

ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- SECTION 6: FP Stock Items
-- ============================================================================

INSERT INTO stock_items (id, name, category, kind, unit, unit_price, cash_price)

VALUES

  ('f1111111-1111-1111-1111-111111111111', 'Male Condoms', 'Reproductive Health - Contraceptive', 'pharmaceutical', 'pcs', 0, 0),

  ('f2222222-2222-2222-2222-222222222222', 'Female Condoms', 'Reproductive Health - Contraceptive', 'pharmaceutical', 'pcs', 0, 0),

  ('f3333333-3333-3333-3333-333333333333', 'Combined Oral Contraceptive Pills', 'Reproductive Health - Contraceptive', 'pharmaceutical', 'cycle', 0, 0),

  ('f4444444-4444-4444-4444-444444444444', 'Progestin Pills (POP)', 'Reproductive Health - Contraceptive', 'pharmaceutical', 'cycle', 0, 0),

  ('f5555555-5555-5555-5555-555555555555', 'Emergency Contraceptive Pills', 'Reproductive Health - Contraceptive', 'pharmaceutical', 'course', 0, 0),

  ('f6666666-6666-6666-6666-666666666666', 'Depo Provera Injection', 'Reproductive Health - Contraceptive', 'pharmaceutical', 'vial', 0, 0),

  ('f7777777-7777-7777-7777-777777777777', 'Jadelle Implant', 'Reproductive Health - Contraceptive', 'pharmaceutical', 'set', 0, 0),

  ('f8888888-8888-8888-8888-888888888888', 'Implanon Implant', 'Reproductive Health - Contraceptive', 'pharmaceutical', 'set', 0, 0),

  ('f9999999-9999-9999-9999-999999999999', 'IUCD Copper T', 'Reproductive Health - Contraceptive', 'pharmaceutical', 'set', 0, 0)

ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- SECTION 7: FP Indicator Definitions
-- ============================================================================

INSERT INTO moh_indicator_definitions (id, form_number, indicator_code, description, criteria_type, criteria_value)

VALUES

  ('31111111-1111-1111-1111-111111111111', 'MOH_FP', 'FP_PILLS', 'Oral Contraceptive Pills', 'fp_method', 'Combined Oral Contraceptive Pills'),

  ('32222222-2222-2222-2222-222222222222', 'MOH_FP', 'FP_POP', 'Progestin Pills', 'fp_method', 'Progestin Pills (POP)'),

  ('33333333-3333-3333-3333-333333333333', 'MOH_FP', 'FP_ECP', 'Emergency Contraception', 'fp_method', 'Emergency Contraceptive Pills'),

  ('34444444-4444-4444-4444-444444444444', 'MOH_FP', 'FP_INJECTABLE', 'Injectable Contraceptives', 'fp_method', 'Depo Provera Injection'),

  ('35555555-5555-5555-5555-555555555555', 'MOH_FP', 'FP_IMPLANT', 'Implant Contraceptives', 'fp_method', 'Reproductive Health - Contraceptive'),

  ('36666666-6666-6666-6666-666666666666', 'MOH_FP', 'FP_IUCD', 'IUCD', 'fp_method', 'IUCD Copper T'),

  ('37777777-7777-7777-7777-777777777777', 'MOH_FP', 'FP_CONDOMS', 'Condoms', 'fp_method', 'Male Condoms')

ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- SECTION 8: FP Room Indicator Mappings
-- ============================================================================

INSERT INTO room_indicator_map (room_id, indicator_code)

VALUES

  ('a1111111-1111-1111-1111-111111111111', 'FP_PILLS'),

  ('a1111111-1111-1111-1111-111111111111', 'FP_POP'),

  ('a1111111-1111-1111-1111-111111111111', 'FP_ECP'),

  ('a1111111-1111-1111-1111-111111111111', 'FP_INJECTABLE'),

  ('a1111111-1111-1111-1111-111111111111', 'FP_IMPLANT'),

  ('a1111111-1111-1111-1111-111111111111', 'FP_IUCD'),

  ('a1111111-1111-1111-1111-111111111111', 'FP_CONDOMS')

ON CONFLICT (room_id, indicator_code) DO NOTHING;

COMMIT;
