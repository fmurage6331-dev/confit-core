# AegisCare HMS — System Dictionary & Glossary

**Document Version:** 1.0.0  
**Target Architecture:** Kenya MoH Level 1–6 Facilities  
**Classification:** Reference Manual & System Lexicon  

---

## Introduction

This glossary provides authoritative definitions, operational context, and architectural mappings for all clinical, business, technical, system, and regulatory terms utilized across the **AegisCare Hospital Management System (HMS)**.

---

## A

### Accountant
**Category:** System / Role  
**Definition:** A system user role assigned to financial officers responsible for handling invoicing, collecting and allocating payments (cash, mobile money, cards), applying manager-approved waivers, issuing credit notes, and executing End-of-Day (EOD) financial reconciliation.  
**Used in:** Billing & Accounting Module, Invoices (`invoices`, `invoice_payments`, `user_roles`)

### Accounting
**Category:** System / Permission  
**Definition:** A granular role permission (`accounting`) that grants authorized staff write access to invoice balance mutations, manual line-item price overrides, and cash collection ledger entries.  
**Used in:** `role_permissions`, Billing & Accounting UI (`/accounting`, `/invoices/$id`)

### Admission
**Category:** Clinical  
**Definition:** The formal clinical and administrative process of admitting an outpatient or emergency patient into an inpatient ward bed (General, Maternity, Pediatric, Surgical, ICU, or HDU) for continuous overnight monitoring, nursing care, and treatment.  
**Used in:** Inpatient Module, Wards Management, Consultation (`admissions`, `beds`, `wards`, `encounters`)

### Admission Fee (ICU)
**Category:** Business / System  
**Definition:** A one-time standard institutional surcharge automatically applied to an inpatient invoice upon admission to an Intensive Care Unit ward, covering specialized sterile isolation and equipment staging.  
**Used in:** Inpatient / ICU Admission Flow, Billing (`charge_icu_admission_fee` RPC, `invoice_line_items`)

### Africa's Talking (AT)
**Category:** Kenya-specific / Technical  
**Definition:** A pan-African telecommunications API platform utilized by AegisCare for automated real-time SMS dispatch, specifically sending patient OTP consent codes, lab test completion alerts, and billing receipts formatted to Kenyan phone numbers (`+254...`).  
**Used in:** Edge Function `send-sms`, Patient Registration, Laboratory Result Verification

### AfyaLink HIE
**Category:** Kenya-specific / Technical  
**Definition:** The Kenyan Digital Health Authority (DHA) National Health Information Exchange platform enabling standardized inter-facility clinical data sharing and centralized health registries via FHIR R4 APIs.  
**Used in:** Integration Module, FHIR Synchronization Queue (`dha_outbound_queue`, Edge Function `fhir-bundle`)

### Age Band
**Category:** Clinical / Kenya-specific  
**Definition:** MoH standardized age stratification groups (Under 5 years, 5–59 years, 60+ years) used for epidemiological disease tracking, clinical triage workflows, and statutory MOH 705A/B reporting.  
**Used in:** Triage, Dashboard Analytics, MOH Reports (`tag_encounter_demographics`, `moh_705_disease_mappings`)

### Alert & Notification System
**Category:** System  
**Definition:** Automated in-app and SMS alerting mechanisms that notify clinical staff of critical laboratory panic values, out-of-range vital signs, or impending drug stock depletion.  
**Used in:** Laboratory (`laboratory.$id.tsx`), Triage, Ward Monitoring, Stock Management

### Admin
**Category:** System / Role  
**Definition:** System administrative user possessing full institutional permissions to manage hospital metadata, staff user profiles, role assignments, department room rosters, ward beds, medical machines, and facility billing tariffs.  
**Used in:** Admin Module (`/admin/*`, `user_roles`, `role_permissions`)

### Anuria / Oliguria
**Category:** Clinical  
**Definition:** Critical indicators of renal failure where urine output is severely suppressed or absent (<100 mL/24h for anuria; <400 mL/24h for oliguria), tracked during ICU hourly monitoring and Hemodialysis fluid balance assessments.  
**Used in:** ICU Hourly Charting, Dialysis Module (`icu_hourly_charts`, `dialysis_sessions`)

### Appointment
**Category:** Clinical / System  
**Definition:** A scheduled forward booking for a patient with a specific clinician, specialized clinic (e.g., MCH, SOPC, GOPC, Dental), or diagnostic service room, which can be seamlessly converted into an active clinical encounter upon patient arrival.  
**Used in:** Appointments Module (`appointments`, `create_encounter_from_appointment` RPC)

### App Settings
**Category:** Technical / System  
**Definition:** The centralized global configuration repository stored in Supabase storing facility identity (KMHFL code, SHA ID, facility level, contact info) and operational switches.  
**Used in:** Database Table `app_settings`, System Configuration (`/admin/settings`)

### Audit Log
**Category:** Technical / System  
**Definition:** An immutable, append-only security log tracking every database insert, update, delete, login, and elevated data access event with cryptographic user ID, table name, record identifier, timestamps, and previous/new state JSON payloads.  
**Used in:** Security Module, Compliance Audits (`audit_log`, `audit_trigger_fn`)

### Audit Log Archive
**Category:** Technical / System  
**Definition:** A secondary long-term storage table where audit log entries older than two years are transferred via automated nightly cron jobs to comply with the 20-year Kenya Data Protection Act statutory retention period without degrading primary transactional query performance.  
**Used in:** `audit_log_archive`, `audit_archive_runs`, `archive_old_audit_logs()` RPC

### Auto-Generated SHA Claim
**Category:** Business / System  
**Definition:** An automated database-driven procedure triggered upon encounter signing or invoice closure for SHA-registered patients that compiles encounter diagnoses, billable items, and clinical notes into a standardized SHA claim and FHIR claim bundle.  
**Used in:** Insurance Desk, Claims Dispatcher (`sha_claims`, `auto_generate_sha_claim()` trigger)

---

## B

### Bed
**Category:** System / Clinical  
**Definition:** A uniquely identified physical sleeping/care unit within a hospital ward or room, maintaining real-time occupancy state (`available`, `occupied`, `maintenance`, `cleaning`) and linked to admitted patients.  
**Used in:** Inpatient Module, Wards Management (`beds`, `admissions`)

### Bed Day
**Category:** Business / System  
**Definition:** A standard hospital billing unit representing 24 hours of inpatient ward occupancy, charged automatically on a daily schedule based on the assigned ward rate.  
**Used in:** Inpatient Billing, `accrue_daily_bed_charges()` RPC, `invoice_line_items`

### Biometric Verification
**Category:** Kenya-specific / Business  
**Definition:** The planned integration with DHA/SHA biometric smart card readers and fingerprint scanners to verify patient identity and SHA benefit eligibility at the registration desk prior to service delivery.  
**Used in:** Patient Registration, Insurance Desk (`patients.biometric_verified`, ⏳ Phase 3 DHA Integration)

### Break Glass Access
**Category:** System / Security  
**Definition:** An emergency security protocol allowing clinicians to bypass standard consent or privacy barriers to immediately view a patient's electronic health record during life-threatening emergencies. Every break-glass activation mandates a documented clinical justification and immediately creates an immutable `BREAK_GLASS` high-priority audit record.  
**Used in:** Consultation, Patient History (`log_break_glass_access` RPC, `audit_log`)

### Bun
**Category:** Technical  
**Definition:** An ultra-fast, modern JavaScript/TypeScript runtime, bundler, and package manager used for local development, fast build tooling, and test execution within the AegisCare software engineering workflow.  
**Used in:** System Infrastructure, `bun.lock`, Dev Server Runtime

---

## C

### Cash Payment Mode
**Category:** Business  
**Definition:** The direct self-pay workflow where a patient pays out-of-pocket for consultations, laboratory diagnostics, radiology, procedures, and dispensed pharmaceuticals before or immediately after service rendering.  
**Used in:** Patient Registration, Billing & Accounting (`encounters.payment_mode = 'cash'`, `invoice_payments`)

### Claims Dispatcher
**Category:** Technical / Business  
**Definition:** A serverless Supabase Edge Function that routes completed medical insurance claims and FHIR bundles to their respective external clearinghouses (SHA HIE, private insurance gateways, or local archival queues) based on the encounter payer configuration.  
**Used in:** Supabase Edge Function `claims-dispatcher`, Insurance Module, `dha_outbound_queue`

