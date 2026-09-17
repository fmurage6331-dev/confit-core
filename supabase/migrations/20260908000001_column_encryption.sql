-- ============================================================================
-- Migration: Column-level encryption for patient PII
-- File:      20260908000001_column_encryption.sql
-- Date:      2026-09-08
-- System:    AegisCare HMS (Supabase project tvdsanagnijrockptzat)
--
-- Compliance basis:
--   - Kenya Digital Health Act 2023, s.24(4) — security safeguards for health data
--   - Data Protection Act 2019, s.41 — security safeguards / integrity & confidentiality
--   - Digital Health (Health Information Management Procedures) Regulations 2025
--
-- What this migration does (see docs/encryption-implementation.md):
--   (a) enables pgcrypto (and Supabase Vault when available)
--   (b) creates public.encryption_keys — key METADATA only (never key material)
--   (c) creates encrypt_pii(text) / decrypt_pii(bytea) helpers (AES-256, pgcrypto)
--       key resolution: current_setting('app.encryption_key', true)  -> session/db GUC
--                       else Supabase Vault secret named in encryption_keys (AT_ENCRYPTION_KEY)
--   (d) adds *_encrypted bytea columns next to the plaintext columns (dual-write phase)
--   (e) trigger trg_encrypt_patient_pii / encrypt_patient_pii() keeps ciphertext in sync
--       + RLS policy so only approved authenticated staff can read patient rows
--   (f) view public.patients_secure — decrypted for approved staff, '***' otherwise
--   (g) public.pii_access_log — immutable log of every decryption of PII fields
--   (+) backfill / key-rotation / status helpers and a logged RPC get_patient_pii()
--
-- Safety:
--   - Idempotent: safe to re-run (IF NOT EXISTS / CREATE OR REPLACE / DROP IF EXISTS).
--   - No table rewrite: new columns are nullable bytea without defaults.
--   - Plaintext columns are KEPT (dual-write phase). Nothing in the app changes.
--   - If the encryption key is not yet provisioned, patient writes still succeed
--     (a WARNING is raised and the row is picked up later by the backfill).
--   - Never blocks on missing Vault: falls back to the app.encryption_key setting.
--
-- After running:
--   1. Provision the key:  Dashboard -> Database -> Vault -> New secret
--        name  = AT_ENCRYPTION_KEY
--        value = output of `openssl rand -hex 32`   (256-bit, 64 hex chars)
--   2. SELECT public.pii_encryption_status();               -- key_configured = true
--   3. SELECT * FROM public.backfill_patient_pii_encryption(500);  -- repeat until remaining = 0
-- ============================================================================


-- ----------------------------------------------------------------------------
-- (a) Extensions
-- ----------------------------------------------------------------------------
-- pgcrypto: Supabase installs extensions in the `extensions` schema. On a
-- vanilla Postgres (CI / local) that schema may not exist, so pick accordingly.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'extensions') THEN
    CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
  ELSE
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
  END IF;
END;
$$;

-- Supabase Vault (key storage). Enabled by default on current Supabase projects;
-- guarded so the migration also runs where Vault is unavailable (local dev/CI).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'supabase_vault') THEN
    RAISE NOTICE 'supabase_vault already enabled';
  ELSIF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'supabase_vault') THEN
    BEGIN
      CREATE EXTENSION IF NOT EXISTS supabase_vault;
      RAISE NOTICE 'supabase_vault enabled';
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Could not enable supabase_vault automatically (%). Enable it in Dashboard -> Database -> Extensions, then create secret AT_ENCRYPTION_KEY.', SQLERRM;
    END;
  ELSE
    RAISE WARNING 'supabase_vault is not available on this server. Key resolution will rely on current_setting(''app.encryption_key'').';
  END IF;
END;
$$;


-- ----------------------------------------------------------------------------
-- (b) Key metadata table — the key material itself is NEVER stored here.
--     Material lives in Supabase Vault (secret named vault_secret_name) or, for
--     local development / emergency use, in the session setting app.encryption_key.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.encryption_keys (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key_name             text UNIQUE NOT NULL,
  key_version          integer UNIQUE NOT NULL,
  vault_secret_name    text NOT NULL,
  algorithm            text NOT NULL DEFAULT 'pgcrypto pgp_sym_encrypt — AES-256 (OpenPGP CFB + MDC), S2K iterated+salted',
  status               text NOT NULL DEFAULT 'active'
                         CHECK (status IN ('pending', 'active', 'retired', 'destroyed')),
  activated_at         timestamptz,
  retired_at           timestamptz,
  rotated_from_version integer,
  notes                text,
  created_by           uuid,
  created_at           timestamptz DEFAULT now()
);

-- At most one active key at any time.
CREATE UNIQUE INDEX IF NOT EXISTS encryption_keys_one_active_idx
  ON public.encryption_keys (status)
  WHERE status = 'active';

COMMENT ON TABLE public.encryption_keys IS
  'Metadata for PII column-encryption keys (name, version, status). Key material is stored in Supabase Vault (vault_secret_name), never in the database tables. DHA s.24(4) / DPA 2019 s.41.';
COMMENT ON COLUMN public.encryption_keys.vault_secret_name IS
  'Name of the secret in vault.secrets that holds the key material (e.g. AT_ENCRYPTION_KEY)';
COMMENT ON COLUMN public.encryption_keys.key_version IS
  'Monotonic key version. patients.pii_key_version records which version encrypted each row.';

-- Seed the initial key record (material must be created separately in Vault).
INSERT INTO public.encryption_keys
  (key_name, key_version, vault_secret_name, status, activated_at, notes)
VALUES
  ('AT_ENCRYPTION_KEY', 1, 'AT_ENCRYPTION_KEY', 'active', now(),
   'Initial PII column-encryption key. Material is held in Supabase Vault under the same name.')
ON CONFLICT DO NOTHING;  -- key_name, key_version or the one-active-key index

ALTER TABLE public.encryption_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "encryption_keys_admin_select" ON public.encryption_keys;
CREATE POLICY "encryption_keys_admin_select"
  ON public.encryption_keys FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
-- No INSERT/UPDATE/DELETE policies: changes only via rotate_pii_key() (SECURITY DEFINER).


