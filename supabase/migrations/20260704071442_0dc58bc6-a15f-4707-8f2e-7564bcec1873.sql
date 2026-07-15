INSERT INTO public.rooms (name, kind, is_active)
VALUES ('Triage', 'triage', true),
       ('Consultation', 'consultation', true)
ON CONFLICT DO NOTHING;