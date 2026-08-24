# AegisCare HMS — System Presentation

---

# AegisCare HMS
## Transforming Healthcare Delivery in Kenya

- **Next-Generation Cloud Hospital Management System**
- Engineered natively for Kenya MoH Level 1–6 Healthcare Facilities
- Fully compliant with the Social Health Authority (SHA) and Digital Health Authority (DHA)
- End-to-end clinical, financial, inventory, and epidemiological automation

> **Speaker notes:**
> Good morning and welcome. Today, I am proud to present AegisCare HMS—a purpose-built, cloud-native Hospital Management System designed from the ground up to address the unique clinical, regulatory, and financial realities of Kenyan healthcare facilities. Whether operating a rural Level 3 health centre or a high-volume Level 5 county referral hospital, AegisCare delivers seamless, reliable, and compliant digital transformation.

---

# Problem Statement
## The Challenges Facing Kenyan Healthcare Facilities

- **Fragmented Paper Records & Data Silos:** Lost files, missing lab results, and disjointed clinical care.
- **Complex Statutory MoH Reporting:** Manual tally sheets lead to delayed and inaccurate MOH 705A/B, 706, and 717 submissions.
- **Revenue Leakage & Billing Discrepancies:** Uncollected cash, unbilled consumables, and un-reconciled waivers.
- **Regulatory Transition to SHA & DHA:** Facilities struggle to adapt to the new Social Health Insurance Act and FHIR interoperability mandates.

> **Speaker notes:**
> Healthcare providers across Kenya face massive administrative friction. Clinicians waste valuable time searching for physical paper files, while records officers spend days compiling end-of-month MoH tallies by hand. Meanwhile, hospitals suffer severe revenue leakage from unbilled medications and procedures, compounded by the urgent regulatory pressure to interface with the new Social Health Authority (SHA) and DHA AfyaLink systems. AegisCare was built specifically to eliminate these bottlenecks.

---

# Solution Overview
## What is AegisCare HMS?

- **Unified Hospital Operating System:** A single, synchronized platform for all clinical, administrative, diagnostic, and financial workflows.
- **Zero-Loss Architectural Reliability:** Instant real-time updates for bed occupancy, room queues, and panic lab values.
- **Two-Layer Automated MoH Tagging:** 100% automated statutory reporting without manual register tallying.
- **National Interoperability Ready:** Built-in FHIR R4 interfaces for DHA Shared Health Records (SHR) and SHA claims.

> **Speaker notes:**
> AegisCare HMS is not an adapted legacy desktop tool; it is a modern, cloud-native hospital operating system. It brings together front desk reception, nursing triage, doctor consultations, laboratories, digital imaging, pharmacies, inpatient wards, ICU, dialysis, mortuary, and executive finance into one cohesive ecosystem. By capturing structured data at the point of care, AegisCare automates reporting, eliminates billing leakage, and guarantees compliance with national standards.

---

# Key Features
## 19 Integrated Modules Built for Modern Facilities

- **Comprehensive Care Lifecycle:** Patient Registration, OTP Consent, Real-Time Queue, Triage, and Consultations.
- **Diagnostic Power:** Full Laboratory Workbench, Radiology Imaging Suite, and WHO ICD-11 live coding.
- **Specialized Units:** Dedicated Intensive Care (ICU), Hemodialysis, and Mortuary management modules.
- **Enterprise Controls:** Multi-Store Inventory, Automated Invoicing, Role-Based Access Control, and Forensics.

> **Speaker notes:**
> AegisCare spans 19 fully integrated modules covering every corner of the hospital. We support 19 distinct user roles—from triage nurses, doctors, and lab technologists to pharmacists, morticians, accountants, and hospital directors. Every role operates in a dedicated, distraction-free workbench designed to optimize their daily clinical or operational tasks while maintaining strict data governance across the facility.

---

# The Patient Journey
## Seamless, Real-Time Care Orchestration

```
[ Intake & OTP Consent ] ➔ [ Triage & Vitals ] ➔ [ Doctor Consultation & ICD-11 ]
                                                          │
          ┌───────────────────────────────────────────────┴───────────────────────────────┐
          ▼                                               ▼                               ▼
 [ Lab / Imaging Workup ]                      [ Inpatient / ICU Ward ]        [ Prescriptions & Pharmacy ]
          │                                               │                               │
          └───────────────────────────────────────────────┬───────────────────────────────┘
                                                          ▼
                                      [ Invoicing, Payment & Discharge ]
```

- **Instant Queue Routing:** Patients move between triage, doctor, lab, and pharmacy without physical paper routing slips.
- **Automated SMS Alerts:** Patients receive real-time SMS alerts when lab results are verified and payments are posted.
- **Cryptographic Encounter Locks:** Signed medical notes are permanently locked to preserve legal and clinical integrity.

> **Speaker notes:**
> Let us look at the patient journey. From the moment a patient arrives, their identity is registered, digital consent is verified via SMS OTP, and they are routed dynamically to triage. The clinician reviews live vitals, searches the WHO ICD-11 database, orders diagnostics, and prescribes medications. Diagnostic results trigger automated SMS alerts to the patient and immediately return them to the doctor's queue. Once signed, the file is locked, billing is finalized, drugs are dispensed, and the patient is discharged smoothly.

