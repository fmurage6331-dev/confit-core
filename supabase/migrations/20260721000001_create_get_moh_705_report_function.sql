-- Migration: Create MOH 705 Reporting RPC Function
-- Location: supabase/migrations/20260721000001_create_get_moh_705_report_function.sql

BEGIN;

CREATE OR REPLACE FUNCTION public.get_moh_705_report(
    p_start_date TIMESTAMP WITH TIME ZONE,
    p_end_date TIMESTAMP WITH TIME ZONE,
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
            e.icd11_code,
            e.diagnosis_notes,
            e.status,
            e.created_at,
            COALESCE(p.sex, p.gender) AS patient_gender,
            COALESCE(p.dob, p.date_of_birth) AS patient_dob
        FROM public.encounter_records e
        JOIN public.patients p ON e.patient_id = p.id
        WHERE e.created_at >= p_start_date 
          AND e.created_at <= p_end_date
          AND (
              CASE 
                  WHEN p_form_type = 'A' THEN (EXTRACT(YEAR FROM AGE(e.created_at, COALESCE(p.dob, p.date_of_birth))) < 5)
                  ELSE (EXTRACT(YEAR FROM AGE(e.created_at, COALESCE(p.dob, p.date_of_birth))) >= 5)
              END
          )
    ),
    mapped_encounters AS (
        SELECT 
            m.row_number AS map_row_number,
            fe.patient_gender
        FROM public.moh_705_disease_mappings m
        JOIN filtered_encounters fe ON (
            (m.icd11_chapter_block IS NOT NULL AND fe.icd11_code LIKE m.icd11_chapter_block || '%')
            OR 
            (m.keyword_pattern IS NOT NULL AND fe.diagnosis_notes ILIKE m.keyword_pattern)
        )
        WHERE (
            m.requires_deceased_status = FALSE 
            OR (m.requires_deceased_status = TRUE AND fe.status = 'deceased')
        )
    )
    SELECT 
        m.row_number,
        m.disease_name,
        COALESCE(m.icd11_chapter_block, 'N/A') AS icd11_code,
        COUNT(me.map_row_number)::BIGINT AS total_cases,
        COUNT(CASE WHEN me.patient_gender ILIKE 'male' OR me.patient_gender ILIKE 'm' THEN 1 END)::BIGINT AS male_cases,
        COUNT(CASE WHEN me.patient_gender ILIKE 'female' OR me.patient_gender ILIKE 'f' THEN 1 END)::BIGINT AS female_cases
    FROM public.moh_705_disease_mappings m
    LEFT JOIN mapped_encounters me ON m.row_number = me.map_row_number
    GROUP BY m.row_number, m.disease_name, m.icd11_chapter_block
    ORDER BY m.row_number ASC;
END;
$$;

-- Grant execution privileges
GRANT EXECUTE ON FUNCTION public.get_moh_705_report(TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_moh_705_report(TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, TEXT) TO service_role;

COMMIT;
