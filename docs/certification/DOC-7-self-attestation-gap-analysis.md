# DOC-7 — Self-Attestation Gap Analysis
## AegisCare HMS / LabTrack v5.5 — DHA HIE Certification Readiness

| | |
|---|---|
| **System** | AegisCare HMS / LabTrack v5.5 |
| **Repository** | `fmurage6331-dev/confit-core` |
| **Live URL** | https://aegiscarehms.lovable.app |
| **Supabase Project** | `tgynjasgnerucrlwedui` |
| **Document type** | Self-attestation gap analysis for DHA HIE certification (Form HMIS 4 pathway) |
| **Cross-referenced standards** | Kenya Digital Health Act, 2023; Digital Health (Data Exchange Component) Regulations, 2025; FHIR R4; ICD-11; Social Health Insurance Act, 2023 (esp. s.48); Kenya Data Protection Act, 2019; SHA benefit package framework (Legal Notice 146 & 147 of 2024) |
| **DHA HIE API base** | `https://ilm-dev.dha.go.ke/uat-middleware/api/v1` (per hie-docs.dha.go.ke) |
| **Prepared** | 2026-08-12 |
| **Status** | DRAFT for developer review before submission |

> **Attestation scope note.** This analysis was cross-checked against the DHA HIE
> API catalogue published at `https://hie-docs.dha.go.ke/catalog` (Authentication,
> HIE Registries, eClaims & Preauth, Consent Services, SHR Service APIs, Terminology
> Service). The attachments referenced in the briefing did not arrive with the task
> brief; the developer should re-verify section-by-section against the official
> certification checklist (Form HMIS 4, `https://certification.dha.go.ke/process`)
> and the printed DHA documents before submission.

---

## Summary of Findings

| # | Section | Status |
|---|---------|--------|
| 1 | FHIR R4 Compliance | ⚠️ PARTIAL — resources built; DHA profile conformance & Bundle submission not yet demonstrated |
| 2 | Patient Identity (Client Registry) | ⚠️ PARTIAL — schema + UI ready; CR lookup blocked on credentials |
| 3 | SHA Claims Workflow | ⚠️ PARTIAL — full local pipeline built; live submission blocked on credentials |
| 4 | Security & Access Control | ✅ COMPLIANT (with two P2 items: MFA, server-side password policy) |
| 5 | Audit & Logging | ✅ COMPLIANT (20-year retention procedure to be finalised) |
| 6 | Data Protection | ⚠️ PARTIAL — controls in place; ODPC registration & DPO pending |
| 7 | Preauthorisation Workflow | ⚠️ PARTIAL — local enforcement built; DHA preauth API blocked on credentials |
| 8 | Pharmacy & NLMIS | ⚠️ PARTIAL — coding complete (297/331); NLMIS reporting submission is a build gap |
| 9 | Laboratory | ✅ COMPLIANT for internal workflow; FHIR Observation mapping is a build gap |
| 10 | Outstanding Items (P0) | 🔵 PENDING — blocked on credentials |

**Legend:** ✅ COMPLIANT = implemented and demonstrable · ⚠️ PARTIAL = implemented in part;
a defined gap remains · 🔵 PENDING = blocked on external credentials · ⚠️ GAP: = build gap to close.

---

## Section 1 — FHIR R4 Compliance

### DHA requirement
The DHA Shared Health Record (SHR) accepts FHIR R4 `Bundle` resources
(`POST /shr/bundles`) containing `Encounter`, `EpisodeOfCare`, `Observation`,
`Condition`, `Procedure`, `Medication`, `MedicationRequest`, `MedicationDispense`,
`MedicationAdministration`, `Immunization`, `ServiceRequest` and
`AllergyIntolerance`. Every `Encounter` must reference the visit's `EpisodeOfCare`,
and all clinical resources must reference that `Encounter`. Bundles must carry an
`id` (echoed as `mediator_id`) and be of type `collection`
(source: `https://hie-docs.dha.go.ke/sharedhealthrecord/shr-records`).

