-- Migration: Fix MOH 705 Report Function
-- Replaces: 20260721000001_create_get_moh_705_report_function.sql
-- Issue: Original migration used non-existent table/columns (encounter_records, dob, etc.)
-- Fix: Updated to use actual schema (encounters, patients, diagnoses JSONB, date_of_birth)

BEGIN;

-- Drop old broken function if it exists
DROP FUNCTION IF EXISTS public.get_moh_705_report(DATE, DATE, TEXT);
DROP FUNCTION IF EXISTS public.get_moh_705_report(TIMESTAMPTZ, TIMESTAMPTZ, TEXT);

-- Create corrected function
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

-- Grant execution privileges
GRANT EXECUTE ON FUNCTION public.get_moh_705_report(DATE, DATE, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_moh_705_report(DATE, DATE, TEXT) TO service_role;

COMMIT;