-- ----------------------------------------------------------------------------
-- Request-context helpers
-- ----------------------------------------------------------------------------
-- Role claim of the current PostgREST request (anon | authenticated | service_role),
-- NULL when there is no JWT at all (SQL editor, psql, migrations).
CREATE OR REPLACE FUNCTION public.pii_request_role()
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  );
$$;

-- Direct database session (SQL editor / psql / migration runner) as opposed to a
-- PostgREST request impersonating anon/authenticated. Uses session_user (not
-- current_user) so it is correct inside SECURITY DEFINER functions.
CREATE OR REPLACE FUNCTION public.pii_is_dba_session()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT coalesce(public.pii_request_role(), '') NOT IN ('anon', 'authenticated')
     AND (
       session_user IN ('postgres', 'supabase_admin')
       OR EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = session_user AND r.rolsuper)
     );
$$;

-- Approved staff (JWT + user_roles), service_role, or a DBA session.
CREATE OR REPLACE FUNCTION public.can_reveal_pii()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
BEGIN
  IF public.pii_request_role() = 'service_role' THEN
    RETURN true;
  END IF;

  v_uid := auth.uid();
  IF v_uid IS NOT NULL THEN
    RETURN public.is_approved(v_uid);
  END IF;

  RETURN public.pii_is_dba_session();  -- anon / subject-less JWTs -> false
END;
$$;

-- Admin-only contexts: admin role holders, service_role, or DBA session.
CREATE OR REPLACE FUNCTION public.pii_is_admin_context()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
BEGIN
  IF public.pii_request_role() = 'service_role' THEN
    RETURN true;
  END IF;

  v_uid := auth.uid();
  IF v_uid IS NOT NULL THEN
    RETURN public.has_role(v_uid, 'admin');
  END IF;

  RETURN public.pii_is_dba_session();
END;
$$;


