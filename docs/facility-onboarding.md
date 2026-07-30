# Facility Onboarding Guide

**System:** Aegiscare  
**Model:** One deployment per facility (Model A)  

---

## Overview

Aegiscare is designed so each facility gets its own isolated deployment:
- Own GitHub repository (forked from master)
- Own Supabase project (own database, own auth, own storage)
- Own Lovable deployment (own URL)

No facility can see another facility's patient data.

---

## Steps to onboard a new facility

### Step 1 — Fork the repository

1. Go to `https://github.com/fmurage6331-dev/confit-core`
2. Click **Fork** → create under the facility's GitHub account
3. Clone the fork locally

### Step 2 — Create a new Supabase project

1. Go to `supabase.com` → New project
2. Name it after the facility (e.g. `aegiscare-facility-name`)
3. Note the **Project URL** and **anon key** and **service role key**

### Step 3 — Run migrations

In the new Supabase project's SQL Editor, run all files in
`supabase/migrations/` in filename order (oldest first).

### Step 4 — Connect to Lovable

1. Go to `lovable.dev` → New project → Import from GitHub
2. Select the forked repo
3. Set environment variables:
   - `VITE_SUPABASE_URL` — your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` — your Supabase anon key

### Step 5 — Configure facility details

1. Log in to the deployed app as admin
2. Go to **Admin → Settings → Facility tab**
3. Fill in:
   - Facility name
   - KMHFL code (find at `hiskenya.org`)
   - County, address, phone, email
   - SHA facility ID and provider number (when available)
4. Click **Save facility details**

### Step 6 — Configure Edge Function secrets

In Supabase → Edge Functions → Secrets, set:
- `ICD_CLIENT_ID` — WHO ICD-11 API client ID (Task F)
- `ICD_CLIENT_SECRET` — WHO ICD-11 API client secret (Task F)

### Step 7 — Create admin user

In Supabase → Authentication → Users → Invite user
Set their role to `admin` in the `user_roles` table.

---

## Pushing updates to a deployed facility

When the master repo gets updates:

```bash
# In the facility's forked repo
git remote add upstream https://github.com/fmurage6331-dev/confit-core
git fetch upstream
git merge upstream/main
git push origin main