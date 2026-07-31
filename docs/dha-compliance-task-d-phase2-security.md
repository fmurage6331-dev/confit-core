# DHA Compliance — Task D Phase 2: Security Hardening

**Status:** ✅ Complete  
**Date:** 2026-07-30  
**Author:** Francis Muhoro  

---

## Changes made

### 1 — Session timeout (30 minutes)

**File:** `src/components/app-shell.tsx`

Auto-logout after 30 minutes of inactivity. Monitors:
- Mouse movement
- Mouse clicks
- Keyboard input
- Touch events
- Scroll events

Timer resets on any activity. On timeout, user is signed out and
redirected to login with an alert message. Satisfies DHA requirement
for automatic session termination.

---

### 2 — Password policy strengthened

**File:** `src/routes/change-password.tsx`

| Rule | Status |
|---|---|
| Minimum 8 characters | ✅ |
| At least one uppercase letter | ✅ |
| At least one number | ✅ |
| At least one special character | ✅ |
| Maximum 72 characters | ✅ |

Enforced via Zod validation on the frontend.

**Note:** Supabase Auth server-side password policy requires dashboard
access — not available on current Lovable free plan. When project is
transferred to own Supabase account, enable server-side policy at:
Authentication → Policies → Password policy.

---

### 3 — Profile self-management

**File:** `src/routes/account.tsx`

Users can now edit their own:
- First name
- Last name
- Username (unique, lowercase, alphanumeric + underscore)

Previously only admins could set profile details. Now every user
can maintain their own profile from Account Settings.

---

### 4 — Encryption verification

Aegiscare uses Supabase which provides:

| Requirement | Status | Detail |
|---|---|---|
| Encryption at rest | ✅ | AES-256 — Supabase default on all projects |
| Encryption in transit | ✅ | TLS 1.2+ — enforced by Supabase and Lovable |
| Database encryption | ✅ | Postgres data encrypted at rest |
| Storage encryption | ✅ | Supabase Storage AES-256 |

No additional configuration needed — these are Supabase platform defaults.

---

## Remaining Phase 2 items (future)

| Item | When | How |
|---|---|---|
| MFA enforcement | When upgrading Supabase plan | Supabase Auth MFA settings + frontend TOTP UI |
| Server-side password policy | When transferring to own Supabase account | Auth → Policies → Password policy |
| Session timeout configuration | Optional | Change `TIMEOUT_MS` in `app-shell.tsx` |

---

## DHA Compliance task tracker

| Task | Description | Status |
|---|---|---|
| A | ICD-11 structured diagnosis coding | ✅ Complete |
| B | FHIR resource mapping layer | ✅ Complete |
| C | SHA API integration | ⏳ Blocked — needs sandbox credentials |
| D Phase 1 | Role gap fix — is_approved() | ✅ Complete |
| D Phase 2 | Session timeout, password policy, encryption docs | ✅ Complete |
| E | Audit log completeness | ✅ Complete |
| F | ICD-11 WHO API key configuration | ⏳ Blocked — Lovable free plan |