### Clearance (Insurance Clearance)
**Category:** Business / System  
**Definition:** The administrative authorization process executed by the Insurance Desk prior to triage or consultation, validating policy active status, pre-authorization approval, member validity, and copay requirements.  
**Used in:** Insurance Desk (`/admin/insurance`, `encounters.insurance_status`)

### Clinical Notes
**Category:** Clinical  
**Definition:** Structured clinical documentation entered by healthcare providers encompassing Chief Complaints, History of Presenting Illness (HPI), Review of Systems (ROS), Physical Examination, Clinical Impressions, and Treatment Plans.  
**Used in:** Consultation / Clinical Module (`clinical_notes`, `rooms.$id.tsx`)

### Clinical Officer
**Category:** System / Role  
**Definition:** A licensed healthcare practitioner registered under the Clinical Officers Council (COC) of Kenya authorized to examine outpatients and inpatients, formulate ICD-11 diagnoses, prescribe pharmaceuticals, request diagnostic workups, perform medical procedures, and sign clinical encounters.  
**Used in:** Consultation, Inpatient, Triage (`user_roles`, `clinical_notes`, `encounter_diagnoses`)

### Consultation
**Category:** Clinical  
**Definition:** The core clinical encounter stage where a clinician (Doctor, Clinical Officer, or Specialist) reviews patient history, examines the patient, documents findings, assigns diagnoses, and initiates diagnostic orders, medications, or ward admissions.  
**Used in:** Consultation Module (`rooms.$id.tsx`, `clinical_notes`)

### Contracted Price / Tariff
**Category:** Business / System  
**Definition:** A pre-negotiated fee schedule agreed upon between the healthcare facility and specific insurance underwriters (e.g., SHA, Jubilee, Britam, CIC), overriding baseline cash prices for consultations, bed stays, procedures, and tests.  
**Used in:** Billing Engine, Insurance Pricing (`insurance_contracted_prices`, `get_contracted_price()` RPC)

### Copay
**Category:** Business  
**Definition:** A fixed out-of-pocket sum or percentage required by an insurer to be paid directly by the insured patient before accessing covered outpatient consultations or specialized procedures.  
**Used in:** Insurance Desk, Cash Office (`encounters.copay_amount`, `invoices`)

### Cron Job (pg_cron)
**Category:** Technical  
**Definition:** Background scheduled jobs executed automatically within the Supabase Postgres database engine at precise intervals (e.g., nightly at 02:00 EAT) to accrue daily bed, ICU, and mortuary charges, and archive stale audit trails.  
**Used in:** Database Infrastructure (`pg_cron`, `supabase/migrations/*_cron.sql`)

---

## D

### Daily Charge (Bed / ICU / Mortuary)
**Category:** Business / System  
**Definition:** Automated fee accrual calculated daily for active inpatient beds, intensive care ward stays, and mortuary cold-storage slots until formal clinical discharge or physical release.  
**Used in:** Inpatient, ICU, Mortuary Billing (`accrue_daily_bed_charges()`, `accrue_daily_mortuary_charges()`)

### Delivery (Stock Delivery)
**Category:** System / Business  
**Definition:** The formal receiving and warehouse logging of pharmaceutical drugs, clinical supplies, and general consumables from external suppliers, increasing current inventory quantities and recording purchase batch numbers and expiry dates.  
**Used in:** Stock Module, Pharmacy (`stock_deliveries`, `stock_movements`, `delivery_to_stock()` RPC)

### Deliveries
**Category:** System / Permission  
**Definition:** A specialized permission (`deliveries`) allowing storekeepers and pharmacy personnel to accept, inspect, and book commercial supplier deliveries into the main warehouse stock ledger.  
**Used in:** `role_permissions`, Stock Management (`/deliveries`)

### Dental Officer
**Category:** System / Role  
**Definition:** A licensed dental surgeon or dental clinical officer authorized to examine oral cavity pathology, perform dental extractions and restorative procedures, prescribe medications, and sign specialized dental encounters.  
**Used in:** Dental Clinic Room (`user_roles`, `encounters`, `prescriptions`)

### DHA (Digital Health Authority)
**Category:** Kenya-specific  
**Definition:** The state corporation established under the Kenya Digital Health Act, 2023, mandated to establish, maintain, and regulate national digital health infrastructure, health data standards, health information exchanges (HIE), and system certifications.  
**Used in:** Regulatory Compliance, DHA Compliance Suite, FHIR Interfaces

### DHA Outbound Queue
**Category:** Technical / System  
**Definition:** An asynchronous database transactional message queue storing outgoing FHIR bundles and insurance claims destined for DHA AfyaLink HIE and SHA servers with automatic retry, backoff, and logging semantics.  
**Used in:** System Core, `dha_outbound_queue`, Edge Function `claims-dispatcher`

### Dialysis Nurse
**Category:** System / Role  
**Definition:** A specialized registered renal nurse authorized to initiate, monitor, and document hemodialysis sessions, capture ultrafiltration volumes and vitals, log vascular access status, record complications, and dispense dialysis consumables.  
**Used in:** Dialysis Unit (`rooms.$id.tsx`, `dialysis_sessions`, `dialysis_session_consumables`)

### Dialysis Session
**Category:** Clinical / System  
**Definition:** A structured clinical record capturing a complete hemodialysis treatment run, including dialyzer model, blood flow rate (BFR), dialysate flow rate (DFR), pre/post-dialysis blood pressure, weight changes, fluid removal goals (UF), and anticoagulant dosages.  
**Used in:** Dialysis Unit Room (`dialysis_sessions`, `process_dialysis_session_billing()` RPC)

### Dialysis Store
**Category:** System / Stock  
**Definition:** A dedicated sub-inventory location (`d38d45c7-20f2-4e1b-9279-8cb5bf567cd1`) housing specialized renal consumables such as dialyzers, bloodlines, AV fistula needles, bicarbonate cartridges, acid concentrates, and heparin.  
**Used in:** Stock Management, Dialysis Billing (`stock_locations`, `stock_items`)

### Differential Diagnosis
**Category:** Clinical  
**Definition:** A list of alternative potential diseases or conditions considered by a clinician during the diagnostic evaluation process before reaching a confirmed or working diagnosis.  
**Used in:** Consultation Module (`encounter_diagnoses.diagnosis_type = 'differential'`)

### Director
**Category:** System / Role  
**Definition:** Executive management persona possessing read-only executive visibility across all institutional dashboards, financial aggregations, MoH disease reports, clinical throughput metrics, and system audit logs.  
**Used in:** Executive Dashboard, Reports (`/dashboard`, `/reports`, `user_roles`)

### Discharge
**Category:** Clinical  
**Definition:** The clinical and administrative conclusion of an inpatient hospital stay, requiring a verified discharge summary, reconciled pharmacy discharge medications, completed final invoice clearance, and bed status reset.  
**Used in:** Inpatient Module (`admissions.status = 'discharged'`, `beds.status = 'available'`)

### Discharge Summary
**Category:** Clinical / System  
**Definition:** A mandatory clinical summary document authored by the attending medical officer at the conclusion of an inpatient admission, detailing admission reasons, significant findings, therapeutic procedures performed, discharge condition, and follow-up instructions.  
**Used in:** Inpatient Module (`admissions.discharge_summary`, `require_discharge_summary` trigger)

### Doctor
**Category:** System / Role  
**Definition:** A licensed Medical Practitioner (Medical Officer, Physician, Surgeon, or Specialist) registered with the KMPDC authorized to conduct clinical evaluations, perform invasive surgical procedures, order and interpret complex diagnostics, prescribe all drug schedules, admit/discharge inpatients, and electronically sign encounters.  
**Used in:** Clinical Consultation, Wards, ICU, Theatre (`user_roles`, `clinical_notes`, `encounters`)

### Drug Formulation & Route
**Category:** Clinical / Pharmacy  
**Definition:** The physical form (e.g., tablet, suspension, vial, ampoule, cream) and pharmaceutical route of administration (e.g., Oral, IV, IM, SC, Topical, Inhalation) specified on clinical prescriptions.  
**Used in:** Pharmacy Module, Inpatient Medication Administration (`prescriptions`, `medication_administrations`)

