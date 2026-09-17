---
title: AegisCare HMS — Encryption Implementation
author: Francis Muhoro
date: 2026-09-08
version: v5.17
---

# AegisCare HMS — Encryption Implementation

|                     |                                                                                        |
|---------------------|----------------------------------------------------------------------------------------|
| **System**          | AegisCare HMS                                                                          |
| **Repository**      | `fmurage6331-dev/confit-core`                                                          |
| **Supabase project**| `tvdsanagnijrockptzat`                                                                 |
| **Date**            | 2026-09-08                                                                             |
| **Document type**   | Technical control description + DHA/ODPC audit evidence                                |
| **Related docs**    | `docs/dha-compliance-assessment.md`, `docs/breach-response-runbook.md`, `docs/certification/DOC-6-security-policy.md`, `docs/certification/DOC-2-dpia.md` |

> **Scope.** Describes the four encryption layers protecting patient data in AegisCare HMS,
> with emphasis on the new **column-level encryption of PII fields** introduced by migration
> `supabase/migrations/20260908000001_column_encryption.sql`, how the key is managed, and how
> access to decrypted PII is logged.

---

## Compliance Basis

- **Kenya Digital Health Act 2023, Section 24(4)** — data controllers/processors must implement
  appropriate technical and organisational security safeguards for health data.
- **ODPC — Data Protection Act 2019** — s.25 (principles: integrity & confidentiality),
  s.41 (security safeguards, including pseudonymisation and encryption of personal data),
  s.43 (breach notification — encrypted data materially lowers the risk to data subjects).
- **DHA Health Information Management Procedures Regulations 2025** — secure storage,
  access control and audit-trail obligations for health information systems.
- **Digital Health (Data Exchange Component) Regulations 2025** — security requirements
  for systems onboarding to the ESB/AfyaLink HIE.

---

## Encryption Layers

### Layer 1 — Transport (TLS 1.3)

| Item      | Detail                                                                              |
|-----------|-------------------------------------------------------------------------------------|
| Provider  | Supabase (API gateway / PostgREST / Auth / Storage) + Vercel (frontend)             |
| Standard  | TLS 1.3 (TLS 1.2 minimum) with AES-256-GCM cipher suites                            |
| Status    | ✅ Active — all API calls over HTTPS; plain HTTP is not served                        |
| Evidence  | Supabase SSL certificates (`*.supabase.co`), Vercel edge network certificates; browser dev-tools "Security" tab on `https://aegiscare-orcin.vercel.app` |

### Layer 2 — Storage (AES-256 at rest)

| Item      | Detail                                                                              |
|-----------|-------------------------------------------------------------------------------------|
| Provider  | Supabase managed Postgres on AWS (volume-level encryption)                          |
| Standard  | AES-256                                                                             |
| Status    | ✅ Active — entire database, WAL, backups and Storage buckets encrypted at rest      |
| Evidence  | Supabase infrastructure encryption documentation; `docs/certification/DOC-6-security-policy.md` §5 |
| Note      | Data residency (region) is tracked separately in `docs/facility-onboarding.md` and gap #24 of the compliance assessment. Layer 3 below is region-independent: ciphertext is unreadable without the key wherever the volume lives. |

### Layer 3 — Column-Level (PII fields)

| Item      | Detail                                                                              |
|-----------|-------------------------------------------------------------------------------------|
| Provider  | `pgcrypto` (PostgreSQL extension), key held in **Supabase Vault**                   |
| Standard  | AES-256 symmetric encryption — `pgp_sym_encrypt(..., 'cipher-algo=aes256, compress-algo=0, s2k-mode=3, unicode-mode=1')`: OpenPGP CFB mode with MDC integrity check, iterated+salted S2K key derivation, randomised per-value session key/salt (identical plaintexts never produce identical ciphertext) |
| Status    | ✅ Implemented in this migration — **dual-write phase** (plaintext columns retained, see "Rollout phases") |
| Evidence  | Migration `supabase/migrations/20260908000001_column_encryption.sql`; `SELECT public.pii_encryption_status();` |

**Fields encrypted** (all on `public.patients`):

