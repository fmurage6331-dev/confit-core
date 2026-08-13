# DOC-5 — FHIR Integration Documentation
## AegisCare HMS / LabTrack v5.5 — DHA HIE (AfyaLink) FHIR R4 Exchange

| | |
|---|---|
| **System** | AegisCare HMS / LabTrack v5.5 |
| **Standard** | HL7 FHIR Release 4 (R4) |
| **Target** | Kenya DHA Health Information Exchange — Shared Health Record (AfyaLink) |
| **DHA API base** | `https://ilm-dev.dha.go.ke/uat-middleware/api/v1` |
| **Document status** | DRAFT for certification submission |
| **Date** | 2026-08-12 |

---

## Section 1 — FHIR Version & Conformance

1.1 AegisCare generates **FHIR R4** resources only. Resource JSON is produced by
deterministic server-side builders (PL/pgSQL RPCs and Deno edge functions), not
hand-written clinical documents.

1.2 **Conformance targets** (per DHA SHR documentation at
`https://hie-docs.dha.go.ke/sharedhealthrecord/shr-records`):
- SHR accepts a FHIR `Bundle` of type **`collection`** with `id` (echoed as
  `mediator_id`); the middleware validates `resourceType = Bundle`.
- Accepted resource types: `Encounter`, `EpisodeOfCare`, `Observation`,
  `Condition`, `Procedure`, `Medication`, `MedicationRequest`,
  `MedicationDispense`, `MedicationAdministration`, `Immunization`,
  `ServiceRequest`, `AllergyIntolerance`.
- The `Encounter` must reference the visit's `EpisodeOfCare`; all clinical
  resources must reference that `Encounter`.
- Reads require the per-visit consent token (`X-Consent-Token`) and practitioner
  identifiers (`X-PUID`, `practitioner_id`).

1.3 **Conformance status:** ⚠️ PARTIAL. Individual resources are structurally
R4-conformant and intended for validation at `https://validator.fhir.org`, but
**full profile-level validation against the DHA Implementation Guide and
end-to-end Bundle submission to the SHR sandbox have not yet been performed**
(blocked on credentials — DOC-7 §1, §10).

---

## Section 2 — Supported FHIR Resources

| Resource | Builder | Trigger / API | Status |
|---|---|---|---|
| `Patient` | `supabase/functions/fhir-patient/index.ts` (edge function) | POST body `{patient_id}` | ✅ live (on-demand) |
| `Encounter` | `generate_fhir_encounter(p_encounter_id UUID)` PL/pgSQL RPC (`20260805000000_sprint52_sha_fhir_foundation.sql`, extended `20260806000004_sprint8e_fhir_second_schedule.sql`); `supabase/functions/fhir-encounter/index.ts` | RPC call or edge function | ✅ live (on-demand) |
| `Condition[]` | `supabase/functions/fhir-condition/index.ts` from `encounter_diagnoses` | POST body `{encounter_id}` | ✅ live (on-demand) |
| `MedicationDispense` | `trg_medication_dispense_fhir()` trigger function (`20260811000001_sprint12d_medication_dispense_fhir.sql`) | `prescriptions.status → 'dispensed'` | ✅ live (queued to `dha_outbound_queue`) |
| `Bundle` (collection) | ⚠️ GAP — not yet built | required for `POST /shr/bundles` | 🔵 pending (build + credentials) |
| `EpisodeOfCare` | ⚠️ GAP — not yet built | required by SHR Encounter references | 🔵 pending |
| `Observation` (lab) | ⚠️ GAP — not yet built (see §9) | recommended trigger on `lab_results` | 🔵 pending |

---

## Section 3 — FHIR Encounter Resource

3.1 **Database builder — `generate_fhir_encounter(p_encounter_id UUID)`**
(STABLE, SECURITY DEFINER, `search_path = public`, revoked from `anon`):

| FHIR element | AegisCare mapping |
|---|---|
| `id` | `encounters.id` |
| `identifier[0]` | official — `https://health.go.ke/facility/{KMHFL}/encounter-id` |
| `identifier[1]` | secondary — `https://sha.go.ke/ns/notification-number` (`encounters.sha_notification_number`; `TEMP-SHA-…` placeholder until live) |
| `status` | `waiting→arrived`, `done→finished`, else `in-progress` |
| `class` | v3-ActCode: inpatient→`IMP`, emergency→`EMER`, else `AMB` |
| `serviceType` | `http://dha.go.ke/fhir/CodeSystem/service-type` — `PHF`/`SHIF`/`ECCIF` from `encounters.sha_fund_type` |
| `subject` | `Patient/{id}` + display name |
| `participant` | `Practitioner/{created_by}` + council registration identifier (`https://hwr.health.go.ke/ns/council-registration`) from `profiles.council_*` |
| `period` | `created_at` → `updated_at` |
| `diagnosis[]` | `encounter_diagnoses` ordered by `sequence`; role from `diagnosis_type` (billing/secondary); rank; ICD-11 URI extension |
| `hospitalization` | referral block (`referral_direction`, `referral_out_facility`, `referral_out_reason`) |
| `serviceProvider` | `https://kmhfl.health.go.ke` identifier + facility name from `app_settings` |
| `extension[]` | `sha-notification-number`, `sha-fund-type`, `clinical-findings` (vitals + history), `blood-group`, `allergies` (Second Schedule coverage) |