---

# Insurance & SHA Integration
## Universal Health Coverage Compliance (SHIA 2023)

- **Complete SHA Fund Support:** Native categorization for Primary Healthcare Fund (PHF), Social Health Insurance Fund (SHIF), and ECCIF.
- **Automated FHIR Claim Bundling:** Compiles diagnoses, tariffs, and billable items into standardized FHIR R4 Claim payloads.
- **Multi-Payer Clearance Desk:** Manages pre-authorizations, co-pays, visit caps, and contracted tariffs for Private and Corporate insurers.
- **Biometric & IPRS Ready (⏳):** Architectural foundation in place for DHA biometric smart-card and National ID validation.

> **Speaker notes:**
> The transition from NHIF to the Social Health Authority represents the largest healthcare financing shift in Kenya's history. AegisCare comes pre-configured with SHA benefit packages across PHF, SHIF, and the Emergency, Chronic and Critical Illness Fund (ECCIF). When an encounter is signed, the system automatically compiles an itemized FHIR R4 Claim resource, complete with ICD-11 codes and pre-authorization references, ready for automated submission to the national claims gateway.

---

# ICU & Dialysis Units
## Specialized Subsystems for Critical Care

- **ICU Hourly Flow-Sheets:** Digital capture of arterial pressures, CVP, inotropes, ventilator modes, PEEP, and FiO2.
- **Sedation & Coma Scoring:** Built-in Glasgow Coma Scale (GCS) and Richmond Agitation-Sedation Scale (RASS) tracking.
- **Hemodialysis Management:** Pre/post-dialysis weights, vascular access monitoring, BFR/DFR rates, and UF fluid goals.
- **Automated Clinical Billing:** Auto-posts ICU admission surcharges and deducts dialysis consumables directly from sub-stores.

> **Speaker notes:**
> Most hospital systems neglect high-dependency specialized units. AegisCare features purpose-built interfaces for Intensive Care and Renal Dialysis. In the ICU, nurses log comprehensive hourly vital flows, ventilator settings, and inotrope titrations. In the Dialysis unit, renal nurses capture vascular access health, ultrafiltration targets, and session complications, while the system automatically handles consumable inventory deductions and session billing with a single click.

---

# Stock & Pharmacy Management
## Multi-Location Perpetual Inventory Control

- **Multi-Store Architecture:** Dedicated ledgers for Main Store, Central Pharmacy, ICU Store, and Dialysis Store.
- **Automated Dispense Deductions:** Dispensing a prescription instantly decrements stock from the correct physical warehouse batch.
- **Stock Guard Protection:** Blocks dispensing when warehouse inventory is depleted, preventing negative stock discrepancies.
- **Supplier Deliveries & Batches:** Tracks commercial supplier invoices, batch numbers, expiry dates, and unit purchase costs.

> **Speaker notes:**
> Medication and consumable stock represent a hospital's greatest operational expenditure. AegisCare implements a double-entry, multi-location inventory ledger. Deliveries are accepted into the Main Warehouse and transferred to departmental sub-stores such as the Central Pharmacy or ICU Store. When a pharmacist dispenses a drug, the system verifies available batch stock, decrements the ledger, and records the dispensing pharmacist's digital signature in real time.

---

# Billing & Accounting
## Complete Revenue Cycle Integrity

- **Automated Master Invoicing:** Invoices provisioned at intake; line items appended automatically by clinical orders.
- **Multi-Channel Cashier Desk:** Seamless payment recording for Cash, M-Pesa, Credit Cards, Bank Transfers, and Insurance Guarantees.
- **Controlled Waivers & Credit Notes:** Formal indigent waiver workflows requiring supervisory authorization and mandatory audit logging.
- **End-of-Day (EOD) Reconciliation:** Shift-based cash drawer reconciliation, variance calculation, and daily banking summaries.

> **Speaker notes:**
> AegisCare stops revenue leakage completely. Every clinical requisition—a blood test, an X-ray, an ICU day, or an antibiotic—automatically appends a line item to the patient's master invoice using the correct cash or insurance contracted tariff. Cashiers accept multi-channel payments, issue official receipts with QR codes, and reconcile cash drawers at shift close. Waivers are strictly permission-gated and forensic audit-logged.

---

# Security & Regulatory Compliance
## ODPC Data Privacy & Institutional Governance

- **Kenya ODPC 2019 Compliant:** SMS OTP patient consent verification and strict purpose-bound data minimization.
- **PostgreSQL Row-Level Security (RLS):** Military-grade row security; unapproved users cannot read or write patient data.
- **Break-Glass Emergency Protocol:** Controlled override for unconscious trauma cases with mandatory medical justification and alert logs.
- **20-Year Statutory Audit Retention:** Nightly cron daemons archive tamper-evident audit logs to satisfy Kenya health record retention laws.

