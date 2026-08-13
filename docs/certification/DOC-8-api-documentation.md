# DOC-8 — API Documentation
## AegisCare HMS / LabTrack v5.5

| | |
|---|---|
| **System** | AegisCare HMS / LabTrack v5.5 |
| **Supabase project ref** | `tgynjasgnerucrlwedui` |
| **Base URL (Supabase)** | `https://tgynjasgnerucrlwedui.supabase.co` |
| **Base URL (DHA HIE)** | `https://ilm-dev.dha.go.ke/uat-middleware/api/v1` |
| **Document status** | DRAFT for certification submission |
| **Date** | 2026-08-12 |

---

## Section 1 — API Overview

AegisCare exposes four API surfaces:

| Surface | Base | Auth | Consumers |
|---|---|---|---|
| **Supabase REST (PostgREST)** | `https://tgynjasgnerucrlwedui.supabase.co/rest/v1/{table}` | Supabase JWT (anon key or user session) + RLS | Frontend (via `@supabase/supabase-js`), server functions |
| **Supabase Edge Functions** | `https://tgynjasgnerucrlwedui.supabase.co/functions/v1/{name}` | Supabase JWT (`verify_jwt = true` on all 5 functions) | Frontend, DHA/SHA integrations, certification tooling |
| **Supabase RPCs** | `…/rest/v1/rpc/{fn}` | Supabase JWT + RLS/GRANT | Frontend (e.g., `generate_fhir_encounter`, `get_moh_705_report`) |
| **DHA HIE (external target)** | `https://ilm-dev.dha.go.ke/uat-middleware/api/v1` | OAuth2 `POST /tenants/token` | 🔵 PENDING credentials |

All traffic is HTTPS. Response payloads for FHIR endpoints are served as
`application/fhir+json`.

---

## Section 2 — Authentication

### 2.1 Supabase Auth (in force)
- **Anonymous key (publishable):** `sb_publishable_…` — set as
  `VITE_SUPABASE_PUBLISHABLE_KEY`; used client-side; RLS restricts it to
  authenticated-approved data only.
- **User session JWT:** obtained from Supabase Auth (email/password); sent as
  `Authorization: Bearer <token>`; powers RLS (`auth.uid()`, `is_approved()`).
- **Service role key:** server-side only (`src/integrations/supabase/client.server.ts`,
  `supabaseAdmin`) — never exposed to the browser; used by admin server
  functions behind `requireSupabaseAuth` + `assertAdmin`.
- **Edge function calls:** `Authorization: Bearer <user JWT or anon key>` +
  `apikey` header; platform enforces `verify_jwt = true`.

### 2.2 DHA OAuth2 (external — pending)
- Endpoint: `POST https://ilm-dev.dha.go.ke/uat-middleware/api/v1/tenants/token`
- Body (JSON): `{ "client_id": "…", "client_secret": "…" }`
- Response: `{ "access_token": "…", "expires_in": …, "token_type": "…" }`
- Status: 🔵 PENDING — credentials require DHA developer-account onboarding
  (`https://developer.dha.go.ke`); facility headers `X-Facility-Id`
  (FR code) and `X-Facility-Id-Type: fr-code` apply to service-account calls
  (per hie-docs.dha.go.ke).

---

## Section 3 — Edge Functions API Reference

Common conventions:
- URL: `https://tgynjasgnerucrlwedui.supabase.co/functions/v1/{name}`
- Method: POST (JSON body); OPTIONS supported (CORS preflight).
- Headers: `Authorization: Bearer <jwt>`, `apikey: <key>`, `Content-Type: application/json`.
- All functions: **Authentication required** (platform JWT verification).

### 3.1 `claims-dispatcher`
| | |
|---|---|
| Endpoint | `/functions/v1/claims-dispatcher` |
| Method | POST |
| Authentication | Required (JWT + `supabase.auth.getUser()` in-function) |
| Status | ✅ **Live (stub mode)** — queues locally; external API calls pending credentials |