| Plaintext column            | Ciphertext column        | Notes                                             |
|-----------------------------|--------------------------|---------------------------------------------------|
| `patients.national_id`      | `national_id_encrypted`  | National ID / passport / birth-certificate number |
| `patients.phone`            | `phone_encrypted`        |                                                   |
| `patients.email`            | `email_encrypted`        |                                                   |
| `patients.date_of_birth`    | `dob_encrypted`          | Stored as ISO text `YYYY-MM-DD`                   |
| `patients.next_of_kin`      | `next_of_kin_encrypted`  | JSONB serialised to text before encryption        |
| —                           | `pii_key_version`        | Which key version encrypted the row (rotation)    |

**Database objects created**

| Object                                             | Purpose                                                                                     |
|----------------------------------------------------|---------------------------------------------------------------------------------------------|
| `public.encryption_keys`                           | Key **metadata** only (name, version, status, Vault secret name). Never key material. Admin-read via RLS; mutated only by `rotate_pii_key()`. |
| `public.encrypt_pii(text) → bytea`                 | Encrypts with the active key. Raises if no key is configured.                               |
| `public.decrypt_pii(bytea[, key_version]) → text`  | Decrypts; tries the active key then any *retired* key (rotation window).                    |
| `public.get_pii_encryption_key()`                  | Key resolution: `current_setting('app.encryption_key', true)` → else Vault secret. Not executable by `anon`/`authenticated`. |
| `public.encrypt_patient_pii()` + trigger `trg_encrypt_patient_pii` | `BEFORE INSERT OR UPDATE OF national_id, phone, email, date_of_birth, next_of_kin` — keeps ciphertext in sync. Non-blocking if the key is not yet provisioned (raises a WARNING, row is picked up by backfill). |
| `public.patients_secure` (view, `security_invoker`)| Decrypted PII for approved staff (access logged), `'***'` for anyone else.                  |
| `public.get_patient_pii(patient_id, purpose)`      | Logged, decrypted read for the application (`supabase.rpc('get_patient_pii', {...})`).       |
| `public.pii_access_log`                            | Immutable log of every decryption (see below).                                              |
| `public.record_pii_access(patient_id, fields[], purpose)` | Lets the app log PII it renders from plaintext columns during the dual-write phase.  |
| `public.backfill_patient_pii_encryption(batch)`    | Encrypts existing rows / re-encrypts after rotation, in batches.                            |
| `public.rotate_pii_key(new_secret_name, notes)`    | Key rotation (see Key Management).                                                          |
| `public.pii_encryption_status()`                   | Admin health report: key configured, rows pending, trigger/RLS state. Never exposes key material. |
| RLS policy `patients_encrypted_pii_select_authenticated` | `SELECT` on `patients` only for authenticated users that pass `is_approved(auth.uid())`; `anon` table privileges revoked. |

**Access model**

- `anon` — no privileges on `patients`, `patients_secure`, or any encryption function.
- `authenticated` (approved staff via `user_roles`) — may read `patients_secure` and call
  `get_patient_pii()` / `record_pii_access()`; **cannot** call `encrypt_pii`/`decrypt_pii`
  or read key material directly.
- `admin` role — additionally reads `encryption_keys` metadata, `pii_access_log` and
  `pii_encryption_status()`.
- `service_role` (Edge Functions) and DBA sessions — operations: backfill, rotation.

> **PostgREST read-only note.** PostgREST executes `GET` requests inside `READ ONLY`
> transactions. Because decryption is *fail-closed* (a value is revealed only when the access
> can be written to `pii_access_log`), `supabase.from('patients_secure').select()` returns
> masked values with `pii_status = 'masked:read_only_transaction'`. Applications must use
> `supabase.rpc('get_patient_pii', { p_patient_id, p_purpose })` (a `POST`), which decrypts
> **and** logs in one transaction.

### Layer 4 — Application (OTP hashing)

| Item      | Detail                                                                              |
|-----------|-------------------------------------------------------------------------------------|
| Provider  | Application layer — `src/lib/otp-service.ts`, `src/components/consent-dialog.tsx`, `src/routes/rooms.$id.tsx` (SMS delivery via Supabase Edge Function `send-sms`) |
| Standard  | One-way hashing before storage — **SHA-256** via WebCrypto (`crypto.subtle.digest`), hex-encoded |
| Status    | ✅ Active — OTPs are stored as hashes only; the raw 6-digit code exists only in the SMS and in memory during generation; 10-minute expiry |
| Evidence  | `consent_otps.otp_hash` (`text NOT NULL`, migration `20260812000007_drift_consent_otps.sql`); `consent_otps.expires_at` |

