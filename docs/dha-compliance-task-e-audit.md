# DHA Compliance — Task E: Audit Log Completeness

**Status:** ✅ Complete  
**Date:** 2026-07-30  
**Migration:** `supabase/migrations/20260730150000_dha_task_e_audit_completeness.sql`  
**Author:** Francis Muhoro  

---

## Background

DHA certification requires immutable audit logs covering all clinical
data changes, security/access changes, and pharmacy/stock movements.

Aegiscare already had an `audit_log` table and a reusable
`audit_trigger_fn()` function covering 8 tables. This migration
extends coverage to 12 additional tables.

---

## Audit log table structure

| Column | Type | Description |
|---|---|---|
| `id` | uuid | Unique log entry |
| `table_name` | text | Which table changed |
| `record_id` | uuid | Which row changed |
| `action` | text | INSERT / UPDATE / DELETE |
| `old_data` | jsonb | Full row before change |
| `new_data` | jsonb | Full row after change |
| `changed_by` | uuid | Supabase auth.uid() |
| `changed_at` | timestamp | When the change happened |

---

## Tables audited before Task E (8 tables)

| Table | Category |
|---|---|
| `admissions` | Clinical |
| `encounters` | Clinical |
| `invoice_line_items` | Finance |
| `invoice_payments` | Finance |
| `invoices` | Finance |
| `lab_tests` | Lab (legacy) |
| `patients` | Demographics |
| `prescriptions` | Pharmacy |

---

## Tables added by Task E (12 tables)

### Priority 1 — Clinical data

| Table | Why |
|---|---|
| `lab_orders` | Lab test requests — clinical decision trail |
| `lab_results` | Lab results — core clinical record |
| `radiology_orders` | Radiology requests |
| `radiology_results` | Radiology reports |
| `clinical_notes` | Doctor and discharge notes |
| `encounter_diagnoses` | ICD-11 structured diagnoses |

### Priority 2 — Security / access

| Table | Why |
|---|---|
| `user_roles` | Who gets what role — security critical |
| `role_permissions` | What each role can do |
| `user_room_access` | Room access grants |
| `app_settings` | Facility configuration changes |

### Priority 3 — Pharmacy / stock

| Table | Why |
|---|---|
| `stock_movements` | Drug stock in/out — regulatory requirement |
| `stock_items` | Drug inventory changes |

---

## Total coverage after Task E

- **20 tables** audited
- **60 triggers** (INSERT + UPDATE + DELETE per table)
- **829 existing audit rows** (pre-Task E historical data)
- All changes captured with full before/after JSONB snapshots

---

## What is NOT audited (intentional)

| Table | Reason |
|---|---|
| `moh_*` tables | Computed aggregates — not source clinical data |
| `icd11_codes` | Reference data, not patient data |
| `encounter_room_visits` | Operational routing — not clinical |
| `encounter_indicator_tags` | Computed — not clinical |
| `audit_log` | Cannot audit the audit log itself |
| `room_indicator_map` | Configuration only |

---

## DHA Compliance task tracker

| Task | Description | Status |
|---|---|---|
| A | ICD-11 structured diagnosis coding | ✅ Complete |
| B | FHIR resource mapping layer | ✅ Complete |
| C | SHA API integration | ⏳ Blocked — needs sandbox credentials |
| D | Security hardening Phase 1 | ✅ Complete |
| E | Audit log completeness | ✅ Complete |
| F | ICD-11 WHO API key configuration | ⏳ Pending — needs WHO credentials |