Request body:
```json
{
  "encounter_id": "uuid",
  "patient_id": "uuid",
  "insurer_type": "sha_shif | private | corporate | cash | null",
  "trigger": "encounter_closed | claim_submit | fhir_sync | manual"
}
```
Response (200):
```json
{
  "success": true,
  "encounter_id": "uuid",
  "results": [
    {
      "queue_type": "fhir_sync | sha_claim | private_claim | cash_receipt",
      "handler": "FhirSyncHandler | ShaClaimsHandler | PrivateClaimsHandler | CashReceiptHandler",
      "status": "queued | skipped",
      "queue_id": "uuid | null",
      "message": "…"
    }
  ],
  "note": "STUB MODE — All submissions queued locally. External API calls activated in Phase 3."
}
```
Errors: 400 (missing `encounter_id`/`patient_id`), 401 (missing/invalid auth),
500 (handler error). Behaviour: `FhirSyncHandler` checks
`patient_consents.hie_data_sharing_consented` and marks `fhir_sync` as
`skipped` when consent is absent; SHA/private/cash routes by `insurer_type`.

### 3.2 `fhir-patient`
| | |
|---|---|
| Endpoint | `/functions/v1/fhir-patient` |
| Method | POST |
| Authentication | Required |
| Status | ✅ **Live** |

Request: `{ "patient_id": "uuid" }` → Response 200 `application/fhir+json`:
FHIR R4 `Patient` (`id`, `meta.profile`, `identifier` [facility file number],
`name`, `gender`, `birthDate`, `telecom`, `address`, `deceasedBoolean`,
`managingOrganization`). 400 missing id; 404 unknown patient; 500 server error.

### 3.3 `fhir-encounter`
| | |
|---|---|
| Endpoint | `/functions/v1/fhir-encounter` |
| Method | POST |
| Authentication | Required |
| Status | ✅ **Live** |

Request: `{ "encounter_id": "uuid" }` → Response 200 `application/fhir+json`:
FHIR R4 `Encounter` (`status`, `class` AMB/IMP/EMER, `priority` for
emergencies, `subject`, `period`, `diagnosis[]` with `Condition/{id}`
references and rank, `serviceProvider` KMHFL identifier,
`hospitalization` for referrals out). 400/404/500 as above.

### 3.4 `fhir-condition`
| | |
|---|---|
| Endpoint | `/functions/v1/fhir-condition` |
| Method | POST |
| Authentication | Required |
| Status | ✅ **Live** |

Request: `{ "encounter_id": "uuid" }` → Response 200 `application/fhir+json`:
array of FHIR R4 `Condition` resources from `encounter_diagnoses`
(`verificationStatus` mapped from `diagnosis_type`, ICD-11 `code.coding`,
`subject`, `encounter`, `recordedDate`, `note`, sequence extension). Empty
array when no diagnoses. 400/404/500 as above.

### 3.5 `icd11-search`
| | |
|---|---|
| Endpoint | `/functions/v1/icd11-search` |
| Method | POST |
| Authentication | Required |
| Status | ✅ **Live** — returns 500 with `"ICD API credentials not configured"` until `ICD_CLIENT_ID`/`ICD_CLIENT_SECRET` secrets are set; frontend falls back to local `icd11_codes` |

Request: `{ "query": "string (≥2 chars)" }` → Response 200:
```json
{ "results": [ { "code": "1B12", "title": "Tuberculosis of nervous system", "uri": "https://id.who.int/icd/entity/…" } ] }
```
Errors: 400 (query too short), 500 (credentials missing / WHO API failure).

---

## Section 4 — DHA HIE API Integration

Base URL: `https://ilm-dev.dha.go.ke/uat-middleware/api/v1`
(all endpoints per the DHA HIE API catalogue, `https://hie-docs.dha.go.ke`).