`consent_otps.otp_hash` is therefore **already protected** and is *not* additionally
column-encrypted by this migration (encrypting a one-way hash adds no confidentiality; the
value is unusable after `expires_at`). Documented here for completeness of the field inventory.

> Improvement backlog (not blocking): move OTP generation + hash comparison server-side
> (Edge Function) and use a keyed hash (HMAC-SHA-256) or bcrypt so an offline brute-force of
> the 10⁶ code space against a leaked hash is infeasible. Tracked in
> `docs/dha-compliance-assessment.md` (Encryption Compliance section).

---

## Key Management

| Control                 | Implementation                                                                                    |
|-------------------------|---------------------------------------------------------------------------------------------------|
| Key material location   | **Supabase Vault** secret named `AT_ENCRYPTION_KEY` (project `tvdsanagnijrockptzat`). Vault stores secrets with authenticated encryption; the Vault root key is held by Supabase outside the database and is **not** present in database dumps or backups. |
| Never in code / DB      | The key is not in the repository, `.env` files, `app_settings`, or `encryption_keys` (metadata only). `get_pii_encryption_key()` cannot be executed by client roles. |
| Key strength            | 256-bit random: `openssl rand -hex 32` (64 hex characters).                                       |
| Access                  | Supabase **service role** / DBA only. Client roles reach decrypted values solely through `patients_secure` / `get_patient_pii()`, which enforce `is_approved()` and logging. |
| Local / emergency path  | `current_setting('app.encryption_key', true)` (session or database GUC) takes precedence over Vault — used for local development and for emergency decryption if Vault is unavailable. Set it only with `SET LOCAL` in a DBA session; never persist it with `ALTER DATABASE` on production. |
| Versioning              | `encryption_keys.key_version` ↔ `patients.pii_key_version`. Exactly one key is `active`; retired keys remain readable until every row is re-encrypted. |
| Rotation procedure      | Documented in `docs/breach-response-runbook.md` (§1.2 containment → "Rotate PII encryption key") and summarised below. |
| Audit                   | Every change to `encryption_keys` is captured by the standard `audit_trigger_fn()` into `audit_log` (immutable, 20-year retention). |

**Provisioning (one-time, after running the migration)**

1. Dashboard → *Database* → *Vault* → **New secret**: name `AT_ENCRYPTION_KEY`, value = output of `openssl rand -hex 32`.
   (SQL alternative: `select vault.create_secret('<hex>', 'AT_ENCRYPTION_KEY', 'AegisCare PII column-encryption key v1');`)
2. Verify: `select public.pii_encryption_status();` → `"key_configured": true`, `"key_source": "vault"`.
3. Backfill existing patients: `select * from public.backfill_patient_pii_encryption(500);` — repeat until `remaining = 0`.
4. Spot-check: `select * from public.get_patient_pii('<patient uuid>', 'verification');` then
   `select * from public.pii_access_log order by accessed_at desc limit 5;`.

**Rotation (annual, on staff off-boarding with DBA access, or on suspected compromise)**

1. Create a **new** Vault secret (e.g. `AT_ENCRYPTION_KEY_2027`) — never overwrite the active secret in place.
2. `select public.rotate_pii_key('AT_ENCRYPTION_KEY_2027', 'annual rotation 2027');` — old key becomes `retired` (still readable), new key `active`; new writes use it immediately.
3. `select * from public.backfill_patient_pii_encryption(500);` until `remaining = 0` (`pii_encryption_status().patients_pending_rotation = 0`).
4. Only then delete the old Vault secret and `update public.encryption_keys set status = 'destroyed' where key_version = <old>` (DBA session).
5. Record the rotation in `docs/incident-register.md` (or the change log) with date, operator and reason.

---

## PII Access Logging

All decryption of encrypted PII fields is logged in **`public.pii_access_log`**:

| Column           | Meaning                                                                          |
|------------------|----------------------------------------------------------------------------------|
| `user_id`        | `auth.uid()` of the staff member (NULL for service-role / DBA sessions)          |
| `patient_id`     | Patient whose data was decrypted                                                 |
| `field_accessed` | `national_id` \| `phone` \| `email` \| `date_of_birth` \| `next_of_kin` (one row per field) |
| `accessed_at`    | Timestamp (UTC)                                                                  |
| `purpose`        | Purpose supplied by the caller (`get_patient_pii(..., p_purpose)`), default `unspecified` |
| `accessed_via`   | `view:patients_secure` \| `rpc:get_patient_pii` \| `app` \| `manual`             |
| `jwt_role`       | `authenticated` \| `service_role` \| NULL (DBA)                                  |
| `session_role`   | Database session user (distinguishes SQL-editor access)                          |
| `client_ip`      | From `cf-connecting-ip` / `x-forwarded-for` / `x-real-ip` request headers when present |

Properties:

- **Immutable** — `trg_immutable_pii_access_log` blocks `UPDATE`/`DELETE` (same mechanism as `audit_log`, Session 8 GAP 18).
- **Fail-closed** — if the log row cannot be written (e.g. read-only transaction), the value is masked instead of revealed.
- **Admin-only read** — RLS policy `pii_access_log_admin_select` (`has_role(auth.uid(), 'admin')`).
- **Retention** — registered in `data_retention_policy` as 20 years, archival to `audit_log_archive`.
- **Dual-write phase** — while the application still reads the plaintext columns, PII views rendered by the UI can be logged with `supabase.rpc('record_pii_access', { p_patient_id, p_fields: ['phone'], p_purpose: 'billing' })`.

Useful queries (admin):

```sql
-- Who looked at a given patient's PII in the last 30 days?
select accessed_at, user_id, field_accessed, purpose, accessed_via, client_ip
from public.pii_access_log
where patient_id = '<uuid>' and accessed_at > now() - interval '30 days'
order by accessed_at desc;

-- Unusual volume per user (possible bulk export)
select user_id, count(distinct patient_id) patients, count(*) fields
from public.pii_access_log
where accessed_at > now() - interval '1 day'
group by user_id order by patients desc;
```

---

## Rollout phases

| Phase | State                                                                                      | Status |
|-------|--------------------------------------------------------------------------------------------|--------|
| 0     | Migration applied; key provisioned in Vault; backfill complete                             | ⏳ Run migration + provisioning steps above |
| 1     | **Dual-write** — trigger maintains ciphertext; app still reads plaintext columns; PII views logged via `record_pii_access()` | ✅ This migration |
| 2     | **Dual-read** — app reads PII through `get_patient_pii()` / `patients_secure`; plaintext columns no longer selected by the UI; patient search moves to `file_number`/name (or a keyed-hash index for phone) | Planned |
| 3     | **Plaintext removal** — `national_id`, `phone`, `email`, `date_of_birth`, `next_of_kin` plaintext columns nulled then dropped; `patient_registrations` view, FHIR builders and reports switched to decrypted accessors | Planned (requires app + FHIR/SHA changes; not part of this migration) |

---

## Verification checklist (run in Supabase SQL Editor after the migration)

```sql
select public.pii_encryption_status();
-- expect: key_configured = true, trigger_enabled = true, patients_rls_enabled = true,
--         patients_pending_encryption = 0 after backfill

select column_name from information_schema.columns
where table_name = 'patients' and column_name like '%encrypted%';
-- expect: national_id_encrypted, phone_encrypted, email_encrypted, dob_encrypted, next_of_kin_encrypted

select polname, polroles::regrole[] from pg_policy where polrelid = 'public.patients'::regclass;
-- expect: patients_encrypted_pii_select_authenticated (authenticated)

select tgname from pg_trigger where tgrelid = 'public.pii_access_log'::regclass and not tgisinternal;
-- expect: trg_immutable_pii_access_log
```

---

## Compliance Evidence for DHA Audit

1. This document (`docs/encryption-implementation.md`).
2. Migration files in `supabase/migrations/` — specifically `20260908000001_column_encryption.sql`.
3. RLS policies on all patient tables (`pg_policies` export; `docs/schema.md` §4).
4. `pii_access_log` table (immutable, admin-only, 20-year retention) + `encryption_keys` audit trail in `audit_log`.
5. Audit immutability triggers (Session 8 — `trg_immutable_audit_log`, `trg_immutable_audit_archive`, and now `trg_immutable_pii_access_log`).
6. Supabase Vault secret `AT_ENCRYPTION_KEY` (dashboard screenshot — secret *name and created date only*, never the value).
7. `docs/breach-response-runbook.md` — key-rotation and containment steps.
