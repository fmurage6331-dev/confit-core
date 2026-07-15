
-- Room kinds (lab vs general) and per-user access list
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'general'
  CHECK (kind IN ('general','lab'));

-- Per-user room access controlled by admin
CREATE TABLE IF NOT EXISTS public.user_room_access (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  granted_by uuid,
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, room_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_room_access TO authenticated;
GRANT ALL ON public.user_room_access TO service_role;

ALTER TABLE public.user_room_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage room access" ON public.user_room_access
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users view their own room access" ON public.user_room_access
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Helper: can a user enter a given room? Admin always yes.
CREATE OR REPLACE FUNCTION public.can_access_room(_user uuid, _room uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user, 'admin')
      OR EXISTS (SELECT 1 FROM public.user_room_access WHERE user_id = _user AND room_id = _room);
$$;
GRANT EXECUTE ON FUNCTION public.can_access_room(uuid, uuid) TO authenticated;

-- Patient registration target room (where the request currently sits).
ALTER TABLE public.patient_registrations
  ADD COLUMN IF NOT EXISTS current_room_id uuid REFERENCES public.rooms(id) ON DELETE SET NULL;

-- Auto-route registrations with tests to the lab room on insert.
CREATE OR REPLACE FUNCTION public.route_registration_to_lab()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE _lab uuid;
BEGIN
  IF NEW.current_room_id IS NULL
     AND NEW.tests IS NOT NULL
     AND jsonb_array_length(NEW.tests) > 0 THEN
    SELECT id INTO _lab FROM public.rooms WHERE kind='lab' AND is_active LIMIT 1;
    NEW.current_room_id := _lab;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_route_reg_to_lab ON public.patient_registrations;
CREATE TRIGGER trg_route_reg_to_lab
BEFORE INSERT ON public.patient_registrations
FOR EACH ROW EXECUTE FUNCTION public.route_registration_to_lab();

-- Ensure a Laboratory room exists.
INSERT INTO public.rooms (name, code, kind, is_active)
SELECT 'Laboratory', 'LAB', 'lab', true
WHERE NOT EXISTS (SELECT 1 FROM public.rooms WHERE kind='lab');