| API | Endpoint | Status in AegisCare |
|---|---|---|
| **Auth** | `POST /tenants/token` | 🔵 PENDING credentials (needed by every other API) |
| **Client Registry** | `GET /patients?identification_number={n}&identification_type={National ID|ClientRegistry ID|Birth Notification|Birth Certificate|Alien ID|Refugee ID|Mandate Number}` | 🔵 PENDING — schema (`patients.cr_number`, `national_id*`) and UI ready; `verify_patient_identity()` is a stub RPC |
| **Eligibility** | `GET /patients/eligibility` · `GET /patients/benefits` · `GET /patients/benefits/interventions` · `GET /patients/benefits/utilization` · `GET /facilities/{facilityCode}/beds/occupancy` (headers `X-Facility-Id`, `X-Facility-Id-Type: fr-code`) | 🔵 PENDING — SHA notification-number placeholder (`TEMP-SHA-…`) until eligibility is live |
| **Preauth** | eClaims & Preauth catalogue (`/preauths…` per DHA docs) | 🔵 PENDING — local capture/enforcement live (`sha_benefit_packages.requires_preauth`, `sha_claims.preauth_*`) |
| **Claim submission** | eClaims catalogue (`/claims…`) | 🔵 PENDING — `ShaClaimsHandler` stub queues to `dha_outbound_queue`; upgrade steps in `docs/integration-activation-manual.md` |
| **Claim status polling** | eClaims catalogue (claim status endpoints) | 🔵 PENDING — local statuses tracked on `sha_claims.status` / `encounters.claim_status` |
| **SHR consent** | `POST /shr/consents` · `POST /shr/consents/{consent_id}/verify` | 🔵 PENDING — local equivalent live (`consent_otps` OTP flow, `patient_consents`) |
| **SHR write** | `POST /shr/bundles` (FHIR collection Bundle; `id` echoed as `mediator_id`) | ⚠️ GAP — Bundle builder not yet built; individual resources live |
| **SHR read** | `GET /shr/patient-records` · `GET /shr/Observation` (headers `X-Consent-Token`, `X-PUID`) | 🔵 PENDING |
| **Terminology** | Terminology Service APIs (OCL-backed) | Not integrated — ICD-11 handled via WHO API + local table |

Integration seam: all DHA-bound work is queued through `dha_outbound_queue`
(`queue_type` CHECK incl. `fhir_sync`, `sha_claim`, `shr_access_notification`)
with `shr_transmission_log` recording every transmission attempt — the queue
becomes the live submitter when credentials arrive, with no application-UI
changes required.

---

## Section 5 — Database Functions Reference

Invocation: `POST https://tgynjasgnerucrlwedui.supabase.co/rest/v1/rpc/{fn}`
with `Authorization: Bearer <jwt>`.