---

## E

### ECCIF (Emergency, Chronic and Critical Illness Fund)
**Category:** Kenya-specific / Business  
**Definition:** A dedicated universal healthcare statutory fund established under the Social Health Insurance Act (SHIA) of Kenya, designed to cover emergency treatments, intensive care stays, and severe chronic condition interventions beyond basic primary care thresholds.  
**Used in:** Insurance Desk, Billing, SHA Benefit Plans (`insurance_benefit_categories`, `sha_claims`)

### Edge Function
**Category:** Technical  
**Definition:** A serverless TypeScript/Deno computational module running on Supabase's globally distributed network, used in AegisCare for low-latency operations such as SMS messaging, external WHO ICD-11 lookups, and DHA FHIR payload compilation.  
**Used in:** `supabase/functions/*` (`send-sms`, `icd11-search`, `claims-dispatcher`, `fhir-bundle`)

### Emergency Encounter
**Category:** Clinical / System  
**Definition:** An urgent clinical registration pathway that allows patients in acute distress to bypass normal intake queues and cash payment checks, routing them immediately to the resuscitation room or casualty doctor.  
**Used in:** Patient Registration, Triage, Casualty (`encounters.is_emergency = true`, `encounters.encounter_type = 'emergency'`)

### Emergency Referral
**Category:** Clinical / MOH  
**Definition:** The formal transfer of an unstable emergency patient to a higher-level facility (referral out) or receipt of an acute case from a lower-tier dispensary/health centre (referral in), logged for epidemiological MOH 717 reporting.  
**Used in:** Patient Registration, Consultation, MOH Reporting (`encounters.referral_direction`, `dashboard_emergency_referrals()`)

### Encounter (Patient Registration)
**Category:** Clinical / System  
**Definition:** A single, discrete interaction episode between a patient and healthcare service providers spanning registration, triage, consultation, laboratory tests, radiology imaging, pharmaceutical dispensing, and discharge.  
**Used in:** Database Table `encounters` (aliased as `patient_registrations`), Throughout All Clinical Modules

### Encounter Diagnosis
**Category:** Clinical  
**Definition:** A formal diagnostic condition code linked to a specific encounter, mapped to WHO ICD-11 MMS nomenclature, tagged by sequence (Primary, Secondary, Comorbidity), and categorized by clinical certainty.  
**Used in:** Consultation, Inpatient, SHA Claims (`encounter_diagnoses`, `clean_and_validate_diagnosis_insert()`)

### Encounter Lock / Signing
**Category:** System / Clinical  
**Definition:** An irreversible cryptographic state change executed by authorized clinicians upon completing an encounter (`status = 'signed'`), locking all clinical notes, diagnoses, and orders against further mutation to comply with legal evidentiary and DHA certification standards.  
**Used in:** Consultation, Inpatient (`enforce_encounter_lock()` trigger, `sprint13a_encounter_signing.sql`)

### Episode of Care
**Category:** Technical / Clinical  
**Definition:** A longitudinal FHIR resource and clinical container (`episode_of_care`) that groups related healthcare encounters and clinical events managed under a single continuous management plan or disease condition over time.  
**Used in:** FHIR Interoperability, Chronic Disease Tracking (`episode_of_care`, Edge Function `fhir-bundle`)

### External Body (Mortuary)
**Category:** Clinical / System  
**Definition:** A deceased individual brought to the hospital mortuary directly from outside the institution (e.g., police case, home death, roadside accident) rather than passing away while admitted in an internal hospital ward, requiring specific legal documentation, next-of-kin verification, and dedicated cash billing invoicing.  
**Used in:** Mortuary Module (`mortuary_records.body_source = 'external'`, `create_external_mortuary_invoice()` RPC)

---

## F

### Facility Level (Kenya MoH Level 1–6)
**Category:** Kenya-specific / System  
**Definition:** The official Kenya Ministry of Health healthcare facility grading system dictating operational scope and service availability:
- **Level 1:** Community Health Unit (Community Health Promoters)
- **Level 2:** Dispensary (Outpatient primary care)
- **Level 3 (3A/3B):** Health Centre (Outpatient + Basic Maternity; no full wards or mortuary)
- **Level 4:** Primary Hospital / Sub-County (Full inpatient, surgical theatre, mortuary, basic imaging)
- **Level 5:** Secondary / County Referral Hospital (Specialized care, ICU, Dialysis, advanced diagnostics)
- **Level 6:** National Referral & Teaching Hospital (Tertiary & quaternary sub-specialties)  
**Used in:** Facility Settings, Feature Gating (`facility_features`, `app_settings.facility_level`)

### Facility Features
**Category:** System  
**Definition:** System configuration flags that dynamically enable or lock entire application modules (e.g., Mortuary, ICU, Dialysis, Inpatient Wards) based on the accredited MoH Level of the host facility.  
**Used in:** `facility_features`, UI Dynamic Navigation

### FHIR (Fast Healthcare Interoperability Resources - R4)
**Category:** Technical  
**Definition:** The international HL7 standard framework for structuring and exchanging electronic health information via RESTful JSON APIs, mandated by Kenya's DHA for national interoperability.  
**Used in:** DHA/SHA Integration, Edge Functions `fhir-patient`, `fhir-encounter`, `fhir-condition`, `fhir-bundle`

### FHIR Bundle
**Category:** Technical  
**Definition:** A single cohesive JSON container collecting multiple related FHIR resources (Patient, Encounter, Condition, MedicationDispense, Observation, Claim) transmitted as a batch or transaction to the DHA Shared Health Record (SHR).  
**Used in:** Edge Function `fhir-bundle`, `dha_outbound_queue`

### FHIR Condition
**Category:** Technical  
**Definition:** A standardized FHIR R4 resource representing clinical diagnoses, complaints, and comorbidities mapped directly to WHO ICD-11 MMS URIs and concept codes.  
**Used in:** Edge Function `fhir-condition`, Consultation Sync

### FHIR Encounter
**Category:** Technical  
**Definition:** A standardized FHIR R4 resource detailing patient arrival, service class (Ambulatory, Inpatient, Emergency), service provider organization, attending practitioner, and clinical duration.  
**Used in:** Edge Function `fhir-encounter`, `generate_fhir_encounter()` RPC

### FHIR Patient
**Category:** Technical  
**Definition:** A standardized FHIR R4 resource representing demographic and administrative patient identity attributes (official identifiers, full names, gender, date of birth, contact telecom, and residence address).  
**Used in:** Edge Function `fhir-patient`, Patient Registration Sync

### Final Diagnosis
**Category:** Clinical  
**Definition:** The conclusive diagnostic determination established by the attending medical officer after evaluating all physical findings, laboratory workups, and radiological imaging results.  
**Used in:** Consultation, Inpatient Discharge (`encounter_diagnoses.diagnosis_type = 'final'`)

### Form 705A (Under 5 Outpatient)
**Category:** Kenya-specific / MOH  
**Definition:** The official statutory Ministry of Health monthly epidemiological surveillance report capturing outpatient morbidity patterns for children aged under five years across standard disease classifications.  
**Used in:** MOH Reporting Module (`/moh/705`, `get_moh_705_report(..., '705A')` RPC)

### Form 705B (Over 5 Outpatient)
**Category:** Kenya-specific / MOH  
**Definition:** The official statutory Ministry of Health monthly epidemiological summary documenting outpatient morbidity for patients aged five years and above.  
**Used in:** MOH Reporting Module (`/moh/705`, `get_moh_705_report(..., '705B')` RPC)

### Form 706 (Laboratory Monthly Summary)
**Category:** Kenya-specific / MOH  
**Definition:** The standard MoH statutory reporting template summarizing aggregate laboratory diagnostic tests performed (malaria smears, HIV testing, urinalysis, full hemogram, lipid profiles) categorized by clinical outcome.  
**Used in:** MOH Reporting Module (`/moh/706`, `moh_indicator_definitions`)

### Form 707 (Inpatient Monthly Summary)
**Category:** Kenya-specific / MOH  
**Definition:** The statutory MoH monthly report tracking inpatient admissions, bed occupancy rates, average length of stay (ALOS), maternal/neonatal outcomes, surgical interventions, and inpatient mortality.  
**Used in:** MOH Reporting Module (`/moh/707`, `refresh_moh_707_monthly_aggregates()`)