### What AegisCare implements
- **`generate_fhir_encounter(p_encounter_id UUID)`** — PL/pgSQL RPC
  (`supabase/migrations/20260805000000_sprint52_sha_fhir_foundation.sql`, enhanced by
  `20260806000004_sprint8e_fhir_second_schedule.sql`). Emits a FHIR R4 `Encounter`
  with `identifier` (facility encounter ID + SHA notification number), `class`
  (AMB/IMP/EMER via v3-ActCode), `serviceType` (SHA fund PHF/SHIF/ECCIF),
  `subject`, `participant` (practitioner + council registration identifier),
  `period`, `diagnosis` (ICD-11 with rank), `hospitalization` (referral block),
  `serviceProvider` (KMHFL identifier) and DHA extensions
  (`sha-notification-number`, `sha-fund-type`, `clinical-findings`, `blood-group`,
  `allergies`).
- **Edge functions** (all `verify_jwt = true` in `supabase/config.toml`):
  - `supabase/functions/fhir-patient/index.ts` — FHIR R4 `Patient`
  - `supabase/functions/fhir-encounter/index.ts` — FHIR R4 `Encounter`
  - `supabase/functions/fhir-condition/index.ts` — FHIR R4 `Condition[]` from
    `encounter_diagnoses` (verificationStatus mapping, ICD-11 coding with
    `http://id.who.int/icd/release/11/mms`)
- **`trg_medication_dispense_fhir()`** trigger function
  (`20260811000001_sprint12d_medication_dispense_fhir.sql`) — writes a FHIR R4
  `MedicationDispense` payload to `dha_outbound_queue` on dispense.
- **ICD-11 structured diagnosis layer** — `encounter_diagnoses` + `trg_sync_encounter_diagnoses`
  (`20260730120000_dha_icd11_encounter_diagnoses_sync.sql`).

### Compliance status: ⚠️ PARTIAL

**What is missing / required before submission:**
1. **DHA profile conformance testing** — output of `generate_fhir_encounter()` and the
   three FHIR edge functions has not yet been validated against the DHA FHIR
   Implementation Guide / StructureDefinitions. Validate at
   `https://validator.fhir.org` and against the DHA profiles, and attach the
   validation report to the application. (Not blocked by credentials — build/QA task.)
2. **`Bundle` assembly (collection type)** — no function currently assembles the
   `Patient + Encounter + Condition (+ MedicationDispense)` Bundle required by
   `POST /shr/bundles`. `FhirSyncHandler` in `claims-dispatcher` queues a payload
   but does not yet build the Bundle. ⚠️ GAP: build the Bundle builder
   (recommended: `generate_fhir_bundle(encounter_id)` RPC or a `fhir-bundle` edge
   function) before live submission.
3. **`EpisodeOfCare`** — the DHA SHR requires the Encounter to reference an
   `EpisodeOfCare`; AegisCare does not yet generate one. ⚠️ GAP: add
   EpisodeOfCare generation (SHA visit-based) to the Bundle builder.
4. **Live SHR submission** — 🔵 PENDING: blocked on DHA OAuth2 credentials
   (`POST /tenants/token`), AfyaLink sandbox access, and the per-visit consent-token
   flow (`POST /shr/consents`, `POST /shr/consents/{consent_id}/verify`).
5. **Observation resources** — laboratory results are not yet mapped to FHIR
   `Observation` (see Section 9).

---

## Section 2 — Patient Identity (Client Registry)

### DHA requirement
HIE Client Registry API `GET /patients?identification_number=...&identification_type=...`
(identification types: National ID, ClientRegistry ID, Birth Notification, Birth
Certificate, Alien ID, Refugee ID, Mandate Number). The registry returns the
canonical client record including the **Client Registry (CR) ID**, which is then used
for eligibility (`/patients/benefits`, `/patients/eligibility`), SHR consent
(`cr_id`) and claims. DHA certification expects facilities to resolve and persist the
CR ID (UPI-equivalent) for SHA patients
(source: `https://hie-docs.dha.go.ke/registries/client-registry`).

### What AegisCare implements
- `patients.national_id`, `patients.national_id_type` (CHECK: `national_id | passport | birth_certificate | alien_id`),
  `patients.cr_number` (comment: *"DHA Client Registry number — retrieved via CR lookup API"*),
  `patients.identity_verified`, `identity_verified_at`, `identity_verified_by`
  (`20260812000004_drift_patients_sha_columns.sql`, `20260812000010_sha2_claims_tables.sql`).
- `verify_patient_identity()` PL/pgSQL stub RPC (called from
  `src/routes/register-patient.tsx` `verifyIdentity()`, line ~234), wired to the
  **"Verify identity & SHA status"** button on the registration form.