| Function | Signature | Purpose | Grants |
|---|---|---|---|
| `accrue_daily_bed_charges()` | `() → void` | Inserts `invoice_line_items` (`bed_day`) for admitted admissions; cron `accrue-daily-bed-charges` 21:01 UTC | cron |
| `accrue_daily_mortuary_charges()` | `() → void` | Accrues daily mortuary storage charges (invoice line or `total_storage_charges`); cron `accrue-daily-mortuary-charges` 21:31 UTC | cron |
| `generate_fhir_encounter(p_encounter_id uuid)` | `(uuid) → jsonb` | FHIR R4 Encounter builder (Second Schedule coverage); SECURITY DEFINER, `search_path=public` | `authenticated` (revoked from `anon`) |
| `enforce_encounter_lock()` | `() → trigger` | Blocks INSERT/UPDATE/DELETE on child records of signed/finalized/completed encounters (attached to `encounter_diagnoses`, `clinical_notes`, `radiology_orders`) | trigger |
| `auto_generate_sha_claim()` | `() → trigger` | On `encounters.status → 'signed'` (insurance): creates draft `sha_claims` + seeds `sha_claim_items` from invoice line items | trigger (SECURITY DEFINER) |
| `enforce_insurance_visit_limit()` | `() → trigger` | Blocks `insurance_covered` above `per_visit_limit` for `fixed_per_visit` / `percentage_with_cap` insurers | trigger |
| `archive_old_audit_logs()` | `() → void` | Moves `audit_log` rows older than 2 years to `audit_log_archive`; logs to `audit_archive_runs`; cron `archive-audit-logs-nightly` 23:00 UTC | cron (SECURITY DEFINER) |
| `is_approved(_user_id uuid)` | `(uuid) → boolean` | RLS gate — all 19 roles | `authenticated` |
| `has_role(_user_id uuid, _role app_role)` | → boolean | Role check | `authenticated` |
| `user_has_permission(_user uuid, _perm text)` | → boolean | Permission check via `role_permissions` | `authenticated` |
| `get_moh_705_report(p_start date, p_end date, p_form_type text)` | → table | MOH 705 A/B morbidity counts | `authenticated` |
| `validate_and_get_icd11(search_code text)` | `(text) → (p_code, p_title, p_uri, p_is_cached)` | ICD-11 validation/resolution against `icd11_codes` | internal/trigger |
| `get_contracted_price(item_type, item_id, insurer_id)` | → numeric | Contracted rate-card lookup (`contracted_prices`) | `authenticated` |
| `log_break_glass_access(p_patient_id uuid, p_justification text, p_accessed_by uuid, p_accessor_email text)` | `() → void` | Break-glass audit + SHR access notification | `authenticated` |
| `verify_patient_identity(...)` / `verify_practitioner(...)` | stubs | IPRS / HWR verification stubs (return stub data until credentials) | `authenticated` |
| `send_lab_result_to_room(p_registration_id uuid, p_room_id uuid)` / `send_lab_results_to_requesting_room(p_encounter_id uuid)` | → uuid | Route patient back after lab results | `authenticated` |
| `send_radiology_result_to_room(...)` / `send_radiology_results_to_requesting_room(...)` | → uuid | Radiology routing equivalents | `authenticated` |
| `refresh_moh_aggregates(target_month date)` | `() → void` | Recomputes `moh_monthly_aggregates` | admin/reporting |
| `create_invoice_for_encounter()` / `recalc_invoice_totals()` / `recalc_invoice_payments()` / `sync_invoice_*` | triggers | Invoicing integrity chain | triggers |
| `route_registration_billing()` / `route_registration_to_lab()` / `route_registration_to_service_room()` / `route_prescription_to_pharmacy()` / `get_return_room()` | routing | Queue/room automation | triggers/RPC |
| `set_sha_fund_type()` | trigger | Auto PHF/SHIF/ECCIF classification on encounter insert | trigger |
| `dispense_prescription_stock()` | trigger | Stock deduction + negative-stock guard on dispense | trigger |
| `trg_medication_dispense_fhir()` | trigger | FHIR MedicationDispense → `dha_outbound_queue` | trigger (SECURITY DEFINER) |
| `trg_shr_access_notification()` | trigger | SHR access alert queueing | trigger (SECURITY DEFINER) |
| `trg_shr_transmission_log()` / `_insert()` | triggers | SHR transmission metadata log | triggers (SECURITY DEFINER) |
| `sync_encounter_diagnoses_from_jsonb()` | trigger | `encounters.diagnoses` JSONB → `encounter_diagnoses` mirror | trigger (SECURITY DEFINER) |
| `sync_lab_orders_from_tests()` / `sync_radiology_orders_from_tests()` | triggers | Order creation from `encounters.tests` | triggers |
| `tag_encounter_demographics()` / `process_encounter_indicators()` / `tag_encounter_from_room_visit()` | triggers | MOH indicator tagging | triggers |
| `get_user_display_name(p_user_id uuid)` | → text | Audit display names | `authenticated` |

---

## Section 6 — Webhook / Trigger Reference

Database triggers (all defined in `supabase/migrations/`; audited tables each
carry INSERT/UPDATE/DELETE `audit_*` triggers via `audit_trigger_fn()`):