### Form 717 (Hospital Workload Summary)
**Category:** Kenya-specific / MOH  
**Definition:** The comprehensive institutional workload return capturing aggregate monthly throughput across general outpatient clinics, specialized clinics, casualty visits, dental attendances, imaging procedures, and mortuary storage days.  
**Used in:** MOH Reporting Module (`/moh/717`)

### FP (Family Planning) Indicators
**Category:** Kenya-specific / MOH  
**Definition:** Standardized reproductive health metrics tracking client intake and dispensing of contraceptive modalities (Implants, Oral Pills, Injectable Depo-Provera, IUCDs, Emergency Contraceptives, and Condoms).  
**Used in:** MOH FP Report (`/moh/fp`, `moh_indicator_definitions`)

---

## G

### Glasgow Coma Scale (GCS)
**Category:** Clinical  
**Definition:** An objective neurological scoring scale (ranging from 3 to 15) assessing acute levels of consciousness based on Eye Opening (1–4), Verbal Response (1–5), and Motor Response (1–6).  
**Used in:** Triage, Casualty, ICU Hourly Charting (`icu_hourly_charts.gcs_total`, Triage Vitals)

### Grant Stock Location Access
**Category:** System / Permission  
**Definition:** An administrative function granting specific warehouse sub-store access privileges (`allow_view`, `allow_request`, `allow_approve`, `allow_issue`, `allow_receive`) to designated staff users.  
**Used in:** Stock Security (`grant_stock_location_access()` RPC, `user_stock_location_access`)

---

## H

### HIE (Health Information Exchange)
**Category:** Kenya-specific / Technical  
**Definition:** The national digital health network managed by the DHA that enables electronic medical record systems nationwide to exchange standardized FHIR clinical documents securely.  
**Used in:** System Architecture, DHA Outbound Queue

### HTS (HIV Testing Services) Counsellor
**Category:** System / Role  
**Definition:** A certified healthcare worker dedicated to conducting pre-test counseling, point-of-care rapid HIV screening, post-test counseling, and linkage of reactive clients to Comprehensive Care Centres (CCC).  
**Used in:** VCT / HTS Clinic (`user_roles`, `encounters`)

---

## I

### ICD-11 (International Classification of Diseases 11th Revision)
**Category:** Clinical / Technical  
**Definition:** The World Health Organization's global clinical classification standard for systematic recording, reporting, analysis, and comparison of mortality and morbidity data, natively embedded into AegisCare.  
**Used in:** Consultation, Inpatient, Edge Function `icd11-search`, `icd11_codes`

### ICD-11 MMS (Mortality and Morbidity Statistics)
**Category:** Clinical / Technical  
**Definition:** The specific WHO linearization of ICD-11 curated for general clinical coding and health statistics reporting, queried in real time via WHO's cloud API.  
**Used in:** Consultation Coding, Edge Function `icd11-search`

### ICU (Intensive Care Unit)
**Category:** Clinical  
**Definition:** A specialized, high-dependency clinical ward providing advanced life support, continuous invasive hemodynamic monitoring, mechanical ventilation, and dedicated one-on-one nursing for critically ill patients.  
**Used in:** Inpatient / ICU Module, Wards (`wards.ward_type = 'icu'`, Room `a839ad3e-8721-4428-a825-6eee1f75207b`)

### ICU Hourly Chart
**Category:** Clinical / System  
**Definition:** A structured electronic flow-sheet updated hourly by ICU nurses, capturing invasive arterial/CVP pressures, mechanical ventilator settings (PEEP, FiO2, Tidal Volume), RASS sedation depth, GCS, pupil reactivity, urine output, inotrope infusion rates, and arterial blood gas (ABG) values.  
**Used in:** ICU Ward Interface (`icu_hourly_charts`, `rooms.$id.tsx`)

### ICU Nurse
**Category:** System / Role  
**Definition:** A critical care certified nurse assigned to the ICU ward authorized to maintain hourly critical flow-sheets, titrate vasoactive infusions, manage mechanical ventilators, and dispense medications directly from the specialized ICU sub-inventory store.  
**Used in:** ICU Clinical Room (`user_roles`, `icu_hourly_charts`, `stock_usage`)

### ICU Store
**Category:** System / Stock  
**Definition:** A dedicated departmental drug and consumable sub-location (`a99583cd-9354-470a-9299-73457734284d`) storing emergency critical-care drugs (Adrenaline, Noradrenaline, Midazolam, Fentanyl, Propofol, Vecuronium), endotracheal tubes, and central lines.  
**Used in:** Stock Management, ICU Ward Dispensing (`stock_locations`, `stock_items`)

### Identity Verification (IPRS)
**Category:** Kenya-specific / Technical  
**Definition:** The automated validation of citizen identities against the Kenya Integrated Population Registration System database via DHA APIs, verifying National ID or Passport details against official state population registers.  
**Used in:** Patient Registration (`verify_patient_identity()` RPC, ⏳ DHA Integration)

### Inpatient (IPD)
**Category:** Clinical  
**Definition:** Clinical care provided to patients admitted to a hospital ward bed for comprehensive medical, surgical, pediatric, or obstetric treatment requiring one or more overnight stays.  
**Used in:** Inpatient Module (`/inpatient`, `admissions`, `wards`, `beds`)

### Insurance Agent
**Category:** System / Role  
**Definition:** A hospital desk officer responsible for verifying patient insurance policies (SHA, Private, Corporate), capturing authorization numbers, confirming coverage benefit limits, and submitting insurance claims.  
**Used in:** Insurance Desk (`/admin/insurance`, `user_roles`, `sha_claims`)

### Insurance Benefit Category
**Category:** Business / System  
**Definition:** A specific clinical benefit envelope defined under an insurance plan (e.g., Outpatient Consultation, Basic Lab, Specialized Imaging, Inpatient Normal Delivery, ICU Bed Care, Hemodialysis).  
**Used in:** Insurance Setup (`insurance_benefit_categories`, `insurance_benefit_plans`)

### Insurance Benefit Plan
**Category:** Business / System  
**Definition:** A configured insurance policy product associated with an insurance underwriter, detailing co-payment amounts, visit limits, annual maximum financial caps, and pre-authorization triggers.  
**Used in:** Insurance Desk, Billing (`insurance_benefit_plans`, `insurance_providers`)

### Insurance Limit / Visit Cap
**Category:** Business / System  
**Definition:** A hard limit established by insurance contracts capping the number of outpatient visits or maximum financial exposure allowed per patient per specified period.  
**Used in:** Insurance Desk (`enforce_insurance_visit_limit()` trigger)

### Insurance Provider
**Category:** Business / System  
**Definition:** An underwriter, fund, or scheme (e.g., Social Health Authority - SHA, Jubilee Insurance, CIC, Britam, First Assurance) covering healthcare costs for enrolled beneficiaries.  
**Used in:** Insurance Desk, Invoicing (`insurance_providers`)

### Invoice
**Category:** Business / System  
**Definition:** The consolidated fiscal bill generated for every patient encounter or mortuary booking, aggregating all billable line items (consultations, lab tests, radiology, pharmaceuticals, bed charges, procedures), tracking payments received, waivers applied, and outstanding balances.  
**Used in:** Billing & Accounting Module (`invoices`, `invoice_line_items`, `invoice_payments`)

### Invoice Line Item
**Category:** Business / System  
**Definition:** An individual charged service, drug, diagnostic test, bed day, or consumable entry appearing on a patient invoice with quantity, unit price, source reference, and calculated subtotal.  
**Used in:** Invoicing (`invoice_line_items`, `sync_invoice_line_item_from_prescription()`)

### Invoice Payment
**Category:** Business / System  
**Definition:** A financial transaction ledger entry recording funds received against an open invoice, tagged with payment method (Cash, M-Pesa, Card, Bank Transfer, SHA Claim, Private Insurance Guarantee), transaction reference, and cashier user ID.  
**Used in:** Cash Office, Accounting (`invoice_payments`, `recalc_invoice_payments()` trigger)

### IPRS (Integrated Population Registration System)
**Category:** Kenya-specific  
**Definition:** The national government identity registry database maintained by the Ministry of Interior, serving as the single source of truth for citizen identity verification in Kenya.  
**Used in:** Patient Intake, Identity Verification

