-- Add 'insurance' and 'billing' to rooms_kind_check constraint
-- Required for SHA / Insurance Desk room kind

ALTER TABLE public.rooms
  DROP CONSTRAINT rooms_kind_check;

ALTER TABLE public.rooms
  ADD CONSTRAINT rooms_kind_check
  CHECK (kind IN (
    'general',
    'lab',
    'radiology',
    'triage',
    'consultation',
    'pharmacy',
    'billing',
    'insurance'
  ));

-- Update existing SHA / Insurance Desk room
UPDATE public.rooms
SET kind = 'insurance'
WHERE id = 'bf58f666-80e8-4f1a-b9c1-9964a4c430b9';