-- ----------------------------------------------------------------------------
-- Key resolution
-- ----------------------------------------------------------------------------
-- Read a secret from Supabase Vault. Returns NULL when Vault is unavailable or
-- the secret does not exist (never raises, so writes are never blocked here).
CREATE OR REPLACE FUNCTION public.pii_vault_secret(p_name text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_secret text;
BEGIN
  IF p_name IS NULL OR trim(p_name) = '' THEN
    RETURN NULL;
  END IF;

  BEGIN
    SELECT ds.decrypted_secret
      INTO v_secret
      FROM vault.decrypted_secrets ds
     WHERE ds.name = p_name
     LIMIT 1;
  EXCEPTION
    WHEN undefined_table OR invalid_schema_name OR insufficient_privilege OR undefined_column THEN
      v_secret := NULL;
  END;

  RETURN nullif(v_secret, '');
END;
$$;

-- Version number of the currently active key (NULL if none configured).
CREATE OR REPLACE FUNCTION public.pii_active_key_version()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT k.key_version
    FROM public.encryption_keys k
   WHERE k.status = 'active'
   ORDER BY k.key_version DESC
   LIMIT 1;
$$;

-- Key material for a given key version. Resolution order:
--   1. current_setting('app.encryption_key_v<version>', true)  (dev / emergency override)
--   2. current_setting('app.encryption_key', true)              (active version only)
--   3. Supabase Vault secret named encryption_keys.vault_secret_name
CREATE OR REPLACE FUNCTION public.pii_key_material(p_version integer)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.encryption_keys%ROWTYPE;
  v_key text;
BEGIN
  IF p_version IS NULL THEN
    RETURN NULL;
  END IF;

  v_key := nullif(current_setting('app.encryption_key_v' || p_version::text, true), '');
  IF v_key IS NOT NULL THEN
    RETURN v_key;
  END IF;

  SELECT * INTO v_row FROM public.encryption_keys WHERE key_version = p_version;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_row.status = 'active' THEN
    v_key := nullif(current_setting('app.encryption_key', true), '');
    IF v_key IS NOT NULL THEN
      RETURN v_key;
    END IF;
  END IF;

  RETURN public.pii_vault_secret(v_row.vault_secret_name);
END;
$$;

-- Active key material (spec: current_setting('app.encryption_key', true), else Vault).
CREATE OR REPLACE FUNCTION public.get_pii_encryption_key()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.pii_key_material(public.pii_active_key_version());
$$;

CREATE OR REPLACE FUNCTION public.pii_key_configured()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.get_pii_encryption_key() IS NOT NULL;
$$;


-- ----------------------------------------------------------------------------
-- (c) encrypt_pii(text) -> bytea  /  decrypt_pii(bytea) -> text
--     pgcrypto symmetric (OpenPGP) encryption: AES-256, no compression,
--     iterated+salted S2K key derivation, MDC integrity protection.
--     Ciphertext is randomised (fresh salt/session key per call): equal
--     plaintexts never produce equal ciphertexts, so ciphertext is not searchable.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.encrypt_pii(p_plaintext text)
RETURNS bytea
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_key text;
BEGIN
  IF p_plaintext IS NULL THEN
    RETURN NULL;
  END IF;

  v_key := public.get_pii_encryption_key();
  IF v_key IS NULL THEN
    RAISE EXCEPTION 'encrypt_pii: PII encryption key is not configured'
      USING HINT = 'Create Vault secret AT_ENCRYPTION_KEY (Dashboard -> Database -> Vault) or SET app.encryption_key for this session.';
  END IF;

  RETURN pgp_sym_encrypt(
    p_plaintext,
    v_key,
    'cipher-algo=aes256, compress-algo=0, s2k-mode=3, unicode-mode=1'
  );
END;
$$;

-- p_key_version: pass patients.pii_key_version when known (deterministic key choice).
-- When NULL the active key is tried first, then any retired keys (rotation window).
CREATE OR REPLACE FUNCTION public.decrypt_pii(p_ciphertext bytea, p_key_version integer DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_key    text;
  v_active integer;
  v_rec    record;
BEGIN
  IF p_ciphertext IS NULL THEN
    RETURN NULL;
  END IF;

  IF p_key_version IS NOT NULL THEN
    v_key := public.pii_key_material(p_key_version);
    IF v_key IS NULL THEN
      RAISE EXCEPTION 'decrypt_pii: key material for key_version % is not available', p_key_version
        USING HINT = 'Check public.encryption_keys and the corresponding Vault secret.';
    END IF;
    RETURN pgp_sym_decrypt(p_ciphertext, v_key);
  END IF;

  v_active := public.pii_active_key_version();
  v_key    := public.pii_key_material(v_active);
  IF v_key IS NULL THEN
    RAISE EXCEPTION 'decrypt_pii: PII encryption key is not configured'
      USING HINT = 'Create Vault secret AT_ENCRYPTION_KEY or SET app.encryption_key for this session.';
  END IF;

  BEGIN
    RETURN pgp_sym_decrypt(p_ciphertext, v_key);
  EXCEPTION
    WHEN external_routine_invocation_exception OR data_exception THEN
      NULL;  -- wrong key: fall through to retired keys
  END;

  FOR v_rec IN
    SELECT k.key_version
      FROM public.encryption_keys k
     WHERE k.status = 'retired'
       AND k.key_version <> v_active
     ORDER BY k.key_version DESC
  LOOP
    v_key := public.pii_key_material(v_rec.key_version);
    CONTINUE WHEN v_key IS NULL;
    BEGIN
      RETURN pgp_sym_decrypt(p_ciphertext, v_key);
    EXCEPTION
      WHEN external_routine_invocation_exception OR data_exception THEN
        NULL;
    END;
  END LOOP;

  RAISE EXCEPTION 'decrypt_pii: ciphertext could not be decrypted with the active key or any retired key';
END;
$$;

COMMENT ON FUNCTION public.encrypt_pii(text) IS
  'Encrypts a PII value with the active key (pgcrypto pgp_sym_encrypt, AES-256). Randomised output. Raises if no key is configured.';
COMMENT ON FUNCTION public.decrypt_pii(bytea, integer) IS
  'Decrypts a PII value. Pass patients.pii_key_version when known; otherwise tries the active key then retired keys.';


-- ----------------------------------------------------------------------------
-- (d) Encrypted columns alongside the existing plaintext columns (dual-write)
-- ----------------------------------------------------------------------------
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS national_id_encrypted  bytea,
  ADD COLUMN IF NOT EXISTS phone_encrypted        bytea,
  ADD COLUMN IF NOT EXISTS email_encrypted        bytea,
  ADD COLUMN IF NOT EXISTS dob_encrypted          bytea,
  ADD COLUMN IF NOT EXISTS next_of_kin_encrypted  bytea,
  ADD COLUMN IF NOT EXISTS pii_key_version        integer;

COMMENT ON COLUMN public.patients.national_id_encrypted IS
  'AES-256 ciphertext of national_id (pgcrypto). Dual-write phase: plaintext column retained. DHA 2023 s.24(4).';
COMMENT ON COLUMN public.patients.phone_encrypted IS
  'AES-256 ciphertext of phone (pgcrypto). Dual-write phase: plaintext column retained.';
COMMENT ON COLUMN public.patients.email_encrypted IS
  'AES-256 ciphertext of email (pgcrypto). Dual-write phase: plaintext column retained.';
COMMENT ON COLUMN public.patients.dob_encrypted IS
  'AES-256 ciphertext of date_of_birth as ISO text YYYY-MM-DD (pgcrypto). Dual-write phase.';
COMMENT ON COLUMN public.patients.next_of_kin_encrypted IS
  'AES-256 ciphertext of next_of_kin JSON text (pgcrypto). Dual-write phase.';
COMMENT ON COLUMN public.patients.pii_key_version IS
  'encryption_keys.key_version used for this row''s *_encrypted columns. NULL = not yet encrypted.';

-- Does this row still need (re-)encryption with the active key?
CREATE OR REPLACE FUNCTION public.patient_pii_pending(p public.patients, p_active_version integer)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (p.national_id IS NOT NULL OR p.phone IS NOT NULL OR p.email IS NOT NULL
          OR p.date_of_birth IS NOT NULL OR p.next_of_kin IS NOT NULL)
     AND (p.pii_key_version IS DISTINCT FROM p_active_version
          OR (p.national_id   IS NOT NULL AND p.national_id_encrypted IS NULL)
          OR (p.phone         IS NOT NULL AND p.phone_encrypted       IS NULL)
          OR (p.email         IS NOT NULL AND p.email_encrypted       IS NULL)
          OR (p.date_of_birth IS NOT NULL AND p.dob_encrypted         IS NULL)
          OR (p.next_of_kin   IS NOT NULL AND p.next_of_kin_encrypted IS NULL));
$$;


-- ----------------------------------------------------------------------------
-- (e) Auto-encrypt trigger
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.encrypt_patient_pii()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_active  integer;
  v_has_pii boolean;
  v_changed boolean;
  v_needs   boolean;
BEGIN
  v_has_pii := NEW.national_id IS NOT NULL OR NEW.phone IS NOT NULL OR NEW.email IS NOT NULL
               OR NEW.date_of_birth IS NOT NULL OR NEW.next_of_kin IS NOT NULL;

  IF NOT v_has_pii THEN
    NEW.national_id_encrypted := NULL;
    NEW.phone_encrypted       := NULL;
    NEW.email_encrypted       := NULL;
    NEW.dob_encrypted         := NULL;
    NEW.next_of_kin_encrypted := NULL;
    NEW.pii_key_version       := NULL;
    RETURN NEW;
  END IF;

  v_active := public.pii_active_key_version();

  -- Did a PII value actually change (or is this a new row)?
  v_changed := TG_OP = 'INSERT'
      OR NEW.national_id   IS DISTINCT FROM OLD.national_id
      OR NEW.phone         IS DISTINCT FROM OLD.phone
      OR NEW.email         IS DISTINCT FROM OLD.email
      OR NEW.date_of_birth IS DISTINCT FROM OLD.date_of_birth
      OR NEW.next_of_kin   IS DISTINCT FROM OLD.next_of_kin;

  -- Re-encrypt when something changed, or when the row is stale (never
  -- encrypted / encrypted under a retired key) — opportunistic catch-up.
  v_needs := v_changed OR public.patient_pii_pending(NEW, v_active);

  IF NOT v_needs THEN
    RETURN NEW;
  END IF;

  IF v_active IS NULL OR NOT public.pii_key_configured() THEN
    -- Dual-write phase: never block patient registration because the key is missing.
    -- Drop ciphertext that would now be stale; keep the rest; backfill catches up later.
    IF NOT v_changed THEN
      RETURN NEW;  -- nothing new to protect; stay quiet, backfill will handle it
    END IF;
    IF TG_OP = 'INSERT' THEN
      NEW.national_id_encrypted := NULL;
      NEW.phone_encrypted       := NULL;
      NEW.email_encrypted       := NULL;
      NEW.dob_encrypted         := NULL;
      NEW.next_of_kin_encrypted := NULL;
      NEW.pii_key_version       := NULL;
    ELSE
      IF NEW.national_id   IS DISTINCT FROM OLD.national_id   THEN NEW.national_id_encrypted := NULL; END IF;
      IF NEW.phone         IS DISTINCT FROM OLD.phone         THEN NEW.phone_encrypted       := NULL; END IF;
      IF NEW.email         IS DISTINCT FROM OLD.email         THEN NEW.email_encrypted       := NULL; END IF;
      IF NEW.date_of_birth IS DISTINCT FROM OLD.date_of_birth THEN NEW.dob_encrypted         := NULL; END IF;
      IF NEW.next_of_kin   IS DISTINCT FROM OLD.next_of_kin   THEN NEW.next_of_kin_encrypted := NULL; END IF;
    END IF;
    RAISE WARNING 'encrypt_patient_pii: PII encryption key not configured — patient % written without column-level encryption. Provision Vault secret AT_ENCRYPTION_KEY, then run public.backfill_patient_pii_encryption().', NEW.id;
    RETURN NEW;
  END IF;

  -- (Re-)encrypt every PII field with the active key so a row always sits on one key version.
  NEW.national_id_encrypted := public.encrypt_pii(NEW.national_id);
  NEW.phone_encrypted       := public.encrypt_pii(NEW.phone);
  NEW.email_encrypted       := public.encrypt_pii(NEW.email);
  NEW.dob_encrypted         := public.encrypt_pii(to_char(NEW.date_of_birth, 'YYYY-MM-DD'));
  NEW.next_of_kin_encrypted := public.encrypt_pii(NEW.next_of_kin::text);
  NEW.pii_key_version       := v_active;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_encrypt_patient_pii ON public.patients;
CREATE TRIGGER trg_encrypt_patient_pii
  BEFORE INSERT OR UPDATE OF national_id, phone, email, date_of_birth, next_of_kin
  ON public.patients
  FOR EACH ROW
  EXECUTE FUNCTION public.encrypt_patient_pii();

COMMENT ON FUNCTION public.encrypt_patient_pii() IS
  'BEFORE INSERT/UPDATE trigger on patients: maintains *_encrypted columns (dual-write). Non-blocking when the key is not yet provisioned.';

-- RLS: only approved, authenticated staff may read patient rows (including the
-- encrypted columns). Postgres RLS is row-scoped; the column-level guarantee is
-- completed by (1) revoking anon's table privileges below, (2) decrypt functions
-- not being executable by anon/authenticated, (3) patients_secure grants.
DROP POLICY IF EXISTS "patients_encrypted_pii_select_authenticated" ON public.patients;
CREATE POLICY "patients_encrypted_pii_select_authenticated"
  ON public.patients FOR SELECT
  TO authenticated
  USING (public.is_approved(auth.uid()));

-- Unauthenticated (anon) requests never legitimately read patients.
REVOKE ALL ON TABLE public.patients FROM anon;


-- ----------------------------------------------------------------------------
-- (g) PII access log — immutable
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pii_access_log (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid,
  patient_id     uuid,
  field_accessed text,
  accessed_at    timestamptz DEFAULT now(),
  purpose        text,
  accessed_via   text,
  jwt_role       text,
  session_role   text,
  client_ip      text
);

CREATE INDEX IF NOT EXISTS idx_pii_access_log_patient  ON public.pii_access_log (patient_id, accessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_pii_access_log_user     ON public.pii_access_log (user_id, accessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_pii_access_log_accessed ON public.pii_access_log (accessed_at DESC);

COMMENT ON TABLE public.pii_access_log IS
  'Immutable log of every decryption of patient PII fields (who, which patient, which field, when, why). DHA 2023 s.24(4) / DPA 2019.';
COMMENT ON COLUMN public.pii_access_log.field_accessed IS
  'national_id | phone | email | date_of_birth | next_of_kin';
COMMENT ON COLUMN public.pii_access_log.accessed_via IS
  'view:patients_secure | rpc:get_patient_pii | app | manual';

ALTER TABLE public.pii_access_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pii_access_log_admin_select" ON public.pii_access_log;
CREATE POLICY "pii_access_log_admin_select"
  ON public.pii_access_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
-- Inserts happen only through log_pii_access() (SECURITY DEFINER, owner bypasses RLS).

-- Immutability (same pattern as Session 8 audit_log triggers)
CREATE OR REPLACE FUNCTION public.block_pii_access_log_modification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION
    'pii_access_log records are immutable and cannot be modified or deleted. Table: %',
    TG_TABLE_NAME;
END;
$$;

DROP TRIGGER IF EXISTS trg_immutable_pii_access_log ON public.pii_access_log;
CREATE TRIGGER trg_immutable_pii_access_log
  BEFORE UPDATE OR DELETE ON public.pii_access_log
  FOR EACH ROW
  EXECUTE FUNCTION public.block_pii_access_log_modification();

-- Internal writer. purpose / accessed_via can be overridden for the current
-- transaction via set_config('app.pii_purpose', ..., true) / ('app.pii_access_via', ..., true).
CREATE OR REPLACE FUNCTION public.log_pii_access(
  p_patient_id uuid,
  p_fields     text[],
  p_purpose    text DEFAULT NULL,
  p_via        text DEFAULT 'view:patients_secure'
)
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_purpose text;
  v_via     text;
  v_headers jsonb;
  v_ip      text;
  v_count   integer := 0;
BEGIN
  IF p_fields IS NULL OR cardinality(p_fields) = 0 THEN
    RETURN 0;
  END IF;

  v_purpose := coalesce(nullif(current_setting('app.pii_purpose', true), ''),
                        nullif(trim(coalesce(p_purpose, '')), ''),
                        'unspecified');
  v_via     := coalesce(nullif(current_setting('app.pii_access_via', true), ''), p_via);

  -- Client IP from PostgREST request headers (best effort — never fails the access).
  BEGIN
    v_headers := nullif(current_setting('request.headers', true), '')::jsonb;
    v_ip      := coalesce(v_headers ->> 'cf-connecting-ip',
                          nullif(trim(split_part(coalesce(v_headers ->> 'x-forwarded-for', ''), ',', 1)), ''),
                          v_headers ->> 'x-real-ip');
  EXCEPTION WHEN OTHERS THEN
    v_ip := NULL;
  END;

  INSERT INTO public.pii_access_log
    (user_id, patient_id, field_accessed, purpose, accessed_via, jwt_role, session_role, client_ip)
  SELECT auth.uid(), p_patient_id, f, v_purpose, v_via, public.pii_request_role(), session_user, v_ip
    FROM unnest(p_fields) AS f;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Application hook: lets the frontend record PII views it renders from the
-- plaintext columns during the dual-write phase (rpc('record_pii_access', ...)).
CREATE OR REPLACE FUNCTION public.record_pii_access(
  p_patient_id uuid,
  p_fields     text[],
  p_purpose    text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL AND public.pii_request_role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'record_pii_access: authenticated session required';
  END IF;
  IF p_patient_id IS NULL THEN
    RAISE EXCEPTION 'record_pii_access: p_patient_id is required';
  END IF;
  IF p_fields IS NULL OR cardinality(p_fields) = 0
     OR NOT (p_fields <@ ARRAY['national_id', 'phone', 'email', 'date_of_birth', 'next_of_kin']::text[]) THEN
    RAISE EXCEPTION 'record_pii_access: p_fields must be a non-empty subset of {national_id, phone, email, date_of_birth, next_of_kin}';
  END IF;

  RETURN public.log_pii_access(p_patient_id, p_fields, p_purpose, 'app');
END;
$$;


-- ----------------------------------------------------------------------------
-- (f) Secure view — decrypted for approved staff, masked ('***') otherwise
-- ----------------------------------------------------------------------------
-- Per-row reveal helper. Looks the ciphertext up by patient id itself (so a
-- pii_access_log row can never be attributed to the wrong patient) and is
-- fail-closed: values are decrypted ONLY when the access can be logged.
-- PostgREST executes GET requests in READ ONLY transactions, so
-- .from('patients_secure').select() returns masked values with
-- pii_status = 'masked:read_only_transaction'; use rpc('get_patient_pii') instead.
-- NOTE: SECURITY DEFINER — relies on patients SELECT RLS being all-or-nothing
-- per user (is_approved). Revisit if row-scoped patient policies are introduced.
CREATE OR REPLACE FUNCTION public.reveal_patient_pii(p_patient_id uuid)
RETURNS TABLE (
  national_id   text,
  phone         text,
  email         text,
  date_of_birth text,
  next_of_kin   jsonb,
  pii_revealed  boolean,
  pii_status    text
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_row    record;
  v_fields text[] := ARRAY[]::text[];
  v_status text;
BEGIN
  IF p_patient_id IS NULL THEN
    RETURN;
  END IF;

  SELECT p.pii_key_version,
         p.national_id_encrypted, p.phone_encrypted, p.email_encrypted,
         p.dob_encrypted, p.next_of_kin_encrypted
    INTO v_row
    FROM public.patients p
   WHERE p.id = p_patient_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_row.national_id_encrypted IS NOT NULL THEN v_fields := array_append(v_fields, 'national_id');   END IF;
  IF v_row.phone_encrypted       IS NOT NULL THEN v_fields := array_append(v_fields, 'phone');         END IF;
  IF v_row.email_encrypted       IS NOT NULL THEN v_fields := array_append(v_fields, 'email');         END IF;
  IF v_row.dob_encrypted         IS NOT NULL THEN v_fields := array_append(v_fields, 'date_of_birth'); END IF;
  IF v_row.next_of_kin_encrypted IS NOT NULL THEN v_fields := array_append(v_fields, 'next_of_kin');   END IF;

  IF cardinality(v_fields) = 0 THEN
    RETURN QUERY SELECT NULL::text, NULL::text, NULL::text, NULL::text, NULL::jsonb, false, 'none'::text;
    RETURN;
  END IF;

  IF NOT public.can_reveal_pii() THEN
    v_status := 'masked:not_authorised';
  ELSIF current_setting('transaction_read_only', true) = 'on' THEN
    v_status := 'masked:read_only_transaction';
  ELSIF NOT public.pii_key_configured() THEN
    v_status := 'masked:key_not_configured';
  END IF;

  IF v_status IS NOT NULL THEN
    RETURN QUERY SELECT
      CASE WHEN v_row.national_id_encrypted IS NULL THEN NULL ELSE '***' END,
      CASE WHEN v_row.phone_encrypted       IS NULL THEN NULL ELSE '***' END,
      CASE WHEN v_row.email_encrypted       IS NULL THEN NULL ELSE '***' END,
      CASE WHEN v_row.dob_encrypted         IS NULL THEN NULL ELSE '***' END,
      CASE WHEN v_row.next_of_kin_encrypted IS NULL THEN NULL ELSE to_jsonb('***'::text) END,
      false,
      v_status;
    RETURN;
  END IF;

  national_id   := public.decrypt_pii(v_row.national_id_encrypted, v_row.pii_key_version);
  phone         := public.decrypt_pii(v_row.phone_encrypted,       v_row.pii_key_version);
  email         := public.decrypt_pii(v_row.email_encrypted,       v_row.pii_key_version);
  date_of_birth := public.decrypt_pii(v_row.dob_encrypted,         v_row.pii_key_version);
  next_of_kin   := public.decrypt_pii(v_row.next_of_kin_encrypted, v_row.pii_key_version)::jsonb;
  pii_revealed  := true;
  pii_status    := 'revealed';

  PERFORM public.log_pii_access(p_patient_id, v_fields, NULL, 'view:patients_secure');

  RETURN NEXT;
END;
$$;

CREATE OR REPLACE VIEW public.patients_secure
WITH (security_invoker = true)
AS
SELECT
  p.id,
  p.file_number,
  p.first_name,
  p.middle_name,
  p.family_name,
  p.patient_name,
  p.sex,
  p.dob_known,
  p.estimated_age,
  p.nationality,
  p.county,
  p.city,
  p.national_id_type,
  p.is_deceased,
  p.created_at,
  p.updated_at,
  d.national_id,
  d.phone,
  d.email,
  d.date_of_birth,
  d.next_of_kin,
  d.pii_revealed,
  d.pii_status,
  p.pii_key_version
FROM public.patients p
LEFT JOIN LATERAL public.reveal_patient_pii(p.id) AS d ON true;

COMMENT ON VIEW public.patients_secure IS
  'Patients with PII decrypted from the *_encrypted columns for approved staff (logged in pii_access_log) and masked as ''***'' for anyone else. Read via rpc(get_patient_pii) from the app — PostgREST GET runs read-only and therefore returns masked values.';

-- Logged, decrypted read for the application (POST /rpc/get_patient_pii).
CREATE OR REPLACE FUNCTION public.get_patient_pii(
  p_patient_id uuid,
  p_purpose    text DEFAULT 'clinical_care'
)
RETURNS SETOF public.patients_secure
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF p_patient_id IS NULL THEN
    RAISE EXCEPTION 'get_patient_pii: p_patient_id is required';
  END IF;

  PERFORM set_config('app.pii_purpose',    coalesce(nullif(trim(coalesce(p_purpose, '')), ''), 'clinical_care'), true);
  PERFORM set_config('app.pii_access_via', 'rpc:get_patient_pii', true);

  RETURN QUERY
    SELECT s.*
      FROM public.patients_secure s
     WHERE s.id = p_patient_id;
END;
$$;

COMMENT ON FUNCTION public.get_patient_pii(uuid, text) IS
  'Returns one patients_secure row with PII decrypted for approved staff and records the access (purpose) in pii_access_log. Call via POST rpc so the transaction is read-write.';


-- ----------------------------------------------------------------------------
-- Operations: backfill, key rotation, status
-- ----------------------------------------------------------------------------
-- Encrypts existing rows (and re-encrypts rows on an old key version) in batches.
-- Re-run until remaining = 0.
CREATE OR REPLACE FUNCTION public.backfill_patient_pii_encryption(p_batch_size integer DEFAULT 500)
RETURNS TABLE (processed integer, remaining integer)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_active    integer;
  v_processed integer := 0;
  v_remaining integer := 0;
BEGIN
  IF NOT public.pii_is_admin_context() THEN
    RAISE EXCEPTION 'backfill_patient_pii_encryption: admin, service_role or DBA context required';
  END IF;

  v_active := public.pii_active_key_version();
  IF v_active IS NULL OR NOT public.pii_key_configured() THEN
    RAISE EXCEPTION 'backfill_patient_pii_encryption: PII encryption key is not configured'
      USING HINT = 'Create Vault secret AT_ENCRYPTION_KEY, then re-run.';
  END IF;

  WITH todo AS (
    SELECT p.id
      FROM public.patients p
     WHERE public.patient_pii_pending(p, v_active)
     ORDER BY p.created_at NULLS FIRST, p.id
     LIMIT greatest(coalesce(p_batch_size, 500), 1)
     FOR UPDATE SKIP LOCKED
  )
  UPDATE public.patients p
     SET national_id_encrypted = public.encrypt_pii(p.national_id),
         phone_encrypted       = public.encrypt_pii(p.phone),
         email_encrypted       = public.encrypt_pii(p.email),
         dob_encrypted         = public.encrypt_pii(to_char(p.date_of_birth, 'YYYY-MM-DD')),
         next_of_kin_encrypted = public.encrypt_pii(p.next_of_kin::text),
         pii_key_version       = v_active
    FROM todo
   WHERE p.id = todo.id;

  GET DIAGNOSTICS v_processed = ROW_COUNT;

  SELECT count(*) INTO v_remaining
    FROM public.patients p
   WHERE public.patient_pii_pending(p, v_active);

  processed := v_processed;
  remaining := v_remaining;
  RETURN NEXT;
END;
$$;

-- Key rotation: create the NEW secret in Vault first, then call this. The old
-- key is kept as 'retired' (still readable) until backfill has re-encrypted all
-- rows; only then destroy the old Vault secret and mark the row 'destroyed'.
CREATE OR REPLACE FUNCTION public.rotate_pii_key(
  p_new_vault_secret_name text,
  p_notes                 text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active      public.encryption_keys%ROWTYPE;
  v_new_version integer;
BEGIN
  IF NOT public.pii_is_admin_context() THEN
    RAISE EXCEPTION 'rotate_pii_key: admin, service_role or DBA context required';
  END IF;
  IF p_new_vault_secret_name IS NULL OR trim(p_new_vault_secret_name) = '' THEN
    RAISE EXCEPTION 'rotate_pii_key: p_new_vault_secret_name is required';
  END IF;

  SELECT * INTO v_active
    FROM public.encryption_keys
   WHERE status = 'active'
   ORDER BY key_version DESC
   LIMIT 1;

  IF FOUND AND v_active.vault_secret_name = p_new_vault_secret_name THEN
    RAISE EXCEPTION 'rotate_pii_key: the new secret name must differ from the active secret (%)', p_new_vault_secret_name
      USING HINT = 'Never overwrite a Vault secret in place — existing ciphertext would become unreadable.';
  END IF;
  IF public.pii_vault_secret(p_new_vault_secret_name) IS NULL THEN
    RAISE EXCEPTION 'rotate_pii_key: Vault secret "%" not found or empty — create it first', p_new_vault_secret_name;
  END IF;

  SELECT coalesce(max(key_version), 0) + 1 INTO v_new_version FROM public.encryption_keys;

  UPDATE public.encryption_keys
     SET status = 'retired', retired_at = now()
   WHERE status = 'active';

  INSERT INTO public.encryption_keys
    (key_name, key_version, vault_secret_name, status, activated_at, rotated_from_version, notes, created_by)
  VALUES
    (p_new_vault_secret_name, v_new_version, p_new_vault_secret_name, 'active', now(),
     v_active.key_version, p_notes, auth.uid());

  RETURN v_new_version;
END;
$$;

-- Health/verification report (never exposes key material).
CREATE OR REPLACE FUNCTION public.pii_encryption_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active     public.encryption_keys%ROWTYPE;
  v_key_source text;
  v_total      bigint;
  v_current    bigint;
  v_pending    bigint;
  v_rotation   bigint;
  v_fields     jsonb;
  v_log_rows   bigint;
  v_trigger_on boolean;
  v_rls_on     boolean;
BEGIN
  IF NOT public.pii_is_admin_context() THEN
    RAISE EXCEPTION 'pii_encryption_status: admin, service_role or DBA context required';
  END IF;

  SELECT * INTO v_active
    FROM public.encryption_keys
   WHERE status = 'active'
   ORDER BY key_version DESC
   LIMIT 1;

  IF NOT FOUND THEN
    v_key_source := 'none (no active row in encryption_keys)';
  ELSIF nullif(current_setting('app.encryption_key_v' || v_active.key_version::text, true), '') IS NOT NULL
     OR nullif(current_setting('app.encryption_key', true), '') IS NOT NULL THEN
    v_key_source := 'session_setting';
  ELSIF public.pii_vault_secret(v_active.vault_secret_name) IS NOT NULL THEN
    v_key_source := 'vault';
  ELSE
    v_key_source := 'none';
  END IF;

  SELECT count(*),
         count(*) FILTER (WHERE p.pii_key_version = v_active.key_version
                            AND NOT public.patient_pii_pending(p, v_active.key_version)),
         count(*) FILTER (WHERE public.patient_pii_pending(p, v_active.key_version)),
         count(*) FILTER (WHERE p.pii_key_version IS NOT NULL
                            AND p.pii_key_version IS DISTINCT FROM v_active.key_version)
    INTO v_total, v_current, v_pending, v_rotation
    FROM public.patients p;

  SELECT jsonb_build_object(
           'national_id',   count(*) FILTER (WHERE p.national_id   IS NOT NULL AND p.national_id_encrypted IS NULL),
           'phone',         count(*) FILTER (WHERE p.phone         IS NOT NULL AND p.phone_encrypted       IS NULL),
           'email',         count(*) FILTER (WHERE p.email         IS NOT NULL AND p.email_encrypted       IS NULL),
           'date_of_birth', count(*) FILTER (WHERE p.date_of_birth IS NOT NULL AND p.dob_encrypted         IS NULL),
           'next_of_kin',   count(*) FILTER (WHERE p.next_of_kin   IS NOT NULL AND p.next_of_kin_encrypted IS NULL))
    INTO v_fields
    FROM public.patients p;

  SELECT count(*) INTO v_log_rows FROM public.pii_access_log;

  SELECT coalesce(bool_or(t.tgenabled <> 'D'), false) INTO v_trigger_on
    FROM pg_trigger t
   WHERE t.tgrelid = 'public.patients'::regclass
     AND t.tgname  = 'trg_encrypt_patient_pii';

  SELECT c.relrowsecurity INTO v_rls_on
    FROM pg_class c
   WHERE c.oid = 'public.patients'::regclass;

  RETURN jsonb_build_object(
    'generated_at',                    now(),
    'key_configured',                  public.pii_key_configured(),
    'key_source',                      v_key_source,
    'active_key',                      CASE WHEN v_active.key_version IS NULL THEN NULL ELSE
                                         jsonb_build_object(
                                           'key_name',          v_active.key_name,
                                           'key_version',       v_active.key_version,
                                           'vault_secret_name', v_active.vault_secret_name,
                                           'activated_at',      v_active.activated_at) END,
    'retired_keys',                    (SELECT count(*) FROM public.encryption_keys WHERE status = 'retired'),
    'patients_total',                  v_total,
    'patients_encrypted_current_key',  v_current,
    'patients_pending_encryption',     v_pending,
    'patients_pending_rotation',       v_rotation,
    'fields_pending',                  v_fields,
    'pii_access_log_rows',             v_log_rows,
    'trigger_enabled',                 v_trigger_on,
    'patients_rls_enabled',            v_rls_on
  );
END;
$$;


-- ----------------------------------------------------------------------------
-- Privileges (Supabase default privileges grant EXECUTE/ALL to anon &
-- authenticated on new objects — tighten explicitly).
-- ----------------------------------------------------------------------------
-- Tables
REVOKE ALL ON TABLE public.encryption_keys FROM PUBLIC, anon, authenticated;
GRANT  SELECT ON TABLE public.encryption_keys TO authenticated;          -- RLS: admins only
GRANT  ALL    ON TABLE public.encryption_keys TO service_role;

REVOKE ALL ON TABLE public.pii_access_log FROM PUBLIC, anon, authenticated;
GRANT  SELECT ON TABLE public.pii_access_log TO authenticated;           -- RLS: admins only
GRANT  ALL    ON TABLE public.pii_access_log TO service_role;

-- View
REVOKE ALL ON TABLE public.patients_secure FROM PUBLIC, anon;
GRANT  SELECT ON TABLE public.patients_secure TO authenticated, service_role;

-- Internal-only functions: not callable by clients (anon / authenticated)
REVOKE ALL ON FUNCTION public.pii_request_role()                          FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pii_is_dba_session()                        FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pii_is_admin_context()                      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pii_vault_secret(text)                      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pii_active_key_version()                    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pii_key_material(integer)                   FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_pii_encryption_key()                    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pii_key_configured()                        FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.encrypt_pii(text)                           FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.decrypt_pii(bytea, integer)                 FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.patient_pii_pending(public.patients, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.encrypt_patient_pii()                       FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.block_pii_access_log_modification()         FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_pii_access(uuid, text[], text, text)    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.backfill_patient_pii_encryption(integer)    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rotate_pii_key(text, text)                  FROM PUBLIC, anon, authenticated;

-- Client-facing functions: authenticated staff only (never anon)
REVOKE ALL ON FUNCTION public.can_reveal_pii()                                          FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_pii_access(uuid, text[], text)                     FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reveal_patient_pii(uuid)                                  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_patient_pii(uuid, text)                               FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pii_encryption_status()                                   FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.can_reveal_pii()                                          TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_pii_access(uuid, text[], text)                     TO authenticated;
GRANT EXECUTE ON FUNCTION public.reveal_patient_pii(uuid)                                  TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_patient_pii(uuid, text)                               TO authenticated;
GRANT EXECUTE ON FUNCTION public.pii_encryption_status()                                   TO authenticated;

-- service_role (Edge Functions, operations)
GRANT EXECUTE ON FUNCTION public.can_reveal_pii()                                          TO service_role;
GRANT EXECUTE ON FUNCTION public.record_pii_access(uuid, text[], text)                     TO service_role;
GRANT EXECUTE ON FUNCTION public.reveal_patient_pii(uuid)                                  TO service_role;
GRANT EXECUTE ON FUNCTION public.get_patient_pii(uuid, text)                               TO service_role;
GRANT EXECUTE ON FUNCTION public.pii_encryption_status()                                   TO service_role;
GRANT EXECUTE ON FUNCTION public.encrypt_pii(text)                                         TO service_role;
GRANT EXECUTE ON FUNCTION public.decrypt_pii(bytea, integer)                               TO service_role;
GRANT EXECUTE ON FUNCTION public.backfill_patient_pii_encryption(integer)                  TO service_role;
GRANT EXECUTE ON FUNCTION public.rotate_pii_key(text, text)                                TO service_role;
GRANT EXECUTE ON FUNCTION public.log_pii_access(uuid, text[], text, text)                  TO service_role;


-- ----------------------------------------------------------------------------
-- Integration with existing compliance controls (guarded — no hard dependency)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  -- consent_otps.otp_hash is already protected (Layer 4): stored as a SHA-256 hash
  -- only, never the raw OTP, and useless after expires_at. Document only — no
  -- column-level encryption applied (encrypting a one-way hash adds no confidentiality).
  IF to_regclass('public.consent_otps') IS NOT NULL
     AND EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = 'consent_otps' AND column_name = 'otp_hash') THEN
    EXECUTE $c$COMMENT ON COLUMN public.consent_otps.otp_hash IS
      'SHA-256 hex hash of the one-time consent code (raw OTP is never stored). Layer 4 application hashing — see docs/encryption-implementation.md. Not column-encrypted by design.'$c$;
  END IF;

  -- Audit changes to key metadata with the standard audit trigger (Session 8 / Task E)
  IF to_regprocedure('public.audit_trigger_fn()') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS audit_encryption_keys ON public.encryption_keys';
    EXECUTE 'CREATE TRIGGER audit_encryption_keys
               AFTER INSERT OR UPDATE OR DELETE ON public.encryption_keys
               FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn()';
  END IF;

  -- Retention matrix (GAP 16): PII access log retained like audit_log (20 years)
  IF to_regclass('public.data_retention_policy') IS NOT NULL THEN
    INSERT INTO public.data_retention_policy
      (table_name, retention_years, archival_destination, legal_basis, notes)
    VALUES
      ('pii_access_log',  20, 'audit_log_archive',
       'Digital Health Act 2023 s.24(4); Data Protection Act 2019 s.41',
       'PII decryption access log — immutable; retained with audit_log'),
      ('encryption_keys', 20, 'audit_log_archive',
       'Digital Health Act 2023 s.24(4)',
       'Key metadata (no key material) — retained as long as any ciphertext exists')
    ON CONFLICT (table_name) DO NOTHING;
  END IF;
END;
$$;


-- ----------------------------------------------------------------------------
-- Verify
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_missing text[] := ARRAY[]::text[];
  v_rls     boolean;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') THEN
    v_missing := array_append(v_missing, 'extension pgcrypto');
  END IF;
  IF to_regclass('public.encryption_keys') IS NULL THEN v_missing := array_append(v_missing, 'table encryption_keys'); END IF;
  IF to_regclass('public.pii_access_log')  IS NULL THEN v_missing := array_append(v_missing, 'table pii_access_log');  END IF;
  IF to_regclass('public.patients_secure') IS NULL THEN v_missing := array_append(v_missing, 'view patients_secure');  END IF;
  IF to_regprocedure('public.encrypt_pii(text)') IS NULL           THEN v_missing := array_append(v_missing, 'function encrypt_pii(text)'); END IF;
  IF to_regprocedure('public.decrypt_pii(bytea, integer)') IS NULL THEN v_missing := array_append(v_missing, 'function decrypt_pii(bytea)'); END IF;
  IF to_regprocedure('public.encrypt_patient_pii()') IS NULL       THEN v_missing := array_append(v_missing, 'function encrypt_patient_pii()'); END IF;
  IF to_regprocedure('public.get_patient_pii(uuid, text)') IS NULL THEN v_missing := array_append(v_missing, 'function get_patient_pii(uuid, text)'); END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'patients'
       AND column_name IN ('national_id_encrypted', 'phone_encrypted', 'email_encrypted',
                           'dob_encrypted', 'next_of_kin_encrypted', 'pii_key_version')
    GROUP BY table_name HAVING count(*) = 6
  ) THEN
    v_missing := array_append(v_missing, 'patients.*_encrypted columns');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.patients'::regclass AND tgname = 'trg_encrypt_patient_pii') THEN
    v_missing := array_append(v_missing, 'trigger trg_encrypt_patient_pii');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.pii_access_log'::regclass AND tgname = 'trg_immutable_pii_access_log') THEN
    v_missing := array_append(v_missing, 'trigger trg_immutable_pii_access_log');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'patients'
                    AND policyname = 'patients_encrypted_pii_select_authenticated') THEN
    v_missing := array_append(v_missing, 'policy patients_encrypted_pii_select_authenticated');
  END IF;

  IF cardinality(v_missing) > 0 THEN
    RAISE EXCEPTION 'Column encryption migration incomplete — missing: %', array_to_string(v_missing, ', ');
  END IF;

  SELECT c.relrowsecurity INTO v_rls FROM pg_class c WHERE c.oid = 'public.patients'::regclass;
  IF NOT coalesce(v_rls, false) THEN
    RAISE WARNING 'Row Level Security is NOT enabled on public.patients — the new SELECT policy is inert until RLS is enabled (verify existing policies first, then ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY).';
  END IF;

  IF NOT public.pii_key_configured() THEN
    RAISE WARNING 'PII encryption key not configured yet. Next: create Vault secret AT_ENCRYPTION_KEY, then SELECT * FROM public.backfill_patient_pii_encryption(500) until remaining = 0.';
  END IF;

  RAISE NOTICE 'Column-level PII encryption objects verified OK.';
END;
$$;

-- Let PostgREST pick up the new view/functions immediately.
NOTIFY pgrst, 'reload schema';

-- Status snapshot (visible when run in the SQL editor)
SELECT public.pii_encryption_status() AS pii_encryption_status;