---

## J

### JWT (JSON Web Token)
**Category:** Technical  
**Definition:** A cryptographically signed token issued by Supabase Auth upon successful user authentication, passed in HTTP Authorization headers to enforce database Row-Level Security policies and secure Edge Function execution.  
**Used in:** Security Architecture, Supabase Auth

---

## K

### KMHFL (Kenya Master Health Facility List) Code
**Category:** Kenya-specific  
**Definition:** The unique national numeric identifier (e.g., `12345`) assigned to every licensed healthcare facility by the Ministry of Health, mandatory for national health reporting, SHA claims, and DHA interoperability.  
**Used in:** Facility Settings (`app_settings.facility_kmhfl_code`), DHA/SHA Payloads

### KMPDC (Kenya Medical Practitioners and Dentists Council)
**Category:** Kenya-specific  
**Definition:** The statutory regulatory council established by Cap 253 of the Laws of Kenya that licenses medical practitioners, dental surgeons, and all public/private healthcare institutions nationwide.  
**Used in:** Staff Registration Profiles (`profiles.council_registration_number`, `verify_practitioner()`)

### KSh (Kenyan Shilling)
**Category:** Business / Kenya-specific  
**Definition:** The official national currency of Kenya (`KES` / `KSh`), used universally across AegisCare for price catalogs, invoice line items, cash collections, and insurance claims.  
**Used in:** Billing Engine, Financial Reports, Price Catalogs

---

## L

### Laboratory
**Category:** Clinical / System  
**Definition:** The clinical diagnostic department responsible for analyzing biological specimens (blood, urine, stool, CSF, sputum, tissue) to assist clinicians in disease diagnosis, staging, and monitoring.  
**Used in:** Laboratory Module (`/laboratory`, `lab_orders`, `lab_results`)

### Laboratory Order
**Category:** Clinical / System  
**Definition:** A formal diagnostic request initiated by a clinician during an outpatient or inpatient encounter, specifying tests to be performed, clinical indications, and priority status.  
**Used in:** Laboratory Module (`lab_orders`, `laboratory.$id.tsx`)

### Laboratory Result
**Category:** Clinical / System  
**Definition:** Quantitative values or qualitative interpretations recorded by a lab technologist for a requested test, compared against reference ranges, flagged for critical abnormal values, and electronically verified.  
**Used in:** Laboratory Module (`lab_results`, `send_lab_result_to_room()` RPC)

### Laboratory Test Catalog
**Category:** Clinical / System  
**Definition:** The institutional master catalog of all accredited diagnostic laboratory investigations offered by the facility, specifying test names, department categories, specimen types, normal reference ranges, turn-around times, and base cash prices.  
**Used in:** Laboratory Configuration, Services (`lab_test_catalog`)

### Lab Tech (Laboratory Technologist)
**Category:** System / Role  
**Definition:** A certified laboratory professional registered under the Kenya Medical Laboratory Technicians and Technologists Board (KMLTTB), authorized to accept specimens, run clinical analyzers, record test outcomes, verify results, and manage lab reagent stocks.  
**Used in:** Laboratory Module (`user_roles`, `lab_orders`, `lab_results`)

### Lab View / Lab Update / Lab Results Create
**Category:** System / Permission  
**Definition:** Granular security permissions governing laboratory operations:
- `lab_view`: Read laboratory workbenches and completed results.
- `lab_update`: Edit specimen reception and processing statuses.
- `lab_results_create`: Input clinical assay results and reference ranges.  
**Used in:** `role_permissions`, Laboratory UI Access

### Line Item
**Category:** Business  
**Definition:** A distinct row item within an invoice or purchase order representing a single billable entity with associated unit price, quantity, and total cost.  
**Used in:** Billing, Procurement (`invoice_line_items`)

### Location Access (Stock)
**Category:** System / Stock  
**Definition:** Granular security access controls assigning specific hospital users permissions to view, request, approve, issue, or receive inventory within designated warehouse locations.  
**Used in:** Stock Management (`user_stock_location_access`, `user_can_access_stock_location()` RPC)

### LPO (Local Purchase Order)
**Category:** Business  
**Definition:** An official commercial procurement document issued by the hospital procurement department to an approved supplier, authorizing the purchase and delivery of specified pharmaceuticals or clinical consumables at agreed prices.  
**Used in:** Stock Procurement (`stock_deliveries.invoice_number`, Procurement Workflows)

---

## M

### Machine
**Category:** System / Clinical  
**Definition:** A specialized diagnostic, therapeutic, or life-support medical device (e.g., Automated Hematology Analyzer, Chemistry Analyzer, Digital X-Ray, Ultrasound, Hemodialysis Machine, ICU Ventilator) registered in the system and monitored for operational uptime and maintenance logs.  
**Used in:** Machines Management (`/machines`, `machines`, `machine_logs`)

### Machine Log
**Category:** System / Technical  
**Definition:** A maintenance, service, calibration, or error history entry logged against a specific hospital medical device to maintain regulatory quality control standards.  
**Used in:** Machines Module (`machine_logs`)

### Machines
**Category:** System / Permission  
**Definition:** A system security permission (`machines`) authorizing technical staff and biomedical engineers to create machine records, schedule maintenance windows, and log calibration records.  
**Used in:** `role_permissions`, Equipment Management

### Main Store
**Category:** System / Stock  
**Definition:** The central hospital warehouse inventory repository (`a0000000-0000-0000-0000-000000000001`) where all bulk supplier deliveries are received, verified, and held prior to inter-departmental distribution.  
**Used in:** Stock Module (`stock_locations`, `stock_transfers`)

### MCH (Maternal and Child Health)
**Category:** Clinical / MOH  
**Definition:** Specialized primary care services encompassing Antenatal Care (ANC), Postnatal Care (PNC), Child Welfare & Immunization (EPI), and Prevention of Mother-to-Child Transmission of HIV (PMTCT).  
**Used in:** MCH Clinic Room, MOH MCH Reports (`/moh/mch`, `moh_indicator_definitions`)

### Medication Administration Record (MAR)
**Category:** Clinical  
**Definition:** An electronic nursing record documenting the actual bedside administration of scheduled and PRN (as-needed) medications to admitted inpatients, including drug, dosage, route, exact timestamp, and administering nurse signature.  
**Used in:** Inpatient Ward Module (`medication_administrations`, `inpatient_.$admissionId.tsx`)

### Medication Dispense (FHIR)
**Category:** Technical / Clinical  
**Definition:** A standardized FHIR R4 resource representing the physical supply and dispensing of a pharmaceutical product to a patient, including quantity dispensed, days supply, and dosage instructions.  
**Used in:** Pharmacy Module, Edge Function `fhir-bundle`, `trg_medication_dispense_fhir()`

### Mediator ID
**Category:** Technical / DHA  
**Definition:** The unique transaction tracing identifier assigned to an outbound FHIR bundle submitted to the DHA AfyaLink Health Information Mediator gateway.  
**Used in:** `dha_outbound_queue.mediator_id`, FHIR Interoperability

### Mermaid Diagram
**Category:** Technical  
**Definition:** A plain-text diagramming language embedded within Markdown files to render dynamic entity-relationship diagrams (ERDs), process flowcharts, and system architectural topologies natively.  
**Used in:** System Documentation, `docs/schema.md`

### MOH (Ministry of Health Kenya)
**Category:** Kenya-specific  
**Definition:** The national executive ministry responsible for healthcare policy, public health standards, health indicator registries, and statutory epidemiology reporting across all 47 counties.  
**Used in:** MOH Reporting Suite, System Compliance

### MOH Indicator Definition
**Category:** Kenya-specific / System  
**Definition:** Configuration metadata defining specific disease or service tally criteria mapped to statutory MoH monthly report templates (MOH 705A/B, 706, 707, 717, FP, MCH).  
**Used in:** MOH Module (`moh_indicator_definitions`, `process_encounter_indicators()`)

### MOH Monthly Aggregates
**Category:** Kenya-specific / System  
**Definition:** Pre-computed database summary tables storing aggregated patient visit and diagnosis tallies per month, accelerating statutory reporting performance.  
**Used in:** Database Table `moh_monthly_aggregates`, `refresh_moh_monthly_aggregates()` RPC

