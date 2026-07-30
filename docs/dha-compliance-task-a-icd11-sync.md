# DHA Compliance — Task A: ICD-11 Diagnosis Sync

**Status:** ✅ Complete  
**Date:** 2026-07-30  
**Migration:** `supabase/migrations/20260730120000_dha_icd11_encounter_diagnoses_sync.sql`  
**Author:** Francis Muhoro  

---

## Background

Kenya's Digital Health Act (DHA) requires hospital software to be DHA-certified
for Social Health Authority (SHA) contracting. One core requirement is structured
ICD-11 diagnosis coding that can be mapped to FHIR Condition resources and
included in SHA electronic claims.

Aegiscare already stored diagnoses in `encounters.diagnoses` as a JSONB array.
This was not queryable per code, not FHIR-ready, and not SHA claims compatible.

---

## Problem

`encounter_diagnoses` table existed but was always empty because:

1. Nothing was writing to it — diagnoses were only written to the JSONB column
2. Its BEFORE INSERT trigger (`clean_and_validate_diagnosis_insert`) had a bug:
   it referenced `NEW.diagnosis_name` which does not exist on the table.
   The correct column is `NEW.icd11_title`. This caused every INSERT to fail.

---

## Solution

### Schema changes

| Change | Reason |
|---|---|
| Added `sequence integer` column | Preserves diagnosis order — required for SHA claims (primary diagnosis must be rank 1) |
| Expanded `diagnosis_type` CHECK constraint | Added `final`, `working`, `admission`, `discharge` to the original `primary`, `secondary`, `differential` |

### Trigger: `trg_sync_encounter_diagnoses`

- Fires **AFTER INSERT OR UPDATE** on `encounters`
- Only runs when `diagnoses` JSONB actually changed (no-op guard)
- Upserts each JSONB array element into `encounter_diagnoses`
- Sets `diagnosis_type = 'final'` (maps to FHIR `Condition.verificationStatus = confirmed`)
- Sets `sequence` from 1-based array position
- Deletes rows for codes removed from the JSONB (keeps tables in sync)
- Uses `SECURITY DEFINER` so RLS does not block the write

### Bug fix: `clean_and_validate_diagnosis_insert`

Corrected `NEW.diagnosis_name` → `NEW.icd11_title` so ICD-11 validation
works correctly on INSERT.

### Backfill

All existing encounters with non-empty `diagnoses` JSONB were backfilled
into `encounter_diagnoses` using a direct INSERT/ON CONFLICT statement.

---

## FHIR mapping (Task B — future)

`encounter_diagnoses` rows map to FHIR **Condition** resources:

| `encounter_diagnoses` column | FHIR field |
|---|---|
| `encounter_id` | `Condition.encounter` |
| `icd11_code` | `Condition.code.coding.code` |
| `icd11_title` | `Condition.code.coding.display` |
| `icd11_uri` | `Condition.code.coding.system` |
| `diagnosis_type = 'final'` | `Condition.verificationStatus = confirmed` |
| `sequence = 1` | `Encounter.diagnosis.rank = 1` (primary) |
| `notes` | `Condition.note` |

---

## SHA claims mapping (Task C — future)

| `encounter_diagnoses` column | SHA claim field |
|---|---|
| `icd11_code` | `diagnosis.code` |
| `sequence` | `diagnosis.sequence` |
| `diagnosis_type` | `diagnosis.type` |

---

## DHA Compliance task tracker

| Task | Description | Status |
|---|---|---|
| A | ICD-11 structured diagnosis coding | ✅ Complete |
| B | FHIR resource mapping layer | ⬜ Ready to start |
| C | SHA API integration (OAuth2, eligibility, claims) | ⏳ Blocked — needs sandbox credentials |
| D | Security hardening (MFA, RLS role gap fix) | ⬜ Ready to start |
| E | Audit log completeness review | ⬜ Ready to start |