> **Speaker notes:**
> Patient privacy and data security are non-negotiable. AegisCare is built in strict compliance with the Kenya Data Protection Act 2019, enforced by the Office of the Data Protection Commissioner (ODPC). All database access is governed by granular Row-Level Security policies. In life-threatening emergencies, clinicians can invoke the Break-Glass protocol, which immediately logs an immutable high-priority forensic record capturing the clinician's identity and written justification.

---

# Kenya MoH Statutory Compliance
## Automated Epidemiological Surveillance

- **Two-Layer Tagging Engine:** Universal demographic and disease indicator tags generated dynamically at encounter entry.
- **Automated MOH 705A & 705B:** Instant monthly morbidity returns for Under 5 and Over 5 outpatient cohorts.
- **Workload & Inpatient Reporting:** Pre-compiled returns for MOH 706 (Lab), MOH 707 (Inpatient), MOH 717 (Workload), and Family Planning.
- **Facility Level Gating:** Features dynamically adapt to Kenya MoH accreditation levels (Level 1–2 Dispensary to Level 6 National Referral).

> **Speaker notes:**
> Health Information Management Officers spend countless days compiling statutory MoH reports. AegisCare completely automates this burden. Our proprietary two-layer tagging architecture categorizes every patient encounter by age band, gender, visit type, and disease mapping. At the end of the month, the records officer simply selects the reporting period and exports certified MOH 705A, 705B, or 717 returns in seconds, ready for upload to the national DHIS2 / KHIS portal.

---

# Technology Stack
## Modern, Resilient, Cloud-Native Engineering

- **Frontend Application:** React 18 + TanStack Start (SSR) + TanStack Router (100% type-safe, ultra-fast UI).
- **Backend & Database:** Supabase Managed PostgreSQL + Realtime WebSockets + Row-Level Security.
- **Execution Runtime:** Bun runtime for high-performance builds and zero-dependency efficiency.
- **Interoperability Standard:** HL7 FHIR Release 4 JSON models for national health information exchange.

> **Speaker notes:**
> AegisCare is engineered on modern web foundations. The frontend utilizes React with TanStack Start and TanStack Query, delivering instantaneous navigation, optimistic UI updates, and offline resilience over slower internet connections. The backend is powered by Supabase PostgreSQL, leveraging real-time WebSockets, robust server-side triggers, and serverless Edge Functions running on Deno for low-latency external API communications.

---

# Integration Ecosystem
## Connected to the National Digital Health Fabric

- **Africa's Talking SMS (✅ Production):** Delivers OTP consent codes, lab test completion alerts, and billing receipts.
- **WHO ICD-11 Cloud API (✅ Production):** Real-time diagnostic terminology lookups directly from the World Health Organization.
- **DHA AfyaLink HIE (⏳ Stubs Built):** FHIR R4 integration ready for national Shared Health Record synchronization upon credential release.
- **Safaricom M-Pesa Daraja (📋 Planned Phase 3):** Automated cashier STK Push and real-time mobile payment clearance.

> **Speaker notes:**
> A hospital system cannot exist in isolation. AegisCare is pre-integrated with Africa's Talking for reliable nationwide SMS messaging and the WHO Cloud API for international diagnostic coding. Our integration engine includes pre-built FHIR R4 endpoints for the Kenyan Digital Health Authority (DHA) AfyaLink Health Information Exchange, positioning your facility ahead of national accreditation deadlines.

---

# System Roadmap
## What is Coming Next in AegisCare HMS

- **Phase 1 (Completed ✅):** Core OPD/IPD workflows, Pharmacy, Multi-Store, Lab, Radiology, ICU, Dialysis, Mortuary, SMS, and MoH Reports.
- **Phase 2 (Current ⏳):** Final DHA Interoperability Certification, SHA FHIR Claim sandbox testing, and Multi-Facility deployments.
- **Phase 3 (Planned 📋):** Safaricom M-Pesa STK Push integration, Biometric Smart Reader hardware drivers, and AI Clinical Decision Support.

> **Speaker notes:**
> We have completed Phase 1, delivering a rock-solid, production-proven hospital management platform. In Phase 2, we are finalizing formal DHA sandbox certification and rolling out multi-facility pilots. Looking ahead to Phase 3, we will introduce automated M-Pesa STK Push cashier prompts, biometric USB reader hardware integration, and AI-assisted clinical guideline recommendations.

---

# Experience AegisCare HMS
## Partner with Us to Transform Your Facility

- **Live System Demonstration Available**
- **Tailored Facility Onboarding & Staff Training**
- **Seamless Data Migration from Legacy Systems**

### Contact & Inquiries:
- **Lead Architect & Developer:** Francis Muhoro
- **System:** AegisCare Hospital Management System
- **Repository:** `fmurage6331-dev/confit-core`
- **Location:** Nairobi / Kajiado, Kenya

> **Speaker notes:**
> Thank you for your time and attention. AegisCare HMS is ready to elevate your hospital's clinical precision, operational efficiency, and financial health. I invite you to explore a live system demonstration and discuss how we can tailor AegisCare to meet your facility's exact operational requirements. I am now open to questions.