3.2 **HTTP builder — `fhir-encounter` edge function**
(`supabase/functions/fhir-encounter/index.ts`): same resource over HTTP with
`meta.profile`, `priority` (emergency), `diagnosis` references to
`Condition/{id}`, `serviceProvider` with `https://hiskenya.org/facility`
identifier, and `hospitalization.dischargeDisposition` for referrals out.
Content-Type `application/fhir+json`.

3.3 **Usage:** invoked by the insurance desk for claim payloads
(`rooms.$id.tsx` `submitClaim()` → `supabase.rpc("generate_fhir_encounter", …)`
→ stored in `dha_outbound_queue.payload.fhir_encounter` and previewed in
`admin.queue.tsx`); sample output can be generated for the certification
application with `SELECT generate_fhir_encounter('<encounter-uuid>');`.

---

## Section 4 — FHIR MedicationDispense Resource

4.1 **Trigger function — `trg_medication_dispense_fhir()`** (SECURITY DEFINER,
`search_path = public`), attached as trigger `trg_medication_dispense_fhir`
AFTER UPDATE on `prescriptions` (`20260811000001_sprint12d_medication_dispense_fhir.sql`).

4.2 **Fires when** `prescriptions.status` transitions **to `dispensed`**.
Builds:

| FHIR element | Mapping |
|---|---|
| `id` | `prescriptions.id` |
| `status` | `completed` |
| `medicationCodeableConcept` | text = `drug_name`; coding system `https://kemsa.go.ke/ns/nlmis-code` when `stock_item_id` present |
| `subject` | `Patient/{encounter.patient_id}` |
| `context` | `Encounter/{encounter_id}` |
| `performer` | `Practitioner/{dispensed_by}` + `dispensed_by_name` |
| `quantity` | UCUM (`http://unitsofmeasure.org`, code `U`) |
| `whenHandedOver` | `dispensed_at` |
| `dosageInstruction` | dosage \| frequency \| duration text + `patientInstruction` (notes) |
| `extension[]` | `encounter-type`, `https://kmhfl.health.go.ke/facility`, `facility-name` |

4.3 **Outcome:** the resource is inserted into `dha_outbound_queue`
(`queue_type = 'fhir_sync'`, status `pending`), and automatically mirrored to
`shr_transmission_log` by `trg_shr_transmission_log_insert` — the statutory SHR
transmission metadata log.

4.4 **Current disposition:** 🔵 PENDING transmission — the queue is live and
monitored in `admin.queue.tsx`; actual `POST /shr/bundles` delivery is blocked
on AfyaLink credentials (DOC-7 §10 item 6).

---

## Section 5 — FHIR Claim Bundle — Current Status

5.1 **Built (live in the database):**
- `sha_claims.fhir_bundle` column (JSONB) — populated by the insurance desk with
  the `generate_fhir_encounter()` payload at submission time.
- `sha_claim_items` with `intervention_code` (SHA intervention mapping field).
- `sha_benefit_packages` codes (e.g., `SHA-19-SC-13`-style sub-benefit codes
  supported via `intervention_code`).
- Claim status machine on `sha_claims` (`draft → pending_otp → pending_preauth →
  ready → submitted → acknowledged → approved → rejected → appealed → paid`).
- `claims-dispatcher` `ShaClaimsHandler` — stub that queues
  `queue_type = 'sha_claim'` with the FHIR payload.

5.2 **Pending — "SHA-10" (SHA claims bundle / FHIR Claim resource):**
- ⚠️ GAP (build): no **FHIR R4 `Claim`/`ClaimResponse` resource** builder exists
  yet (the DHA/SHA eClaims pipeline expects claim submission with FHIR-encoded
  clinical content; today AegisCare attaches the Encounter resource inside the
  queue payload rather than a full claim Bundle).
- ⚠️ GAP (build): deterministic claim Bundle assembly
  (`Patient + Encounter + Condition[] + MedicationDispense[] + Claim`) is the
  recommended next deliverable, aligned to the DHA eClaims catalogue
  (`https://hie-docs.dha.go.ke/eclaims`).
- 🔵 PENDING (credentials): live claim submission and status polling
  (`dha_claim_id` assignment, `claim_status` transitions from SHA).

5.3 **Workaround today:** claims are fully tracked locally (claim number,
status, submitted-at) and queued with FHIR evidence; the SHA portal/API
submission is the remaining leg, documented step-by-step in
`docs/integration-activation-manual.md` (Integration 4).

---

## Section 6 — DHA Outbound Queue Architecture

6.1 **Table `dha_outbound_queue`** (`20260812000006_drift_dha_outbound_queue.sql`):

| Column | Purpose |
|---|---|
| `queue_type` | `fhir_sync | sha_claim | private_claim | cash_receipt | shr_access_notification` |
| `payload` | JSONB — the FHIR resource(s) or claim payload |
| `status` | `pending → processing → sent → acknowledged | failed | skipped` |
| `attempts`, `last_attempted_at` | retry bookkeeping |
| `response`, `error_message` | integration responses (e.g., `mediator_id`) |

