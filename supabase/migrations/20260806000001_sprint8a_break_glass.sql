-- Sprint 8A: Break-Glass Emergency Access
-- DHA Certification scoring-tool Required line item
-- Writes a BREAK_GLASS audit event — distinct from normal audit trail

CREATE OR REPLACE FUNCTION public.log_break_glass_access(
  p_patient_id    uuid,
  p_justification text,
  p_accessed_by   uuid,
  p_accessor_email text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_justification IS NULL OR trim(p_justification) = '' THEN
    RAISE EXCEPTION 'Break-glass justification is required';
  END IF;

  INSERT INTO public.audit_log (
    id,
    table_name,
    record_id,
    action,
    old_data,
    new_data,
    changed_by,
    changed_at
  ) VALUES (
    gen_random_uuid(),
    'patients',
    p_patient_id,
    'BREAK_GLASS',
    NULL,
    jsonb_build_object(
      'justification',      trim(p_justification),
      'accessed_by_email',  p_accessor_email,
      'accessed_at',        NOW()
    ),
    p_accessed_by,
    NOW()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.log_break_glass_access(uuid, text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_break_glass_access(uuid, text, uuid, text) TO authenticated;
