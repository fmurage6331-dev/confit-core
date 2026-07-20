-- Adds a targeted version of send_lab_results_to_requesting_room() that routes
-- a patient back to a SPECIFIC room, instead of guessing from room-visit history.
--
-- Why: when a patient has overlapping test requests from more than one room in
-- the same visit (e.g. the consultation room requests bloods, and later a
-- general room requests an X-ray), the old history-based lookup could only ever
-- send the patient to "the last non-lab/billing room they visited" — which is
-- not necessarily the room that requested the specific test that just got
-- completed. The frontend now tags each requested test with the id of the room
-- that requested it (tests[].requested_by_room_id), and passes that room id in
-- here directly once every requested test for the visit is complete.
--
-- Falls back to the original history-based function when no room id is given,
-- or when the given room id doesn't correspond to an active room — so this is
-- safe to call for older/untagged requests too.

CREATE OR REPLACE FUNCTION public.send_lab_result_to_room(p_encounter_id uuid, p_room_id uuid)
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
  _room_id := public.send_lab_results_to_requesting_room(p_encounter_id);
  RETURN _room_id;
END;
$$;
