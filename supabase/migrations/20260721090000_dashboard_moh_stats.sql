-- Dashboard aggregation functions.
--
-- Age is computed at the time of each encounter: if the patient's date of
-- birth is known (patients.dob_known), age is derived from it; otherwise
-- patients.estimated_age is used as-is. Age band is under-5 vs over-5,
-- matching standard MOH OPD reporting.

-- 1. Top 10 diagnosed diseases, split by under-5 / over-5, within a date range.
CREATE OR REPLACE FUNCTION public.dashboard_top_diseases(p_start date, p_end date)
RETURNS TABLE(age_band text, icd11_title text, disease_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH ages AS (
    SELECT e.id AS encounter_id,
      CASE
        WHEN p.dob_known AND p.date_of_birth IS NOT NULL
          THEN EXTRACT(YEAR FROM age(e.created_at::date, p.date_of_birth))::int
        ELSE COALESCE(p.estimated_age, 99)
      END AS age_years
    FROM encounters e
    JOIN patients p ON p.id = e.patient_id
    WHERE e.created_at::date BETWEEN p_start AND p_end
  ),
  diag AS (
    SELECT
      CASE WHEN a.age_years < 5 THEN 'under5' ELSE 'over5' END AS age_band,
      ed.icd11_title
    FROM ages a
    JOIN encounter_diagnoses ed ON ed.encounter_id = a.encounter_id
  ),
  counted AS (
    SELECT age_band, icd11_title, COUNT(*) AS disease_count,
      ROW_NUMBER() OVER (PARTITION BY age_band ORDER BY COUNT(*) DESC) AS rn
    FROM diag
    GROUP BY age_band, icd11_title
  )
  SELECT age_band, icd11_title, disease_count
  FROM counted
  WHERE rn <= 10
  ORDER BY age_band, disease_count DESC;
$$;

-- 2. General OPD attendance, split by under-5 / over-5, within a date range.
--    "OPD" = outpatient encounters (encounter_type is null or 'outpatient').
CREATE OR REPLACE FUNCTION public.dashboard_opd_attendance(p_start date, p_end date)
RETURNS TABLE(age_band text, attendance_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH ages AS (
    SELECT
      CASE
        WHEN p.dob_known AND p.date_of_birth IS NOT NULL
          THEN EXTRACT(YEAR FROM age(e.created_at::date, p.date_of_birth))::int
        ELSE COALESCE(p.estimated_age, 99)
      END AS age_years
    FROM encounters e
    JOIN patients p ON p.id = e.patient_id
    WHERE e.created_at::date BETWEEN p_start AND p_end
      AND COALESCE(e.encounter_type, 'outpatient') = 'outpatient'
  )
  SELECT
    CASE WHEN age_years < 5 THEN 'under5' ELSE 'over5' END AS age_band,
    COUNT(*) AS attendance_count
  FROM ages
  GROUP BY 1;
$$;

-- 3. Daily admitted vs OPD visit counts within a date range, for the
--    "Admitted/OPD Visits" chart.
CREATE OR REPLACE FUNCTION public.dashboard_admitted_opd_trend(p_start date, p_end date)
RETURNS TABLE(day date, admitted_count bigint, opd_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH days AS (
    SELECT generate_series(p_start, p_end, interval '1 day')::date AS day
  ),
  adm AS (
    SELECT admitted_at::date AS day, COUNT(*) AS cnt
    FROM admissions
    WHERE admitted_at::date BETWEEN p_start AND p_end
    GROUP BY 1
  ),
  opd AS (
    SELECT created_at::date AS day, COUNT(*) AS cnt
    FROM encounters
    WHERE created_at::date BETWEEN p_start AND p_end
      AND COALESCE(encounter_type, 'outpatient') = 'outpatient'
    GROUP BY 1
  )
  SELECT d.day, COALESCE(a.cnt, 0) AS admitted_count, COALESCE(o.cnt, 0) AS opd_count
  FROM days d
  LEFT JOIN adm a ON a.day = d.day
  LEFT JOIN opd o ON o.day = d.day
  ORDER BY d.day;
$$;

-- NOTE: "Number of Emergency Cases Seen" and "Total Referrals IN/OUT" are NOT
-- covered by these functions — there is currently no emergency flag or
-- referral-direction field anywhere in the schema, so there is nothing to
-- query yet. The dashboard will show these as 0 until that data is captured
-- somewhere (e.g. an is_emergency flag on encounters, and a referral_direction
-- field at registration). See chat for the follow-up question on this.
