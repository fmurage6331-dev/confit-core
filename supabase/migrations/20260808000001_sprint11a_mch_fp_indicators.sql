-- Sprint 11A: MCH/FP indicator setup
-- 1. Remove duplicate moh_indicator_definitions rows
DELETE FROM public.moh_indicator_definitions
WHERE id IN (
  '88a58f0a-60df-435e-aa29-1b661d3a87b9',
  'a6864253-2d05-4632-acb3-02390b41817a'
);

-- 2. Fix room_indicator_map schema — composite PK
ALTER TABLE public.room_indicator_map DROP CONSTRAINT room_indicator_map_pkey;
ALTER TABLE public.room_indicator_map
  ADD CONSTRAINT room_indicator_map_pkey
  PRIMARY KEY (room_id, indicator_code);

-- 3. Add all FP indicators to room_indicator_map for MCH room
INSERT INTO public.room_indicator_map (room_id, indicator_code)
VALUES
  ('a1111111-1111-1111-1111-111111111111', 'FP_NEW'),
  ('a1111111-1111-1111-1111-111111111111', 'FP_REVISIT'),
  ('a1111111-1111-1111-1111-111111111111', 'FP_CONSULTATION'),
  ('a1111111-1111-1111-1111-111111111111', 'FP_POP'),
  ('a1111111-1111-1111-1111-111111111111', 'FP_ECP'),
  ('a1111111-1111-1111-1111-111111111111', 'FP_INJECTABLE'),
  ('a1111111-1111-1111-1111-111111111111', 'FP_IMPLANT'),
  ('a1111111-1111-1111-1111-111111111111', 'FP_IUCD'),
  ('a1111111-1111-1111-1111-111111111111', 'FP_CONDOMS')
ON CONFLICT DO NOTHING;
