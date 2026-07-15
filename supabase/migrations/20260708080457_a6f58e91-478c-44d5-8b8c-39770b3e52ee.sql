
-- Add section column to group wards
ALTER TABLE public.wards ADD COLUMN IF NOT EXISTS section text;

-- Deactivate old wards (preserve history)
UPDATE public.wards SET is_active = false WHERE section IS NULL;

-- Seed the new ward structure
INSERT INTO public.wards (name, ward_type, section, gender_restriction, floor, capacity, daily_rate, is_active) VALUES
  ('Female Orthopedics',      'orthopedics',       'female',      'female', '1', 0, 2000, true),
  ('Female Casualty',         'casualty',          'female',      'female', '1', 0, 2000, true),
  ('Female Internal Medicine','internal_medicine', 'female',      'female', '1', 0, 2000, true),
  ('Female Surgical',         'surgical',          'female',      'female', '1', 0, 2500, true),
  ('Female Maternity',        'maternity',         'female',      'female', '2', 0, 2500, true),
  ('Male Orthopedics',        'orthopedics',       'male',        'male',   '1', 0, 2000, true),
  ('Male Casualty',           'casualty',          'male',        'male',   '1', 0, 2000, true),
  ('Male Internal Medicine',  'internal_medicine', 'male',        'male',   '1', 0, 2000, true),
  ('Male Surgical',           'surgical',          'male',        'male',   '1', 0, 2500, true),
  ('Paediatrics Orthopedics',       'orthopedics',       'paediatrics', 'mixed', '1', 0, 1800, true),
  ('Paediatrics Casualty',          'casualty',          'paediatrics', 'mixed', '1', 0, 1800, true),
  ('Paediatrics Internal Medicine', 'internal_medicine', 'paediatrics', 'mixed', '1', 0, 1800, true),
  ('Paediatrics Surgical',          'surgical',          'paediatrics', 'mixed', '1', 0, 2200, true)
ON CONFLICT DO NOTHING;
