# DOC-4 — System Backup & Recovery Policy
## AegisCare HMS / LabTrack v5.5

| | |
|---|---|
| **System** | AegisCare HMS / LabTrack v5.5 |
| **Supabase project** | `tgynjasgnerucrlwedui` |
| **Hosting** | Lovable managed hosting (https://aegiscarehms.lovable.app) |
| **Document status** | DRAFT for certification submission |
| **Date** | 2026-08-12 |
| **Related documents** | DOC-1 (Architecture), DOC-6 (Security), DOC-7 (Gap Analysis) |

---

## Section 1 — Backup Strategy

1.1 **Database.** The PostgreSQL database is managed by Supabase Cloud, which
provides platform-managed backups:

| Tier | Provision |
|---|---|
| Current hosting (Lovable-managed project, free tier) | **Daily backups with 7-day retention** (Supabase standard for free-tier projects); no point-in-time recovery (PITR) on this tier |
| Recommended (post-transfer to facility-owned Supabase project) | Enable **PITR** (up to 7-day granular recovery) and extend backup retention per facility policy |

1.2 **Schema.** The complete authoritative schema lives in version control:
**85 migration files in `supabase/migrations/`** (applied in filename order).
The schema can be fully reconstructed on a fresh Supabase project by replaying
the migrations (`docs/facility-onboarding.md`, Step 3). This makes the
repository the primary schema-backup and schema-recovery artefact.

1.3 **Code.** Application source (routes, components, edge functions, config)
is versioned in the repository (`fmurage6331-dev/confit-core`); edge-function
code is redeployable from `supabase/functions/` (Section 6).

1.4 **Secrets.** Edge-function secrets and environment variables are stored in
Supabase (Edge Functions → Secrets) and the Lovable environment
(`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`). 🔵 PENDING: a
facility-held secrets inventory (copy kept offline in the facility safe) is
recommended; no secrets are stored in the repository.

1.5 **Verification of backups.** Supabase backups are verified by restoration
drill per Section 8.

---

## Section 2 — Recovery Time Objective (RTO)

2.1 **Target RTO (clinical availability):**
- **4 hours** for the application to be serving again after a data-loss or
  hosting incident (restore path: Lovable redeploy + Supabase restore + migrate
  replay).
- **24 hours** for full verification of data completeness after recovery
  (data-integrity checks per Section 8).

2.2 Rationale: the deployment is a single-facility Model A deployment; a 4-hour
target is achievable with the migration-file schema path plus Supabase restore,
and is consistent with continuity expectations for a Level FACILITY_LEVEL
facility. ⚠️ GAP: an actual timed restore drill has not yet been performed —
schedule the first drill before go-live (Section 8).

---

## Section 3 — Recovery Point Objective (RPO)

3.1 **Target RPO: ≤ 24 hours** (free tier daily backups) — i.e., at most one
day of data can be lost in a worst-case restore.

3.2 **Post-transfer improvement:** with PITR enabled on the facility-owned
Supabase project, RPO improves to **≤ 5 minutes** (or per the selected PITR
retention window).

3.3 **Business expectation:** because encounters are closed (signed) daily and
MOH reporting is monthly, a 24-hour RPO is acceptable for the current phase;
🔵 PENDING: confirm with the facility management and record the accepted RPO in
the facility business-continuity plan.

---

## Section 4 — Migration Files as Schema Backup

4.1 The **85 migration files** in `supabase/migrations/` are the authoritative,
version-controlled definition of every table, view, type, function, trigger,
policy, seed and cron job:

| Migration group | Contents (representative) |
|---|---|
| `20260509*` – `20260716*` | Core schema: `lab_tests`, roles, `app_settings`, `test_templates`, `insurance_providers`, `rooms`/kinds, RLS policies, `patient_registrations` view + INSTEAD OF triggers, `audit_log`, stock, MOH engine, wards/beds |
| `20260716*` (consolidated) | Full enumerated schema + routing/billing functions + `encounter_diagnoses`, `icd11_codes`, views |
| `20260721*` – `20260722*` | MOH 705 mappings/report, dashboard stats, emergency referral tracking, laboratory orders (`lab_orders`/`lab_results`), prescription display names, MOH production sync |
| `20260728*` – `20260730*` | Radiology routing, ICD-11 encounter-diagnoses sync, DHA task D security roles (19-role `is_approved`), task E audit completeness (20 tables), `profiles` table |
| `20260805*` | Sprint 5.2/6 foundation: `sha_fund_type`, `sha_tariffs` (Legal Notices 146/147), `generate_fhir_encounter()`, `consent_otps`, audit hardening, SHR foundation |
| `20260806*` | Break-glass, SHR access notification, `shr_transmission_log`, Second Schedule FHIR fields, RLS missing tables, insurance room kind, **cron `accrue-daily-bed-charges`**, audit archiving (`archive_old_audit_logs` + cron), contracted prices, inpatient orders, room-kind unification, mortuary, MCH/FP indicators |
| `20260810*` – `20260812*` | NLMIS code, MedicationDispense FHIR, encounter signing/locking, dispense stock guard, lab specimen/critical, MAR, mortuary external billing, **security hardening**, insurance rules, **cron `accrue-daily-mortuary-charges`**, insurance visit-limit trigger, drift fixes (encounters/patients/app_settings SHA columns, `dha_outbound_queue`, `consent_otps`, council columns), **SHA benefit packages, claims tables, auto-claim trigger** |

4.2 **Recovery procedure (schema):**
```bash
# 1. Create a new Supabase project
# 2. Run every migration file in filename order (oldest first) in the SQL editor
#    (or via supabase CLI: supabase db push)
# 3. Re-apply grants/secrets, then verify with Section 8 checks
```
4.3 All migrations are written with `IF NOT EXISTS` / `OR REPLACE` /
`ON CONFLICT DO NOTHING` guards so replay is safe (verified during the
2026-08-12 transfer-safety drift fixes, `20260812000003`–`20260812000008`).

---

## Section 5 — Data Export Procedures

5.1 **Database dump (routine/export path):** Lovable dashboard →
**Settings → Database dump** — produces a full PostgreSQL dump of the project
(`tgynjasgnerucrlwedui`). The dump is the primary **data** recovery artefact
(complements the migration-based **schema** recovery).

5.2 **Alternative:** `supabase db dump` via the Supabase CLI (requires project
access credentials held by the administrator).

5.3 **Frequency:** take a database dump:
- immediately before any significant migration or configuration change;
- at least weekly during the certification phase;
- monthly thereafter, retained for 13 months (aligns with audit retention);
- the dump must be stored **off-platform** (facility-controlled storage,
  encrypted) — ⚠️ GAP: designate the storage location (FACILITY_BACKUP_STORE)
  and confirm the encryption-at-rest posture.

5.4 **Patient data export (right of access):** for a data-subject access
request, the facility uses the same dump path or the on-demand FHIR resources
(`fhir-patient`, `fhir-encounter`, `fhir-condition` edge functions) to assemble
the record (DOC-3 §7).

---

## Section 6 — Edge Function Recovery

6.1 The five edge functions (`claims-dispatcher`, `fhir-patient`,
`fhir-encounter`, `fhir-condition`, `icd11-search`) are source-controlled in
`supabase/functions/` and redeployed with:

```bash
supabase functions deploy claims-dispatcher --project-ref tgynjasgnerucrlwedui
supabase functions deploy fhir-patient        --project-ref tgynjasgnerucrlwedui
supabase functions deploy fhir-encounter      --project-ref tgynjasgnerucrlwedui
supabase functions deploy fhir-condition      --project-ref tgynjasgnerucrlwedui
supabase functions deploy icd11-search        --project-ref tgynjasgnerucrlwedui
```

6.2 Automated deployment also exists via GitHub Actions
(`.github/workflows/deploy-functions.yml`, triggered on `main` pushes touching
`supabase/functions/**`).

6.3 **Secrets to re-apply after a project rebuild:** `ICD_CLIENT_ID`,
`ICD_CLIENT_SECRET`, plus the future integration secrets (DHA/SHA/AfyaLink/HWR/
Africa's Talking) defined in `docs/integration-activation-manual.md`.

6.4 **JWT verification config** (`supabase/config.toml`: `verify_jwt = true` for
all five functions) must be reapplied with deployment.

---

## Section 7 — Cron Job Recovery

Three pg_cron jobs are defined in migrations; after a schema rebuild they are
restored by re-running the defining migrations, or manually:

| Job name | Schedule (UTC) | EAT | Function | Defining migration |
|---|---|---|---|---|
| `accrue-daily-bed-charges` | `1 21 * * *` (21:01) | 00:01 | `accrue_daily_bed_charges()` — inserts daily ward bed-charge line items for admitted admissions | `20260806000007_accrue_bed_charges_cron.sql` |
| `accrue-daily-mortuary-charges` | `31 21 * * *` (21:31) | 00:31 | `accrue_daily_mortuary_charges()` — accrues storage charges for `mortuary_records` with `status='stored'` | `20260807000004_sprint10b_mortuary.sql` |
| `archive-audit-logs-nightly` | `0 23 * * *` (23:00) | 02:00 | `archive_old_audit_logs()` — moves audit rows older than 2 years to `audit_log_archive`, logs runs in `audit_archive_runs` | `20260806101050_e8638a1f-75b6-42c3-9a64-be6489877920.sql` |

Manual re-registration pattern (idempotent):
```sql
SELECT cron.unschedule('accrue-daily-bed-charges')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'accrue-daily-bed-charges');
SELECT cron.schedule('accrue-daily-bed-charges', '1 21 * * *',
                     $$ SELECT public.accrue_daily_bed_charges(); $$);
```
Requires the `pg_cron` and `pg_net` extensions (installed by
`20260806101050...`).

---

## Section 8 — Testing & Verification

8.1 **Post-restore verification checklist** (run in the restored project's SQL
editor):

```sql
-- 1. Schema completeness: core tables exist
SELECT count(*) FROM information_schema.tables
WHERE table_schema = 'public';   -- expect the full table set

-- 2. Security hardening state (fails loudly if permissive policies reappeared)
--    (mirrors the DO block in 20260811000007_security_hardening.sql)

-- 3. Audit pipeline works
SELECT public.archive_old_audit_logs();
SELECT * FROM public.audit_archive_runs ORDER BY run_at DESC LIMIT 5;

-- 4. FHIR generator works (sample output for certification)
SELECT generate_fhir_encounter('<encounter-uuid>');

-- 5. SHA claim auto-generation works on a signed insurance encounter
SELECT id, claim_number, status FROM public.sha_claims
WHERE encounter_id = '<signed-insurance-encounter-uuid>';

-- 6. Cron jobs registered
SELECT jobname, schedule FROM cron.job;
-- expect: accrue-daily-bed-charges, accrue-daily-mortuary-charges,
--         archive-audit-logs-nightly

-- 7. RLS gates work
SELECT public.is_approved(auth.uid());
```

8.2 **Application smoke test:** login as admin → open Dashboard, Queue, a room
(consultation), Laboratory, Accounting, Admin → Audit Log, Admin → Claims Queue
(`admin.queue.tsx`) and confirm data renders.

8.3 **Restore drill:** ⚠️ GAP — schedule and document the **first full restore
drill** (schema replay + data dump restore + verification) before go-live, and
annually thereafter. Record drill dates/results in the facility continuity file.

---

## Section 9 — Disaster Recovery Procedure

9.1 **Invocation.** This procedure is invoked on: total data loss; unrecoverable
project corruption; extended platform outage; or regulatory requirement to
restore.

9.2 **Team.** Facility administrator + system developer; Lovable/Supabase
support as escalation.

9.3 **Step-by-step:**
1. **Assess** — determine scope (data only / schema only / both), confirm the
   latest database dump and its timestamp (RPO check).
2. **Create replacement Supabase project** — same region where feasible;
   note the new project ref.
3. **Replay schema** — run all 85 migration files in order (Section 4).
4. **Restore data** — apply the database dump (Section 5); where the dump
   predates the latest migrations, replay the remaining migrations after the
   dump (migrations are replay-safe).
5. **Reconfigure** — environment variables (`VITE_SUPABASE_URL`,
   `VITE_SUPABASE_PUBLISHABLE_KEY`), edge-function secrets (Section 6.3),
   Auth settings, storage buckets.
6. **Redeploy edge functions** (Section 6) and verify `verify_jwt` config.
7. **Re-register cron jobs** (Section 7).
8. **Verify** — run Section 8 checks; confirm audit continuity
   (`audit_archive_runs`), FHIR generation, claims tables, and RLS.
9. **Point the app at the new project** — update Lovable environment and
   redeploy; update DNS if the URL changed.
10. **Notify** — inform staff, DHA/SHA contacts if integrations were live, and
    affected parties per DOC-6 §9.

9.4 **Authoritative DR reference — the 13-chapter self-hosted transfer manual.**
The complete facility-transfer and disaster-recovery runbook is documented in
the **13-chapter self-hosted transfer manual** produced by the AegisCare
development team (repository handoff documentation). Chapters cover: repository
forking and clone; Supabase project creation; migration replay; Lovable
connection; facility configuration; secrets; admin user creation; verification
checklist; edge function deployment; cron restoration; data export/dump;
cut-over and rollback; and post-go-live monitoring. ⚠️ GAP: that manual is not
present inside this checkout (it is a handoff artefact) — attach the current
copy to this certification pack and keep it versioned alongside DOC-1.

9.5 **Rollback path:** migrations are replay-safe and additive; rollback of a
failed change is by corrective migration (never by editing history) and a
pre-change database dump per Section 5.3.

---

## Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Prepared by | (Technical Lead) | | |
| Reviewed by | (Facility In-Charge) | | |
| Approved by | (Management) | | |

*End of DOC-4.*