| Trigger | Table | Event | Function |
|---|---|---|---|
| `trg_set_sha_fund_type` | `encounters` | BEFORE INSERT | `set_sha_fund_type()` |
| `trg_auto_generate_sha_claim` | `encounters` | AFTER UPDATE OF status | `auto_generate_sha_claim()` |
| `trg_enforce_insurance_visit_limit` | `encounters` | BEFORE INSERT OR UPDATE OF insurance_covered, insurance_provider_id, payment_mode | `enforce_insurance_visit_limit()` |
| `trg_shr_access_notification` | `encounters` | AFTER INSERT | `trg_shr_access_notification()` |
| `trg_sync_encounter_diagnoses` | `encounters` | AFTER INSERT OR UPDATE | `sync_encounter_diagnoses_from_jsonb()` |
| `trg_sync_lab_orders_from_tests` | `encounters` | AFTER INSERT OR UPDATE OF tests | `sync_lab_orders_from_tests()` |
| `trg_route_reg_to_lab` / `trg_route_registration_to_lab_ins` / `trg_route_registration_to_lab_upd` | `encounters` | INSERT/UPDATE | `route_registration_to_lab()` |
| `zzz_route_billing_ins` / `zzz_route_billing_upd` | `encounters` | INSERT/UPDATE | `route_registration_billing()` |
| `trg_route_registration_to_service_room` | `encounters` | INSERT/UPDATE | `route_registration_to_service_room()` |
| `trg_enforce_encounter_lock_diagnoses` / `_notes` / `_radiology` | `encounter_diagnoses`, `clinical_notes`, `radiology_orders` | BEFORE INSERT/UPDATE/DELETE | `enforce_encounter_lock()` |
| `trg_medication_dispense_fhir` | `prescriptions` | AFTER UPDATE | `trg_medication_dispense_fhir()` |
| `trg_route_prescription_to_pharmacy` | `prescriptions` | INSERT/UPDATE | `route_prescription_to_pharmacy()` |
| `trg_dispense_prescription_stock` | `prescriptions` | UPDATE | `dispense_prescription_stock()` |
| `trg_shr_transmission_log` / `trg_shr_transmission_log_insert` | `dha_outbound_queue` | AFTER UPDATE / AFTER INSERT | `trg_shr_transmission_log()` / `_insert()` |
| `trg_smov_apply` | `stock_movements` | AFTER INSERT OR DELETE | `apply_stock_movement()` |
| `trg_deliv_stock` | `deliveries` | AFTER INSERT | `delivery_to_stock()` |
| `patient_registrations_insert_trg` / `patient_registrations_update_trg` | `patient_registrations` (view) | INSTEAD OF INSERT/UPDATE | `patient_registrations_instead_insert()` / `_update()` |
| `audit_*` (20 tables × 3) | clinical, financial, security, stock tables | AFTER INSERT/UPDATE/DELETE | `audit_trigger_fn()` |
| `set_*_updated_at` family | `app_settings`, `rooms`, `insurance_providers`, `lab_orders`, `lab_results`, `lab_test_catalog`, `profiles`, `mortuary_records`, `contracted_prices`, `test_templates`, `machines`, `machine_logs`, `deliveries`, `fund_utilizations`, `stock_items`, `prescriptions` | BEFORE UPDATE | `set_updated_at()` family |
| `trg_assign_mortuary_reference` | `mortuary_records` | BEFORE INSERT | `assign_mortuary_reference()` |
| `sync_bed_status_on_admission` | `admissions` | INSERT/UPDATE | `sync_bed_status_on_admission()` |
| `trg_tag_demographics` / `trg_process_moh_indicators` | `encounters` | INSERT/UPDATE | `tag_encounter_demographics()` / `process_encounter_indicators()` |
| `trg_set_patient_file_number` | `patients` | BEFORE INSERT | `set_patient_file_number()` |

**External webhooks:** none inbound at present. 🔵 PENDING (planned):
`mpesa-callback` webhook (Safaricom Daraja) and SHA/DHA asynchronous claim
status callbacks (per `docs/integration-activation-manual.md`).

*End of DOC-8.*