### Mortician
**Category:** System / Role  
**Definition:** A licensed funeral service practitioner authorized to manage mortuary cold-room storage units, log internal and external body admissions, document embalming procedures and post-mortem examinations, manage viewing schedules, and execute body release clearance.  
**Used in:** Mortuary Module (`/rooms/$mortuaryRoomId`, `mortuary_records`, `user_roles`)

### Mortuary Module
**Category:** Clinical / System  
**Definition:** A dedicated facility module for tracking the reception, refrigeration bay allocation, preservation, autopsy documentation, storage charge calculation, and formal handover of deceased bodies to next-of-kin or state authorities.  
**Used in:** Mortuary Department (`mortuary_records`, `accrue_daily_mortuary_charges()`)

### Mortuary Record
**Category:** Clinical / System  
**Definition:** A comprehensive administrative record for a deceased body, detailing full name, age, gender, date/time of death, cause of death, admitting body source (internal ward vs. external police/home intake), storage slot, next-of-kin details, and release clearance status.  
**Used in:** Mortuary Module (`mortuary_records`, `assign_mortuary_reference()` trigger)

### Mortuary Room
**Category:** System  
**Definition:** The physical mortuary facility department entity (`214aca6c-cbde-40ce-af5a-92cc7815bda9`) within the hospital room hierarchy.  
**Used in:** Facility Architecture, Room Routing

### M-Pesa Integration (Daraja API)
**Category:** Kenya-specific / Technical  
**Definition:** The planned Phase 3 integration with Safaricom's Daraja M-Pesa API, supporting automated STK Push payment requests at cashier desks and automated B2C refund disbursements.  
**Used in:** Cash Office, Billing Module (⏳ Phase 3 Roadmap)

### MUAC (Mid-Upper Arm Circumference)
**Category:** Clinical  
**Definition:** A quick nutritional screening measurement taken in pediatric triage to identify acute malnutrition (Red <11.5 cm: Severe Acute Malnutrition; Yellow 11.5–12.5 cm: Moderate Acute Malnutrition; Green >12.5 cm: Normal).  
**Used in:** Triage Module, Pediatric Consultation (`encounters.vitals`)

---

## N

### NLMIS Code (National Lab Management Information System)
**Category:** Kenya-specific / System  
**Definition:** Standardized commodity codes assigned by the Kenya National Lab Management Information System to lab reagents and test kits for harmonized national supply chain reporting.  
**Used in:** Laboratory Test Catalog (`lab_test_catalog.nlmis_code`, `sprint11c_nlmis_code.sql`)

### Nurse
**Category:** System / Role  
**Definition:** A licensed general nursing practitioner registered under the Nursing Council of Kenya (NCK), authorized to capture vital signs, administer prescribed oral/parenteral medications, perform wound dressings, manage ward inpatients, and record nursing progress notes.  
**Used in:** Triage, Wards, Inpatient Module (`user_roles`, `medication_administrations`)

### Nutritionist
**Category:** System / Role  
**Definition:** A licensed healthcare professional specializing in clinical dietetics and nutritional assessment, managing therapeutic feeds, calculating caloric requirements, and running outpatient nutrition clinics.  
**Used in:** Specialized Clinics, Inpatient Care (`user_roles`, `clinical_notes`)

---

## O

### ODPC (Office of the Data Protection Commissioner)
**Category:** Kenya-specific / Compliance  
**Definition:** The statutory supervisory authority established under Kenya's Data Protection Act, 2019, regulating the lawful processing of personal and health data, mandating patient consent, purpose specification, and access auditability.  
**Used in:** System Security, Consent Framework, Data Privacy Policies

### OPD (Outpatient Department)
**Category:** Clinical  
**Definition:** The hospital clinical division delivering non-emergency diagnostic, therapeutic, and preventive care to patients who do not require overnight inpatient admission.  
**Used in:** Reception, Queue, Consultation (`encounters.encounter_type = 'outpatient'`)

### OTP (One-Time Password) Consent
**Category:** System / Security  
**Definition:** An automated Kenya Data Protection Act compliance workflow where an encrypted 6-digit numeric verification token is sent via SMS to the patient's registered mobile phone to obtain explicit consent for digital health record processing and national HIE sharing.  
**Used in:** Patient Registration, Consent Management (`consent_otps`, `patient_consents`, Edge Function `send-sms`)

---

## P

### Patient Consent
**Category:** System / Compliance  
**Definition:** An explicit, timestamped electronic record confirming a patient's approval for clinical treatment, billing disclosures, research use, or data sharing with the national DHA Health Information Exchange.  
**Used in:** Patient Registration (`patient_consents`)

### Patient File Number
**Category:** System / Clinical  
**Definition:** A unique, sequential institutional patient identifier (e.g., `P000123`) automatically assigned to every newly registered patient and stamped on all physical cards and digital records.  
**Used in:** Patient Registration (`patients.file_number`, `set_patient_file_number()` trigger)

### Patient Registration
**Category:** Clinical / System  
**Definition:** The initial intake administrative workflow capturing patient legal identification, demographic profile, next-of-kin contacts, insurance membership, and consent preferences.  
**Used in:** Patient Registration Module (`/register-patient`, `patients`, `encounters`)

### Payment Mode (Cash / Insurance / SHA / Corporate / Exemption)
**Category:** Business / System  
**Definition:** The financial categorization applied to an encounter determining billing rules and reimbursement mechanisms:
- `cash`: Out-of-pocket self-pay.
- `insurance`: Private or corporate medical underwriter.
- `sha_shif`: Social Health Authority fund.
- `exemption`: Vulnerable patient waived under government waiver programs.  
**Used in:** Patient Registration, Billing Engine (`encounters.payment_mode`)

### PHF (Primary Healthcare Fund)
**Category:** Kenya-specific / Business  
**Definition:** A universal health coverage fund managed under Kenya's Social Health Insurance Act, financing essential primary care outpatient services at MoH Level 2 (Dispensaries) and Level 3 (Health Centres) without copayment.  
**Used in:** Insurance Desk, Benefit Packages (`insurance_benefit_categories`)

### Pharmacist
**Category:** System / Role  
**Definition:** A licensed pharmaceutical professional registered with the Pharmacy and Poisons Board (PPB) of Kenya, authorized to verify clinical prescriptions, screen for drug-drug interactions, dispense medications from outpatient and inpatient pharmacies, and manage pharmacy warehouse stock.  
**Used in:** Pharmacy Module (`user_roles`, `prescriptions`, `stock_movements`)

### Pharmacy Module
**Category:** Clinical / Stock  
**Definition:** The operational department handling prescription queues, pharmacist verification, batch-specific drug dispensing, patient dosage counseling, and real-time inventory deductions.  
**Used in:** Pharmacy Room (`prescriptions`, `dispense_prescription_stock()` trigger)

### Pharmacy Store
**Category:** System / Stock  
**Definition:** The dedicated dispensing pharmacy sub-location (`a0000000-0000-0000-0000-000000000003`) from which general outpatient and ward prescriptions are dispensed to patients.  
**Used in:** Stock Management, Pharmacy (`stock_locations`)

### Physiotherapist
**Category:** System / Role  
**Definition:** A licensed physical rehabilitation specialist providing therapeutic exercise, manual therapy, and post-operative mobility rehabilitation for outpatients and ward inpatients.  
**Used in:** Specialized Therapy Rooms (`user_roles`, `clinical_notes`)

### Pre-Authorization (Preauth)
**Category:** Business  
**Definition:** Formal advance approval granted by an insurance provider (e.g., SHA or private insurer) authorizing scheduled elective admissions, advanced radiological imaging (CT/MRI), or specialized surgical procedures before delivery.  
**Used in:** Insurance Desk, Inpatient Admission (`sha_claims.preauth_code`, `encounters.preauth_number`)

### Prescription
**Category:** Clinical / Pharmacy  
**Definition:** A formal medical instruction issued by a licensed clinician detailing a drug name, formulation, dosage strength, frequency, route, and treatment duration for a specific patient encounter.  
**Used in:** Consultation, Inpatient, Pharmacy (`prescriptions`, `rooms.$id.tsx`)

### Primary Diagnosis
**Category:** Clinical  
**Definition:** The chief condition or disease entity established at the conclusion of clinical evaluation to be predominantly responsible for the patient seeking medical care.  
**Used in:** Consultation, MOH Reports, SHA Claims (`encounter_diagnoses.sequence = 1`)