- Consent-gated invocation: `ConsentDialog` (`src/components/consent-dialog.tsx`)
  with OTP flow before any registry lookup; `consent_otps` (SHA-256 hashed, 10-minute
  expiry, `consent_type IN ('patient_consent','sha_claim','preauth','shr_access')`).
- FHIR Patient identifier block already emits
  `https://iprs.go.ke/ns/national-id` (NI/PPN/BCT) in `generate_fhir_encounter()`.

### Compliance status: ⚠️ PARTIAL

- 🔵 PENDING: live Client Registry lookup requires DHA developer-account credentials
  (client_id/client_secret for `POST /tenants/token`) and sandbox access via
  `https://sandbox.dha.go.ke` per `docs/integration-activation-manual.md`
  (Integration 1 — IPRS Patient Identity).
- ⚠️ GAP: `cr_number` is never auto-populated today because the lookup is a stub;
  once credentials arrive, the `verify-identity` edge function (to be created per the
  activation manual) must persist the CR ID, and the FHIR `Patient.identifier` block
  should include `https://dha.go.ke/ns/cr-id`.
- The current on-screen OTP (Track A) satisfies the consent-evidence requirement in
  the interim; SMS delivery (Track B via Africa's Talking) is 🔵 PENDING credentials.

---

## Section 3 — SHA Claims Workflow

### DHA requirement
SHA electronic claims are submitted by facilities under the SHA claims API
(eClaims & Preauth catalogue), keyed to the SHA **notification number** issued at
visit initiation, the member number, the Client Registry ID, the facility/provider
number, and structured ICD-11 diagnoses; preauthorisation is mandatory for listed
interventions (e.g., dialysis, oncology, ICU, elective surgery — per the SHA benefit
package framework and Legal Notices 146/147).

### What AegisCare implements
- **Claims schema (new this session, live in the database):**
  - `sha_claims` — `encounter_id`, `patient_id`, `claim_number`, `dha_claim_id`,
    `claim_type` (`sha_shif|sha_phf|sha_eccif|private|cash`), `fund_type`
    (`PHF|SHIF|ECCIF`), `status` (`draft → pending_otp → pending_preauth → ready →
    submitted → acknowledged → approved | rejected → appealed → paid`),
    `preauth_number`/`preauth_status`/`preauth_requested_at`/`preauth_approved_at`,
    `otp_verified`, `consent_token`, `total_amount`, `fhir_bundle`, timestamps
    (`20260812000010_sha2_claims_tables.sql`).
  - `sha_claim_items` — line items sourced from `invoice_line_items`
    (`item_type`, `description`, `quantity`, `unit_price`, `amount`,
    `intervention_code`, `is_included`).
  - `sha_claim_packages` — benefit-package assignment per claim (unique per
    `claim_id + package_code`, `is_primary`).
  - `sha_benefit_packages` — 22 seeded packages across PHF (3), SHIF (15), ECCIF (4)
    with `requires_preauth`, `can_combine_with`, `daily_limit`, `annual_limit`,
    `per_visit_limit` (`20260812000009_sha1_benefit_packages.sql`).
- **Automatic claim generation:** `auto_generate_sha_claim()` trigger function +
  `trg_auto_generate_sha_claim` (AFTER UPDATE OF status ON encounters) — on
  `status = 'signed'` with `payment_mode = 'insurance'` it creates a draft
  `sha_claims` row and seeds line items from the encounter invoice
  (`20260812000011_sha4_auto_claim_trigger.sql`).
- **Encounter-level claim tracking:** `encounters.sha_notification_number`
  (placeholder `TEMP-SHA-{ts}-{id}` until live), `insurer_type`
  (`sha_shif|private|corporate`), `claim_number`, `claim_status`, `claim_submitted_at`,
  `claim_resolved_at`, `preauth_number`, `sha_fund_type` (auto-detected by
  `set_sha_fund_type()` / `trg_set_sha_fund_type` — emergency→ECCIF, inpatient→SHIF,
  else PHF).
- **Insurance Desk UI:** `src/routes/rooms.$id.tsx` (room kind `insurance`) —
  `submitClaim()` (~line 2780) saves packages/line items, marks the claim `ready`,
  inserts into `dha_outbound_queue` (`queue_type = 'sha_claim'` or `'private_claim'`)
  with the FHIR encounter payload, and sets `claim_status = 'submitted'`.
- **Dispatcher:** `supabase/functions/claims-dispatcher/index.ts` —
  `ShaClaimsHandler`, `PrivateClaimsHandler`, `CashReceiptHandler`, `FhirSyncHandler`
  (deployed, **stub mode** — queues locally only).
- **Monitoring:** `src/routes/admin.queue.tsx` — dual-rail claims queue monitor with
  claims aging and FHIR preview.
- **Tariffs:** `sha_tariffs` seeded with 18 tariff lines from Legal Notices 146/147
  (`20260805000000_sprint52_sha_fhir_foundation.sql`).

### Compliance status: ⚠️ PARTIAL

- ✅ COMPLIANT (local): end-to-end internal claim pipeline — sign → auto-generate
  draft → package/line-item selection → OTP consent evidence → queue → status
  tracking — is implemented and demonstrable in the live deployment.
- 🔵 PENDING (credentials): actual submission to SHA — OAuth2 credentials, SHA
  provider number, sandbox URL (`https://api.sandbox.sha.go.ke/v1` per the
  activation manual), real notification numbers, and `dha_claim_id` assignment.
- ⚠️ GAP: `ShaClaimsHandler` must be upgraded from stub to live
  (`POST {SHA_API_URL}/claims/submit`) once credentials arrive; the activation
  steps are already documented in `docs/integration-activation-manual.md`
  (Integration 4).
- ⚠️ GAP: the `fhir_bundle` column on `sha_claims` is populated only when the
  insurance desk generates a preview; a deterministic claim-bundle builder is
  recommended (see DOC-5 Section 5 — "SHA-10 pending").

---

## Section 4 — Security & Access Control

### DHA requirement
DHA certification requires role-based access control, least-privilege operation,
secure authentication (including automatic session termination), password policy,
and protection of clinical data from unauthorised access (DHA security
scoring-tool line items; Digital Health (Data Exchange Component) Regulations 2025).

### What AegisCare implements
- **19 roles** (`src/lib/roles.ts`): `admin`, `system_admin`, `staff`,
  `receptionist`, `accountant`, `insurance_agent`, `records_officer`,
  `triage_nurse`, `nurse`, `doctor`, `clinical_officer`, `dental_officer`,
  `nutritionist`, `physiotherapist`, `hts_counsellor`, `lab_tech`, `radiologist`,
  `pharmacist`, `mortician` — matching the `app_role` enum
  (`20260716063555...` + `20260730140000_dha_task_d_security_roles.sql`).
- **`is_approved(uuid)`** — SECURITY DEFINER, `SET search_path TO 'public'`;
  single gate covering all 19 roles (fixes the 68-policy role gap);
  used by ~134 RLS policy definitions across the schema.
- **`has_role()`, `user_has_permission()`**, `role_permissions` table and
  `src/lib/require-access.tsx` (`Guard`, `PermGuard`), `hasPerm()` in
  `src/lib/auth-context.tsx`.
- **Admin-only user management** via server functions
  (`src/lib/admin-users.functions.ts`, `requireSupabaseAuth` middleware,
  `assertAdmin`) — service-role key never reaches the browser.
- **Session timeout**: 30 minutes inactivity auto-logout
  (`src/components/app-shell.tsx`, `TIMEOUT_MS = 30 * 60 * 1000`).
- **Password policy**: min 8 chars, uppercase, number, special char, max 72
  (`src/routes/change-password.tsx`, Zod).
- **Security hardening migration** `20260811000007_security_hardening.sql`:
  revoked `anon` EXECUTE on 8 SECURITY DEFINER functions; pinned `search_path`
  on 12 functions; restricted `audit_log` INSERT to `authenticated`; restricted
  `profiles` and `moh_705_disease_mappings` SELECT to authenticated; rebuilt
  `stock_store_usage_view` without the `auth.users` join.
- **RLS enabled on all clinical tables**, including `lab_orders`, `lab_results`,
  `encounter_room_visits`, `icd11_codes`, `moh_indicator_definitions`,
  `room_indicator_map` (`20260806000005_rls_missing_tables.sql`).

### Compliance status: ✅ COMPLIANT (with two deferred items)

- ✅ COMPLIANT: RBAC, least privilege, RLS, session timeout, password policy,
  admin-only provisioning.
- 🔵 PENDING / ⚠️ GAP (low): **MFA enforcement** — Supabase Auth MFA requires a
  paid plan / own Supabase account (documented in
  `docs/dha-compliance-task-d-phase2-security.md`); **server-side password
  policy** — requires Supabase dashboard access unavailable on the current
  Lovable free plan. Both are scheduled for transfer to the facility's own
  Supabase project.

---

## Section 5 — Audit & Logging

### DHA requirement
Immutable, complete audit of clinical data changes, security/access changes and
pharmacy/stock movements; a **separate** SHR transmission metadata log is a
statutory obligation under the Digital Health (Data Exchange Component) Regulations
2025; long-term (20-year) retention is expected for audit records.

### What AegisCare implements
- **`audit_log`** (append-only RLS: `audit_log_insert_authenticated`; UPDATE/DELETE
  denied by `audit_log_deny_update` / `audit_log_deny_delete`).
- **`audit_trigger_fn()`** — generic trigger function (SECURITY DEFINER,
  `search_path = public`); **20 tables / 60 triggers** audited (Task E,
  `20260730150000_dha_task_e_audit_completeness.sql`): `admissions`, `encounters`,
  `invoice_line_items`, `invoice_payments`, `invoices`, `lab_tests`, `patients`,
  `prescriptions`, `lab_orders`, `lab_results`, `radiology_orders`,
  `radiology_results`, `clinical_notes`, `encounter_diagnoses`, `user_roles`,
  `role_permissions`, `user_room_access`, `app_settings`, `stock_movements`,
  `stock_items`.
- **Break-glass**: `log_break_glass_access()` writes `BREAK_GLASS` audit events and
  queues a client notification (`20260806000001_sprint8a_break_glass.sql`,
  `20260806000002_sprint8c_shr_access_notification.sql`).
- **Archiving**: `audit_log_archive`, `audit_archive_runs`, `archive_old_audit_logs()`
  (2-year hot-retention cutoff), cron **`archive-audit-logs-nightly`**
  (`0 23 * * *` = 02:00 EAT) (`20260806101050_e8638a1f....sql`).
- **SHR transmission log**: `shr_transmission_log` (append-only, RLS read-only for
  users) written by `trg_shr_transmission_log` / `trg_shr_transmission_log_insert`
  on `dha_outbound_queue` for `fhir_sync` and `shr_access_notification` types
  (`20260806000003_sprint8d_shr_transmission_log.sql`).
- **UI**: `src/routes/admin.audit-log.tsx`.

### Compliance status: ✅ COMPLIANT (one administrative item)

- ✅ COMPLIANT: 20-table / 60-trigger coverage; append-only; break-glass; SHR
  transmission metadata log separate from the general audit log.
- ⚠️ GAP (administrative): a documented **20-year audit retention schedule and
  legal-hold procedure** must be written and attached (the archiving pipeline
  currently moves records older than 2 years into `audit_log_archive`, which is
  retained indefinitely — the retention statement itself needs to be formalised;
  see DOC-4 and DOC-3 Section 6).

---

## Section 6 — Data Protection

### DHA requirement
Compliance with the Kenya Data Protection Act, 2019 (and the Digital Health Act,
2023): lawful basis, consent management, purpose limitation, data minimisation,
security safeguards, data-subject rights, breach notification, and registration
with the Office of the Data Protection Commissioner (ODPC).

### What AegisCare implements
- **Consent management**: `patient_consents` (live table; columns include
  `consent_type`, `consented`, `hie_data_sharing_consented`, `consented_at`,
  `consented_by`) written by `ConsentDialog` after OTP verification;
  `consent_otps` stores only SHA-256 hashes of OTPs, 10-minute expiry, and the
  SHA Act 2023 s.48 disclaimer text is embedded in the UI and the SMS template
  (`src/components/consent-dialog.tsx`).
- **SHR access notification**: `trg_shr_access_notification()` queues an alert to
  the client whenever a new encounter accesses their record, and on break-glass
  access (`20260806000002_sprint8c_shr_access_notification.sql`).
- **Encryption**: Supabase platform defaults — AES-256 at rest, TLS 1.2+ in
  transit (documented in `docs/dha-compliance-task-d-phase2-security.md`).
- **Data minimisation**: RLS + 19-role RBAC; untyped `db` client used only for
  columns absent from generated types (`src/lib/supabase-untyped.ts` — intended
  architecture).
- **This documentation set**: DOC-2 (DPIA), DOC-3 (Privacy Policy), DOC-6
  (Security Policy) are the regulatory artefacts.

### Compliance status: ⚠️ PARTIAL

- 🔵 PENDING: ODPC registration of FACILITY_NAME as data controller (registration
  number not yet obtained — placeholder `ODPC_REG_NO` in DOC-3).
- 🔵 PENDING: named Data Protection Officer (DPO) — placeholder in DOC-2/DOC-3.
- ⚠️ GAP (administrative): staff privacy/security training records and a data
  breach register must be maintained; templates are referenced in DOC-6 Section 9.

---

## Section 7 — Preauthorisation Workflow

### DHA requirement
The SHA benefit framework requires preauthorisation for specified interventions
(e.g., haemodialysis — KES 10,650/session, oncology, ICU/HDU, elective surgery,
advanced radiology). The HIE eClaims & Preauth catalogue provides the preauth APIs;
a claim for a preauth-required intervention must carry a valid preauth reference.

### What AegisCare implements
- **`sha_benefit_packages.requires_preauth`** — true for `SHA-16` (Renal Care —
  Dialysis), `SHA-17` (Radiology — Advanced), `SHA-19` (Surgical Services),
  `SHA-20` (Oncology), `SHA-21` (ICU / Critical Care); `can_combine_with`
  matrix seeded.
- **Insurance Desk enforcement** (`src/routes/rooms.$id.tsx`): preauth procedure
  keywords scanned against the encounter; `preauthMissing` blocks claim submission
  with an explicit warning; `preauth_number` is captured and persisted on the
  encounter and on `sha_claims.preauth_number` (also `preauth_status`,
  `preauth_requested_at`, `preauth_approved_at`).
- **Consent type `preauth`** supported in `consent_otps` CHECK constraint.
- `sha_claims.status` includes `pending_preauth` in the lifecycle.

### Compliance status: ⚠️ PARTIAL

- ✅ COMPLIANT (local): preauth capture, persistence and submission-blocking are
  implemented.
- 🔵 PENDING: DHA/SHA preauth API (request + status polling) blocked on
  credentials — upgrade path documented in `docs/integration-activation-manual.md`.
- ⚠️ GAP: no local expiry check on `preauth_number` validity window (relies on
  `sha_claims.preauth_status`); recommend a validation rule when the live API is
  connected.

---

## Section 8 — Pharmacy & NLMIS

### DHA requirement
Medication coding aligned to the national logistics system (NLMIS / KEMSA commodity
codes) for pharmaceutical supply-chain visibility, plus FHIR `MedicationDispense`
visibility into the SHR.

### What AegisCare implements
- **`stock_items.nlmis_code`** (`20260810000001_sprint11c_nlmis_code.sql`) —
  live coverage **297 of 331 stock items (89.7%)**; the remaining **34 items are
  legitimately untagged** (ARVs, EPI vaccines, equipment — not NLMIS commodities).
- **FHIR MedicationDispense**: `trg_medication_dispense_fhir()` on
  `prescriptions` (status → `dispensed`) writes a FHIR R4 `MedicationDispense`
  (medicationCodeableConcept with `https://kemsa.go.ke/ns/nlmis-code`, subject,
  context, performer, quantity UCUM, dosageInstruction, DHA extensions) to
  `dha_outbound_queue` (`20260811000001_sprint12d_medication_dispense_fhir.sql`).
- **Stock integrity**: `dispense_prescription_stock()` negative-stock guard
  (Sprint 13B, `20260811000003_sprint13b_dispense_stock_guard.sql`),
  `apply_stock_movement()`, `trg_smov_apply`, `delivery_to_stock()`,
  `trg_deliv_stock`, stock movements audited.
- **MAR**: `medication_administrations` (nurse-recorded administrations) with RLS
  (`20260811000005_sprint14c_medication_administrations.sql`).
- **MOH 707 pharmacy report** route (`src/routes/moh.707.tsx`).

### Compliance status: ⚠️ PARTIAL

- ✅ COMPLIANT: NLMIS coding coverage and MedicationDispense FHIR generation.
- ⚠️ GAP (build): no NLMIS reporting/submission integration (KHIS/KEMSA) — the
  system currently reports pharmacy aggregates through MOH 707 only; the NLMIS
  reporting interface must be built or the exemption justified to DHA.
- 🔵 PENDING: SHR transmission of MedicationDispense blocked on AfyaLink
  credentials.

---

## Section 9 — Laboratory

### DHA requirement
Structured, verifiable laboratory workflows feeding the SHR (FHIR `Observation` /
`DiagnosticReport`) and supporting MOH 706 reporting; specimen traceability and
critical-result handling are expected good practice for certification.

### What AegisCare implements
- **Order-driven worklist**: `lab_orders` (order_number `ORD-#####`, priority
  `routine|urgent|stat`, status `ordered → in_progress → completed | declined`)
  auto-created by `sync_lab_orders_from_tests()` /
  `trg_sync_lab_orders_from_tests` from `encounters.tests`
  (`20260721120000_laboratory_orders.sql`).
- **Results**: `lab_results` (structured `result` JSONB, `performed_by`,
  `reported_at`) — entered in `src/routes/laboratory.$id.tsx`.
- **Specimen & critical handling** (Sprint 13E, `20260811000004_sprint13e_lab_specimen_critical.sql`):
  `lab_orders.specimen_type`, `collected_at`, `is_critical`; `lab_results.is_critical`,
  `verified_by`, `verified_at` — dual-verification UI in `laboratory.$id.tsx`
  ("Verify result" action).
- **Routing**: `send_lab_result_to_room()` /
  `send_lab_results_to_requesting_room()` return results to the requesting room;
  radiology equivalent `send_radiology_results_to_requesting_room()`
  (`20260728120000_radiology_room_routing.sql`).
- **RLS**: full CRUD policies for authenticated approved staff
  (`20260806000005_rls_missing_tables.sql`); lab tables audited (Task E).
- **MOH 706 report** route (`src/routes/moh.706.tsx`).

### Compliance status: ✅ COMPLIANT (internal) with one build gap

- ✅ COMPLIANT: order/result lifecycle, specimen capture, critical alerts, dual
  verification, routing, audit.
- ⚠️ GAP (build): no FHIR `Observation`/`DiagnosticReport` generation for lab
  results yet — required for full SHR write coverage; recommend a
  `trg_lab_result_fhir` mirror of `trg_medication_dispense_fhir` (see DOC-5
  Section 9).

---

## Section 10 — Outstanding Items (P0, blocked on credentials)

All P0 items below are **architected, stubbed and documented** in
`docs/integration-activation-manual.md`; none can be activated until the listed
credentials/access are obtained. **None of these are code-quality gaps.**

| # | Item | Status | Blocking credential |
|---|------|--------|---------------------|
| 1 | DHA OAuth2 client (`POST /tenants/token`) | 🔵 PENDING | DHA developer account (`https://developer.dha.go.ke`) |
| 2 | Client Registry / IPRS verification (`verify_patient_identity` → live) | 🔵 PENDING | IPRS client ID/secret, sandbox access |
| 3 | SHA member registry verification (`patients.sha_membership_status` → live) | 🔵 PENDING | SHA provider portal credentials |
| 4 | SHA notification numbers (replace `TEMP-SHA-` placeholders) | 🔵 PENDING | SHA eligibility API credentials |
| 5 | SHA claims submission (`ShaClaimsHandler` → live) | 🔵 PENDING | SHA claims API credentials + provider number |
| 6 | AfyaLink HIE sandbox (FHIR Bundle → `POST /shr/bundles`) | 🔵 PENDING | DHA Provisional Interoperability Accreditation + AfyaLink secrets |
| 7 | Kenya HWR practitioner verification (`verify_practitioner` → live) | 🔵 PENDING | HWR API key |
| 8 | WHO ICD-11 API (`icd11-search` live mode) | 🔵 PENDING | `ICD_CLIENT_ID` / `ICD_CLIENT_SECRET` (function is correct; local `icd11_codes` table is the working fallback) |
| 9 | SMS OTP delivery (Track B) | 🔵 PENDING | Africa's Talking API key + CA sender-ID whitelist |
| 10 | M-Pesa (Daraja) | 🔵 PENDING | Safaricom consumer key/secret (planned; not built) |

**Recommended order of unblocking:** 1 → 2/3 → 4 → 5 → 6 → 7 → 8 → 9, following
the activation manual's golden rule (test in sandbox before production).

---

## Attestation

I/we attest that the information in this gap analysis reflects the state of the
AegisCare HMS / LabTrack v5.5 codebase at commit `be795c10` (branch `main`) and the
live Supabase project `tgynjasgnerucrlwedui`, and that all PARTIAL/PENDING items
are disclosed to the certifying authority.

| | |
|---|---|
| Prepared by | ____________________ (Developer / Technical Lead) |
| Reviewed by | ____________________ (Facility In-Charge) |
| Date | ____________________ |

*End of DOC-7.*
