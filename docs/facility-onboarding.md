# Facility Onboarding Guide

**System:** Aegiscare  
**Model:** One deployment per facility (Model A)  

---

## Overview

Aegiscare is designed so each facility gets its own isolated deployment:
- Own GitHub repository (forked from master)
- Own Supabase project (own database, own auth, own storage)
- Own Vercel deployment (own URL)

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

### Step 4 — Deploy to Vercel

1. Go to `https://vercel.com` → New Project → Import from GitHub
2. Select the forked repository
3. Set environment variables in Vercel dashboard:
   - `VITE_SUPABASE_URL` — your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` — your Supabase anon key
4. Click **Deploy** → Vercel builds and publishes automatically
5. Note your deployment URL (e.g. `https://aegiscare-facilityname.vercel.app`)

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


## Kenya Data Residency & Cloud Migration

### Current Hosting (Development Phase)
- Supabase Cloud: servers in `us-east-1` (USA) — acceptable for development
- Vercel: global CDN — acceptable for frontend

### Required for ODPC + DHA Compliance (Production)
Kenya law (ODPC Data Protection Act 2019) requires health data to remain in Kenya.

**Recommended Kenya-compliant hosting options:**

| Provider | Type | Notes |
|---|---|---|
| Safaricom Cloud | Kenya-based VPS | Preferred — local support |
| Azure East Africa | Johannesburg region | Closest Azure region |
| AWS af-south-1 | Cape Town | Closest AWS region |
| Angani | Kenya-based | Local Kenyan cloud provider |

### Migration Steps (When Ready)

**Step 1 — Self-host Supabase on Kenya server:**
```bash
# On your Kenya cloud server
git clone https://github.com/supabase/supabase
cd supabase/docker
cp .env.example .env
# Edit .env with your settings
docker compose up -d
Step 2 — Export existing Supabase data:

Bash

# Export from current Supabase project
supabase db dump -p your-password > aegiscare-backup.sql

# Import to new Kenya-hosted Supabase
psql -h your-kenya-server -U postgres -d postgres < aegiscare-backup.sql
Step 3 — Update environment variables:

text

VITE_SUPABASE_URL=https://your-kenya-server.com
VITE_SUPABASE_ANON_KEY=your-new-anon-key
## Pushing updates to a deployed facility

When the master repo gets updates:

```bash
# In the facility's forked repo
git remote add upstream https://github.com/fmurage6331-dev/confit-core
git fetch upstream
git merge upstream/main
git push origin main