6.2 **Producers:**
- `trg_medication_dispense_fhir()` → `fhir_sync` (MedicationDispense)
- `trg_shr_access_notification()` → `shr_access_notification` (on every new
  encounter; also on break-glass access)
- `claims-dispatcher` edge function → `fhir_sync` / `sha_claim` / `private_claim`
  / `cash_receipt` (consent-gated for FHIR sync)
- Insurance desk `submitClaim()` → `sha_claim` / `private_claim` directly

6.3 **Consumers:** the dispatcher's handlers (stub mode today) and the admin
queue monitor (`admin.queue.tsx`). When credentials arrive, handlers switch to
live HTTP calls (OAuth2 token → API call → `response`/`status` update → retry on
failure with `attempts` increment).

6.4 **Observability:** every `fhir_sync` / `shr_access_notification` transition
is mirrored to `shr_transmission_log` (transmission metadata, response code,
error, payload keys) — satisfying the Digital Health (Data Exchange Component)
Regulations 2025 transmission-log obligation.

---

## Section 7 — ICD-11 Integration

7.1 **Structured coding (primary path):**
- `encounter_diagnoses` — `icd11_code`, `icd11_title`, `icd11_uri`,
  `diagnosis_type` (incl. `final`/`working`/`admission`/`discharge`), `sequence`
  (rank 1 = primary, SHA-compliant ordering).
- `trg_sync_encounter_diagnoses` keeps the structured table in sync with
  `encounters.diagnoses` JSONB (`20260730120000_dha_icd11_encounter_diagnoses_sync.sql`).
- `clean_and_validate_diagnosis_insert()` validates/normalises codes via
  `validate_and_get_icd11()` against the local `icd11_codes` reference table.

7.2 **WHO API (live search path):**
- `supabase/functions/icd11-search/index.ts` — proxies to
  `https://id.who.int/icd/release/11/2024-01/mms/search` (flexisearch,
  `API-Version: v2`), OAuth2 `client_credentials` against
  `https://icdaccessmanagement.who.int/connect/token` with in-memory token
  caching; returns `{code, title, uri}`.
- 🔵 PENDING: requires secrets `ICD_CLIENT_ID` / `ICD_CLIENT_SECRET`; until
  configured, the UI (consultation ICD-11 search in `rooms.$id.tsx`) falls back
  automatically to the local `icd11_codes` table — no code change needed (Task F,
  `docs/dha-compliance-task-a-icd11-sync.md`).

7.3 **FHIR mapping:** Condition `code.coding.system` = `icd11_uri` (default
`http://id.who.int/icd/release/11/mms`); Encounter diagnosis extension
`https://health.go.ke/fhir/StructureDefinition/icd11-uri`.

---

## Section 8 — NLMIS Medication Coding

8.1 **`stock_items.nlmis_code`** (`20260810000001_sprint11c_nlmis_code.sql`) —
KEMSA/NLMIS commodity codes attached to 297 of 331 stock items (**89.7%**).
The remaining **34 items are legitimately untagged** (ARVs, EPI vaccines,
equipment — not NLMIS-tracked commodities). `stock_store_balances_view` exposes
`nlmis_code` for supply-chain reporting.

8.2 **FHIR linkage:** MedicationDispense `medicationCodeableConcept.coding.system
= 'https://kemsa.go.ke/ns/nlmis-code'` is emitted when `prescriptions.stock_item_id`
is set (dispense-time), giving the SHR/NLMIS a machine-readable commodity code.

8.3 **Status:** ✅ coding layer COMPLIANT. ⚠️ GAP (build): NLMIS/KHIS reporting
submission integration is not built (MOH 707 internal reporting exists); see
DOC-7 §8.

---

## Section 9 — Pending Integrations

| Item | Type | Blocked by |
|---|---|---|
| FHIR Bundle builder + `POST /shr/bundles` | ⚠️ build gap + credentials | DHA OAuth2 + AfyaLink sandbox (Provisional Interoperability Accreditation) |
| `EpisodeOfCare` generation | ⚠️ build gap | — |
| FHIR `Observation`/`DiagnosticReport` for lab results | ⚠️ build gap | — |
| FHIR `Claim` bundle (SHA-10) | ⚠️ build gap | SHA claims API credentials |
| Live SHR consent flow (`POST /shr/consents`, verify, `X-Consent-Token`) | 🔵 credentials | DHA consent services access |
| SHR reads (`GET /shr/patient-records`, `GET /shr/Observation`) | 🔵 credentials | consent-token flow live |
| HWR practitioner identifiers (`PUID`) | 🔵 credentials | Kenya HWR API key |
| WHO ICD-11 API keys | 🔵 credentials | `ICD_CLIENT_ID` / `ICD_CLIENT_SECRET` |

**Recommended activation sequence** is documented in
`docs/integration-activation-manual.md` (Integrations 1–6) and DOC-7 §10.

*End of DOC-5.*
