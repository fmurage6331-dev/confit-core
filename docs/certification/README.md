# AegisCare HMS / LabTrack v5.5 — DHA Certification Pack

**Deliverables for DHA HIE certification submission (Form HMIS 4 pathway).**
Repository: `fmurage6331-dev/confit-core` · Supabase project: `tgynjasgnerucrlwedui`

## Documents (PDF + Markdown source)

| File | Document |
|---|---|
| `DOC-7-self-attestation-gap-analysis.pdf` | Self-Attestation Gap Analysis (10 sections; COMPLIANT / PARTIAL / GAP per DHA requirement) |
| `DOC-1-system-overview-architecture.pdf` | System Overview & Architecture Manual (schema, roles, workflows, integrations) |
| `DOC-6-security-policy.pdf` | Security Policy (auth, RBAC, RLS, audit, encryption, CVE fixes, incident response) |
| `DOC-5-fhir-integration.pdf` | FHIR Integration Documentation (R4 resources, queue, ICD-11, NLMIS) |
| `DOC-3-privacy-policy.pdf` | Privacy Policy (patient-facing + regulatory) |
| `DOC-4-backup-recovery-policy.pdf` | System Backup & Recovery Policy (RTO/RPO, migrations, cron jobs, DR) |
| `DOC-8-api-documentation.pdf` | API Documentation (edge functions, DHA APIs, DB functions, triggers) |
| `DOC-2-dpia.pdf` | Data Protection Impact Assessment (8 risks with mitigations) |

## Diagrams (PDF vector · PNG · SVG · Mermaid source)

| File | What it shows |
|---|---|
| `diagrams/aegiscare-schema-map.pdf/png/svg` + `schema-map.mmd` | 8-domain schema map with data-flow arrows (A3 landscape) |
| `diagrams/aegiscare-core-er.pdf/png/svg` + `schema-er.mmd` | Core clinical ER — 35 key tables with named foreign keys, trigger couplings (A3 landscape) |
| `diagrams/aegiscare-patient-flow.pdf/png/svg` + `patient-flow.mmd` | Patient journey: registration → triage → consultation → lab/radiology/pharmacy → billing/admission → signing → claims queue → external (A3 landscape) |

## Before submission — fill in these variables

| Variable | Where | Status |
|---|---|---|
| `FACILITY_NAME`, `FACILITY_ADDRESS`, `FACILITY_PHONE`, `FACILITY_EMAIL` | DOC-2, DOC-3, DOC-6, DOC-7 | 🔵 to confirm |
| `FACILITY_KMHFL_CODE`, `FACILITY_SHA_ID`, `FACILITY_SHA_PROVIDER_NO`, `FACILITY_LEVEL` | DOC-3, DOC-7 (also `app_settings` row `id='global'`) | 🔵 to confirm |
| `FACILITY_DEPLOYMENT_URL` | DOC-3 | 🔵 |
| `FACILITY_CLINICAL_RETENTION_YEARS` | DOC-3 §6, DOC-2 §4 risk 8 | 🔵 legal advice |
| `DPO_NAME`, `DPO_EMAIL`, `DPO_PHONE` | DOC-2 §6, DOC-3 §1/§10 | 🔵 pending appointment |
| `ODPC_REG_NO` | DOC-3 §1/§10 | 🔵 pending ODPC registration |
| Sign-off names/signatures | DOC-2 §6, DOC-4, DOC-6 approval tables | 🔵 |

## Known open items (see DOC-7 §10)

- All live integrations (DHA HIE, SHA, IPRS, HWR, SMS, WHO ICD-11 keys) are
  built and queued through `dha_outbound_queue` but **blocked on credentials** —
  activation steps: `docs/integration-activation-manual.md`.
- 13-chapter self-hosted transfer manual (DR runbook) — attach the handoff copy.
- DHA profile-level FHIR validation (`validator.fhir.org`) and Bundle builder —
  build gaps flagged in DOC-5 §1/§5 and DOC-7 §1.

*Packaged 2026-08-12 by the AegisCare development team.*
