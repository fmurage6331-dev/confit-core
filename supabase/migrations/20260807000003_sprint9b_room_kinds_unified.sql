-- Sprint 9B: Unified Room Kinds
-- 1. Null out orphaned visit for Ward 1 (preserve history)
UPDATE public.encounter_room_visits
SET room_id = NULL
WHERE room_id = 'bc9dc45f-f5dc-4bb1-8127-a6a34c661778';

-- 2. Drop and recreate rooms_kind_check with 4 new kinds
ALTER TABLE public.rooms DROP CONSTRAINT IF EXISTS rooms_kind_check;
ALTER TABLE public.rooms ADD CONSTRAINT rooms_kind_check
  CHECK (kind IN (
    'general','lab','radiology','triage','consultation',
    'pharmacy','billing','insurance',
    'ward','theatre','mortuary','mch'
  ));

-- 3. Add ward_id FK to rooms
ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS ward_id uuid REFERENCES public.wards(id) ON DELETE SET NULL;

-- 4. Update Theatre, Mortuary, MCH kinds (keep their IDs)
UPDATE public.rooms SET kind = 'theatre'  WHERE id = 'b7f224a2-5ed4-448d-9836-e0e7ec18e705';
UPDATE public.rooms SET kind = 'mortuary' WHERE id = '214aca6c-cbde-40ce-af5a-92cc7815bda9';
UPDATE public.rooms SET kind = 'mch'      WHERE id = 'a1111111-1111-1111-1111-111111111111';

-- 5. Delete all generic ward placeholders (0 visits except Ward 1 already nulled)
DELETE FROM public.rooms WHERE id IN (
  'bc9dc45f-f5dc-4bb1-8127-a6a34c661778',
  '9ccdb47b-728e-4dc5-9f1b-bd9c25e76091',
  '2e2f0432-cbc9-4720-aef2-8b90e05e64d2',
  '14bd5910-5969-4913-b7f0-8e6a8c5927e0',
  '16f8c358-f386-40f9-968e-14341b8c3fb2',
  '1f4c75ac-4f55-4ad0-8ea0-d673fdad13d1',
  '0cf1d4d9-820f-4c4b-b8fe-04725f18ae93',
  '7047bf53-4766-4c5e-afc3-1c19277374ae',
  '40a08441-0ff8-46ba-b246-205a3ad7fb72'
);

-- 6. Insert 15 real clinical ward rooms — one per ward
INSERT INTO public.rooms (name, kind, ward_id, is_active) VALUES
  ('Female Casualty',            'ward', 'd3517f5d-405b-4c04-9d39-2e64ff91e75a', true),
  ('Female Internal Medicine',   'ward', '4f8dd5fe-38ae-4620-adc5-f271c63ce80d', true),
  ('Female Maternity',           'ward', '2ef71f09-db4d-4a89-af18-51e500898daa', true),
  ('Female Orthopedics',         'ward', '46b83c44-59e6-44cf-9b22-4c40c5834a4f', true),
  ('Female Surgical',            'ward', '027fdf0c-10ef-4de5-add9-ff393f5f87db', true),
  ('General Ward A',             'ward', '0b656213-12c2-43fc-953e-6093aea7faf0', true),
  ('Male Casualty',              'ward', 'c28d7991-0f25-4396-89a4-8d7062370dcb', true),
  ('Male Internal Medicine',     'ward', 'f832f326-1c47-4bf5-90c8-c88cc71f1a70', true),
  ('Male Orthopedics',           'ward', 'da017af8-2916-4f8c-a008-86656945e58f', true),
  ('Male Surgical',              'ward', '3343f364-bc93-4448-8ae7-ab11111d7582', true),
  ('Maternity Ward',             'ward', '67a05b48-7234-444b-b397-3445314f0b50', true),
  ('Paediatrics Casualty',       'ward', '58b527b7-2f6b-4052-94c8-3c40df189656', true),
  ('Paediatrics Internal Medicine','ward','16884054-2e4a-4345-a1c5-209e50c2a139', true),
  ('Paediatrics Orthopedics',    'ward', 'bfa9d9f5-4801-4638-abbb-fc5c584dd22c', true),
  ('Paediatrics Surgical',       'ward', '257c9b9d-680a-4ef2-912f-d0b6f6a38b6b', true);