### Profiles
**Category:** Technical / System  
**Definition:** The database user profile extension table storing practitioner professional metadata (full legal name, professional council type, registration number, national ID, phone, department).  
**Used in:** User Management (`profiles`, `verify_practitioner()`)

---

## Q

### Queue Management
**Category:** System  
**Definition:** The operational routing workflow that assigns arriving patients to specific service rooms (Triage, Insurance, Doctor, Lab, Radiology, Pharmacy, Billing) and manages real-time waiting lists.  
**Used in:** Queue Module (`/queue`, `/admin/queue`, `encounters.room_id`, `encounters.queue_status`)

---

## R

### Radiology Module
**Category:** Clinical / System  
**Definition:** The medical diagnostic imaging department responsible for performing X-rays, ultrasounds, CT scans, and mammograms, generating structured imaging reports, and notifying ordering doctors.  
**Used in:** Radiology Module (`/radiology`, `radiology_orders`, `radiology_results`)

### Radiology Order
**Category:** Clinical / System  
**Definition:** An electronic imaging requisition created by an attending clinician specifying anatomical region, projection modality, clinical indications, and priority.  
**Used in:** Consultation, Inpatient, Radiology (`radiology_orders`)

### Radiology Result
**Category:** Clinical / System  
**Definition:** A comprehensive diagnostic interpretation and formal radiological report entered by a radiologist or sonographer.  
**Used in:** Radiology Module (`radiology_results`, `send_radiology_results_to_requesting_room()` RPC)

### Radiology View / Radiology Update / Radiology Results Create
**Category:** System / Permission  
**Definition:** Security permissions governing imaging operations:
- `radiology_view`: View incoming imaging orders and finalized reports.
- `radiology_update`: Update modality examination statuses.
- `radiology_results_create`: Author and sign formal diagnostic imaging reports.  
**Used in:** `role_permissions`, Radiology UI Access

### Radiologist
**Category:** System / Role  
**Definition:** A medical specialist or imaging technologist certified to operate diagnostic imaging modalities, interpret radiographs, scans, and sonograms, and author diagnostic radiology reports.  
**Used in:** Radiology Department (`user_roles`, `radiology_orders`, `radiology_results`)

### RASS (Richmond Agitation-Sedation Scale)
**Category:** Clinical  
**Definition:** A standardized 10-point clinical scale ranging from -5 (unarousable sedation) through 0 (alert and calm) to +4 (combative agitation), used in ICU hourly charting to assess sedation depth.  
**Used in:** ICU Hourly Charting (`icu_hourly_charts.rass_score`)

### Receptionist
**Category:** System / Role  
**Definition:** Front-office administrative staff responsible for searching patient archives, creating new patient master files, capturing OTP consent, assigning payment modes, and dispatching patients to triage or the insurance desk.  
**Used in:** Reception Desk, Queue (`/register-patient`, `user_roles`)

### Records Create / Records View
**Category:** System / Permission  
**Definition:** Permissions governing patient master file management:
- `records_view`: Search and view patient demographic and registration histories.
- `records_create`: Register new patient profiles and open new clinical encounters.  
**Used in:** `role_permissions`, Patient Registration

### Records Officer
**Category:** System / Role  
**Definition:** A medical records technician (Health Information Management Officer) responsible for patient registration data quality, physical and electronic file tracking, ICD-11 coding reviews, and monthly MoH data reconciliation.  
**Used in:** Registration, Health Records, MOH Reporting (`user_roles`)

### Referral Direction (In / Out)
**Category:** Clinical / MOH  
**Definition:** The movement classification of transferred patients:
- `in`: Patient referred into the facility from a peripheral dispensary or clinic.
- `out`: Patient referred out to a higher-tier secondary or tertiary hospital.  
**Used in:** Patient Registration, Consultation, MOH 717 (`encounters.referral_direction`, `encounters.referral_out_facility`)

### Register Patient
**Category:** System / Permission  
**Definition:** The system security permission (`register_patient`) permitting staff to access the patient intake wizard, issue patient file numbers, and initiate billable encounters.  
**Used in:** `role_permissions`, Front Desk UI

### Report Permissions (reports.finance, reports.registrations, reports.stock, reports.tests)
**Category:** System / Permission  
**Definition:** Granular security permissions governing report generation:
- `reports.finance`: Access revenue, payment, waiver, and aging ledgers.
- `reports.registrations`: View patient demographic and attendance volumes.
- `reports.stock`: View inventory movements, consumption, and stock valuations.
- `reports.tests`: View laboratory diagnostic throughput summaries.  
**Used in:** `role_permissions`, Reports Module (`/reports`)

### Realtime (Supabase Realtime)
**Category:** Technical  
**Definition:** Supabase's WebSocket-based real-time listener architecture allowing the AegisCare user interface to update room queues, lab results, bed allocations, and vital alerts instantly without manual page refreshing.  
**Used in:** Queue Management, Bed Tracking, Lab Workbenches

### RLS (Row-Level Security)
**Category:** Technical / Security  
**Definition:** PostgreSQL database engine security policies that enforce granular data access boundaries at the individual database row level based on the authenticated user's JWT role, approved status, and departmental assignment.  
**Used in:** All Supabase Database Tables

### Room
**Category:** System  
**Definition:** A defined physical operational clinical or service room within the hospital (e.g., Room 1 OPD, Consultation Room, Triage, Minor Theatre, Lab, Radiology, Cash Office, Mortuary).  
**Used in:** Queue Routing, Room Management (`rooms`, `encounter_room_visits`)

### Room Routing
**Category:** System / Clinical  
**Definition:** The automated or manual transfer of a patient encounter from one service room to another across their care journey.  
**Used in:** `route_registration_to_service_room()` RPC, `encounter_room_visits`

### RPC (Remote Procedure Call)
**Category:** Technical  
**Definition:** A server-side PostgreSQL function executable directly from the frontend client via Supabase RPC, executing complex transactional business operations atomically.  
**Used in:** Database Business Logic (`charge_icu_admission_fee`, `process_dialysis_session_billing`)

---

## S

### Secondary Diagnosis
**Category:** Clinical  
**Definition:** An additional condition or co-existing disease present during a clinical encounter that co-exists with or develops during treatment, influencing medical management.  
**Used in:** Consultation, Inpatient, SHA Claims (`encounter_diagnoses.sequence > 1`)

### Service Room
**Category:** System / Clinical  
**Definition:** A room configured to provide diagnostic, therapeutic, or administrative services rather than general clinical consultation (e.g., Laboratory, Ultrasound, Pharmacy, Cashier).  
**Used in:** `rooms.room_kind = 'service'`, Room Routing

### Services Manage
**Category:** System / Permission  
**Definition:** An administrative permission (`services.manage`) enabling authorized supervisors to edit the master service price catalog, lab test menu, and procedural tariffs.  
**Used in:** `role_permissions`, Admin Settings (`/admin/services`)

### SHA (Social Health Authority)
**Category:** Kenya-specific  
**Definition:** The statutory state corporation established under the Social Health Insurance Act, 2023, succeeding the former National Hospital Insurance Fund (NHIF) to administer universal social health insurance across Kenya.  
**Used in:** Insurance Desk, Claims Engine, DHA Interoperability

### SHA Claim
**Category:** Business / Technical  
**Definition:** An electronic reimbursement claim record generated for SHA-insured patients, containing encounter diagnosis codes, validated procedure tariffs, itemized pharmacy claims, pre-authorization codes, and attached FHIR claim bundles.  
**Used in:** Insurance Desk, Claims Dispatcher (`sha_claims`, `sha_claim_items`)

### SHA Claim Item
**Category:** Business / Technical  
**Definition:** An itemized billing line item included within an SHA insurance claim, mapped to SHA standardized tariff codes and package categories.  
**Used in:** Claims Management (`sha_claim_items`)

### SHA SHIF (Social Health Insurance Fund)
**Category:** Kenya-specific / Business  
**Definition:** The primary mandatory social insurance fund under the SHA, financed via statutory payroll and voluntary contributions to provide universal outpatient, inpatient, and specialized surgical care across Kenya.  
**Used in:** Patient Registration, Insurance Desk (`encounters.payment_mode = 'sha_shif'`)

