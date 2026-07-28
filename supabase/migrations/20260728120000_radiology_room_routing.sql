-- Radiology room-routing fix.
--
-- Problem: there is no "radiology" room kind, so any Radiology room is
-- stuck on kind = 'general'. send_lab_results_to_requesting_room() only
-- excludes ('billing', 'lab') when picking the room to send a patient
-- back to, so a patient who visited Radiology can get incorrectly routed
-- back there instead of Consultation once their LAB result finishes.
-- Separately, there is no equivalent routing function for radiology at
-- all, so finalizing a radiology report never routes the patient anywhere.
--
-- This migration:
--   1. Re-creates send_lab_results_to_requesting_room() to also exclude
--      'radiology' rooms from the candidate search.
--   2. Adds send_radiology_results_to_requesting_room() and
--      send_radiology_result_to_room(), mirroring the lab equivalents,
--      for use by src/routes/radiology.$id.tsx when a report is finalized.

CREATE OR REPLACE FUNCTION public.send_lab_results_to_requesting_room(p_encounter_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _room_id uuid;
BEGIN
  SELECT erv.room_id INTO _room_id FROM encounter_room_visits erv JOIN rooms r ON r.id = erv.room_id
  WHERE erv.encounter_id = p_encounter_id AND r.kind NOT IN ('billing', 'lab', 'radiology')
  ORDER BY erv.entered_at DESC LIMIT 1;
  IF _room_id IS NULL THEN RAISE EXCEPTION 'Could not determine a room to send this encounter back to'; END IF;
  UPDATE encounters SET current_room_id = _room_id WHERE id = p_encounter_id;
  RETURN _room_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.send_radiology_results_to_requesting_room(p_encounter_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _room_id uuid;
BEGIN
  SELECT erv.room_id INTO _room_id FROM encounter_room_visits erv JOIN rooms r ON r.id = erv.room_id
  WHERE erv.encounter_id = p_encounter_id AND r.kind NOT IN ('billing', 'lab', 'radiology')
  ORDER BY erv.entered_at DESC LIMIT 1;
  IF _room_id IS NULL THEN RAISE EXCEPTION 'Could not determine a room to send this encounter back to'; END IF;
  UPDATE encounters SET current_room_id = _room_id WHERE id = p_encounter_id;
  RETURN _room_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.send_radiology_result_to_room(p_encounter_id uuid, p_room_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _room_id uuid;
BEGIN
  IF p_room_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.rooms WHERE id = p_room_id AND is_active) THEN
    UPDATE public.encounters SET current_room_id = p_room_id WHERE id = p_encounter_id;
    RETURN p_room_id;
  END IF;

  -- No usable room id supplied — fall back to the original best-effort lookup.
  _room_id := public.send_radiology_results_to_requesting_room(p_encounter_id);
  RETURN _room_id;
END;
$$;