### SHR (Shared Health Record)
**Category:** Kenya-specific / Technical  
**Definition:** The central national electronic clinical repository operated by the DHA where longitudinal citizen health summaries, FHIR encounter bundles, diagnostic observations, and dispensed medications are consolidated nationwide.  
**Used in:** System Architecture, DHA Compliance, Edge Function `fhir-bundle`

### Sign Encounter
**Category:** System / Permission  
**Definition:** A privileged clinical permission (`sign_encounter`) restricted to licensed Doctors, Clinical Officers, and Dental Officers, allowing them to finalize, cryptographically lock, and legally sign clinical encounters.  
**Used in:** `role_permissions`, Consultation Completion

### SSR (Server-Side Rendering)
**Category:** Technical  
**Definition:** Frontend architectural rendering mode provided by TanStack Start where initial page HTML is pre-rendered on the server to optimize loading performance, SEO, and initial render speeds.  
**Used in:** Frontend Application Architecture

### Staff
**Category:** System / Role  
**Definition:** A baseline general staff role providing foundational read and operational access across general queue tracking, patient file lookup, and internal communications.  
**Used in:** `user_roles`, Baseline System Access

### Stock Item
**Category:** Stock / System  
**Definition:** A registered pharmaceutical product, medical supply, laboratory reagent, or surgical consumable maintained in the inventory database with stock keeping unit (SKU) codes, unit of measure, re-order levels, buying prices, and selling prices.  
**Used in:** Stock Module, Pharmacy (`stock_items`)

### Stock Keeper
**Category:** System / Role  
**Definition:** An inventory management officer responsible for receiving warehouse deliveries, conducting periodic physical stock counts, and approving inter-departmental store transfers.  
**Used in:** Stock Management (`/stock`, `/deliveries`, `user_roles`)

### Stock Location
**Category:** Stock / System  
**Definition:** A distinct physical warehouse or departmental sub-inventory store within the hospital (e.g., Main Store, Central Pharmacy, ICU Store, Dialysis Store, Lab Store).  
**Used in:** Stock Module (`stock_locations`)

### Stock Movement
**Category:** Stock / System  
**Definition:** An immutable inventory ledger transaction recording physical additions or subtractions of stock quantities, tagged by movement type (`delivery`, `dispense`, `transfer_out`, `transfer_in`, `usage`, `adjustment`, `loss`).  
**Used in:** Stock Module (`stock_movements`, `apply_stock_movement()` trigger)

### Stock Transfer
**Category:** Stock / System  
**Definition:** An authorized inter-store movement of inventory items from a source store (e.g., Main Store) to a destination departmental store (e.g., Pharmacy Store, ICU Store).  
**Used in:** Stock Module (`stock_transfers`, `transfer_stock_between_locations()` RPC)

### Stock Usage
**Category:** Stock / System  
**Definition:** The direct logging of consumed supplies and single-use medical devices used during patient care (e.g., ICU catheters, Dialysis lines, Theatre sutures) linked to an encounter or department.  
**Used in:** Clinical Units, Stock Management (`stock_usage`, `record_stock_usage()` RPC)

### Supabase
**Category:** Technical  
**Definition:** The open-source backend-as-a-service platform powering AegisCare, integrating a managed PostgreSQL relational database, Row-Level Security, Supabase Auth, realtime WebSocket feeds, and Edge Functions.  
**Used in:** Entire Backend Infrastructure

### System Admin
**Category:** System / Role  
**Definition:** The highest technical infrastructure administrator persona possessing root privileges across database policies, edge function settings, integration keys, security configurations, and user identity lifecycles.  
**Used in:** Database Management, System Infrastructure

---

## T

### TanStack Router / TanStack Start
**Category:** Technical  
**Definition:** Modern, 100% type-safe routing and full-stack React application frameworks utilized to structure AegisCare's frontend user interface, server-side data loaders, and component rendering trees.  
**Used in:** Frontend Web Architecture (`src/routes/*`)

### Tariffs
**Category:** Business  
**Definition:** The standardized official pricing schedule applied to consultations, bed days, surgical operations, diagnostic investigations, and medical consumables.  
**Used in:** Billing, Insurance Clearance (`insurance_contracted_prices`)

### Triage
**Category:** Clinical / System  
**Definition:** The essential nursing assessment workflow performed immediately following registration to measure vital signs, evaluate clinical acuity, calculate pediatric nutrition scores, and prioritize patients for doctor consultation.  
**Used in:** Triage Module (`rooms.$id.tsx`, `encounters.vitals`)

### Triage Nurse
**Category:** System / Role  
**Definition:** A nurse stationed at the outpatient triage desk responsible for capturing blood pressure, pulse, temperature, respiratory rate, oxygen saturation, random blood glucose, weight, height, and pain scores.  
**Used in:** Outpatient Triage (`user_roles`, `encounters`)

---

## U

### Ultrafiltration (UF) Rate / Goal
**Category:** Clinical / Dialysis  
**Definition:** The prescribed target volume of excess fluid (in milliliters) to be removed from a hemodialysis patient's vascular and interstitial spaces during a dialysis run, calculated from pre-dialysis weight and dry weight.  
**Used in:** Dialysis Unit (`dialysis_sessions.uf_goal_ml`, `dialysis_sessions.uf_rate`)

### User Has Permission
**Category:** Technical / Security  
**Definition:** A PostgreSQL security function (`user_has_permission(_user uuid, _perm text)`) that evaluates whether an authenticated user possesses a designated permission via their assigned system roles.  
**Used in:** RLS Security Policies, UI Access Guards

### User Role
**Category:** Technical / Security  
**Definition:** The database association linking a user profile in `auth.users` to one or more functional hospital roles (`app_role`), determining functional interface permissions and clinical access rights.  
**Used in:** User Management (`user_roles`, `has_role()` RPC)

### User Room Access
**Category:** Technical / Security  
**Definition:** Security access mapping records explicitly assigning authorized healthcare workers to specific hospital consultation rooms, diagnostic suites, or wards.  
**Used in:** Room Security (`user_room_access`, `can_access_room()` RPC)

---

## V

### Vitals (Vital Signs)
**Category:** Clinical  
**Definition:** The objective physiological measurements of baseline body functions recorded at triage and bedside:
- Systolic & Diastolic Blood Pressure (mmHg)
- Heart / Pulse Rate (bpm)
- Respiratory Rate (breaths/min)
- Body Temperature (°C)
- Pulse Oximetry / SpO2 (%)
- Random Blood Sugar (mmol/L)
- Weight (kg) & Height (cm) → Body Mass Index (BMI)  
**Used in:** Triage, Consultation, Inpatient MAR, ICU Flow-sheets (`encounters.vitals`)

### Vercel
**Category:** Technical  
**Definition:** The cloud hosting platform providing automated continuous deployment, edge delivery network, and production hosting for the AegisCare TanStack Start / React web application.  
**Used in:** Deployment Infrastructure

---

## W

### Waive / Waiver
**Category:** Business  
**Definition:** A formal administrative reduction or full cancellation of an outstanding invoice balance granted to indigent or vulnerable patients, requiring verified supervisory approval and mandatory audit justification.  
**Used in:** Billing & Accounting (`invoices.waiver_amount`, `invoices.waiver_approved_by`)

### Ward
**Category:** Clinical / System  
**Definition:** A distinct inpatient residential nursing unit (e.g., Male Medical, Female Surgical, Maternity, Pediatric, ICU, HDU) containing assigned beds, dedicated nursing rosters, and daily bed rates.  
**Used in:** Inpatient Management (`wards`, `beds`, `admissions`)

### Ward Transfer
**Category:** Clinical / System  
**Definition:** The clinical and operational transfer of an admitted inpatient from one hospital ward or bed to another (e.g., transferring a stabilizing patient from the ICU to the General Medical Ward).  
**Used in:** Inpatient Module (`admissions`, `beds`, `audit_ward_transfers` trigger)

### Working Diagnosis
**Category:** Clinical  
**Definition:** The provisional clinical diagnostic hypothesis formulated by an attending doctor upon initial examination, serving as the clinical basis for ordering diagnostic workups and initiating initial therapies.  
**Used in:** Consultation Module (`encounter_diagnoses.diagnosis_type = 'working'`)
