# AegisCare HMS — Complete System Documentation

**System Title:** AegisCare Hospital Management System (HMS)  
**Document Version:** 1.0.0  
**Target Environment:** Kenya Ministry of Health (MoH) Level 1–6 Facilities  
**Classification:** Technical & System Architecture Reference  

---

## 1. System Overview

**AegisCare HMS** is an enterprise-grade, cloud-native Hospital Management System engineered specifically for the Kenyan healthcare ecosystem. It provides comprehensive digital management for healthcare institutions ranging from primary care dispensaries and health centres (MoH Levels 1–3) to comprehensive county referral hospitals and tertiary teaching institutions (MoH Levels 4–6).

### Core Capabilities:
- **Full Clinical Workflow Management:** Seamless care pathways spanning OPD intake, triage vital scoring, doctor consultations with WHO ICD-11 coding, electronic diagnostic ordering, inpatient ward management, surgical admissions, and discharge reconciliations.
- **Specialized Critical Units:** Dedicated clinical subsystems for Intensive Care Units (ICU hourly flow-sheets, ventilator monitoring, RASS sedation scales) and Renal Hemodialysis units (vascular access, dialyzer tracking, ultrafiltration fluid metrics).
- **Statutory Kenya MoH Alignment:** Built-in two-layer indicator tagging engine generating automated monthly aggregate reports for MOH 705A (Under-5 Outpatient Morbidity), MOH 705B (Over-5 Outpatient Morbidity), MOH 706 (Laboratory), MOH 707 (Inpatient), MOH 717 (Workload), Family Planning (FP), and Maternal & Child Health (MCH).
- **National Health Insurance & Social Health Authority (SHA) Engine:** End-to-end support for the Social Health Insurance Act (SHIA) 2023, handling Primary Healthcare Fund (PHF), Social Health Insurance Fund (SHIF), and Emergency, Chronic and Critical Illness Fund (ECCIF) packages with automated FHIR R4 claim bundling.
- **National Digital Health Authority (DHA) Interoperability:** Pre-integrated FHIR R4 interoperability layer for bidirectional synchronization with the national Shared Health Record (SHR) via DHA AfyaLink Health Information Exchange (HIE).
- **Automated Communication & Consent:** Real-time SMS notifications for laboratory test completion alerts and Kenya Data Protection Act (ODPC) compliant OTP digital consent verification powered by Africa's Talking.
- **Granular Multi-Store Inventory & Ward Dispensing:** Real-time stock ledgers tracking central warehouse deliveries, inter-departmental transfers (Main Store, Central Pharmacy, ICU Store, Dialysis Store), batch numbers, expiry dates, and automated dispensing deductions.

---

## 2. Architecture Overview

AegisCare HMS employs a modern, full-stack reactive architecture designed for zero data loss, strict multi-tenant isolation, real-time clinical updates, and low-latency operation over standard Kenyan broadband networks.

```
                     ┌─────────────────────────────────────────────────────────┐
                     │                 CLIENT LAYER (BROWSER)                  │
                     │  React 18 + TanStack Start (SSR) + TanStack Router     │
                     │  Tailwind CSS + Shadcn UI + Lucide Icons                │
                     └────────────────────────────┬────────────────────────────┘
                                                  │ HTTPS / WSS
                                                  ▼
                     ┌─────────────────────────────────────────────────────────┐
                     │                 DEPLOYMENT & EDGE LAYER                 │
                     │  Vercel Edge Network / Lovable Cloud (Bun Runtime)      │
                     └────────────────────────────┬────────────────────────────┘
                                                  │
                                                  ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                     SUPABASE BACKEND PLATFORM                                           │
│                                                                                                         │
│  ┌───────────────────────┐  ┌───────────────────────────────────┐  ┌─────────────────────────────────┐  │
│  │     SUPABASE AUTH     │  │        POSTGRESQL DATABASE        │  │         EDGE FUNCTIONS          │  │
│  │  - JWT Authentication │  │  - 35+ Relational Tables          │  │  - send-sms (Africa's Talk)  │  │
│  │  - Role Mapping       │  │  - Strict Row-Level Security(RLS) │  │  - icd11-search (WHO API)    │  │
│  │  - User Approval Gate │  │  - PL/pgSQL Business Triggers     │  │  - claims-dispatcher         │  │
│  │  - Profiles Metadata  │  │  - pg_cron Scheduled Daemons      │  │  - fhir-patient / bundle     │  │
│  └───────────────────────┘  └─────────────────┬─────────────────┘  └─────────────────────────────────┘  │
│                                               │                                                         │
│                                               ▼                                                         │
│                             ┌───────────────────────────────────┐                                       │
│                             │        SUPABASE REALTIME          │                                       │
│                             │  - Live Room Queue Subscriptions  │                                       │
│                             │  - Lab Result Notification Feeds  │                                       │
│                             │  - Inpatient Bed Occupancy Sync   │                                       │
│                             └───────────────────────────────────┘                                       │
└───────────────────────────────────────────────┬─────────────────────────────────────────────────────────┘
                                                │
                                                ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                      EXTERNAL INTEGRATION GATEWAYS                                      │
│                                                                                                         │
│  ┌───────────────────────────┐  ┌───────────────────────────┐  ┌──────────────────────────────────────┐ │
│  │   AFRICA'S TALKING SMS    │  │   WHO ICD-11 CLOUD API    │  │     KENYA DHA / SHA GATEWAYS         │ │
│  │  - OTP Consent Delivery   │  │  - MMS Linearization      │  │  - AfyaLink HIE (FHIR R4 SHR) ⏳     │ │
│  │  - Lab Result Alerts      │  │  - Token Authentication   │  │  - SHA Claims Clearinghouse ⏳       │ │
│  │  - Discharge Summaries    │  │  - Foundation Search      │  │  - IPRS Identity Verification ⏳     │ │
│  └───────────────────────────┘  └───────────────────────────┘  └──────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Architectural Tenets:
1. **Model A Deployment Architecture:** Each healthcare facility operates on an isolated Supabase project and dedicated frontend deployment. Patient databases are physically partitioned—no cross-facility data leakage is possible.
2. **Database-Driven Business Integrity:** Critical invariants (financial balance computations, inventory deductions, encounter locks, statutory demographic tagging) are executed directly inside PostgreSQL transaction blocks via triggers and RPCs.
3. **Optimistic UI with Realtime Synchronization:** User interfaces leverage TanStack Query with real-time WebSocket subscriptions on PostgreSQL write-ahead logs (`supabase_realtime`), updating triage queues, lab results, and bed states instantaneously.

---

## 3. Module Documentation (19 System Modules)

---

### Module 1: Patient Registration
- **Purpose:** Centralized administrative intake capturing patient identity, demographic data, next-of-kin contacts, national identifiers, payment classifications, and opening clinical encounters.
- **Primary Roles:** `receptionist`, `records_officer`, `admin`, `system_admin`.
- **Key Workflows:**
  1. Patient lookup via Master Patient Index (File Number, National ID, Phone, or Name).
  2. If new: Create record in `patients`, generating sequential file number (`P000001`).
  3. Capture emergency vs. standard intake flag.
  4. Select payment mode (`cash`, `sha_shif`, `insurance`, `corporate`, `exemption`).
  5. Select initial destination room (Triage, Insurance Desk, Casualty, or Specialty Clinic).
  6. Automatically create linked row in `encounters` and `encounter_room_visits`.
- **Key DB Tables:** `patients`, `encounters` (view `patient_registrations`), `encounter_room_visits`, `app_settings`.
- **Business Rules Enforced:**
  - Mandatory file number generation via PostgreSQL sequence `patient_file_seq`.
  - Automatic uppercase normalization on names and national identity strings.
  - Emergency encounters bypass cashier clearance and proceed directly to resuscitation/casualty rooms.
- **Edge Cases Handled:**
  - Duplicate registration detection based on National ID and telephone matches.
  - Unknown birth date handling: Computes approximate birth date from user-supplied `estimated_age` while flagging `dob_known = false`.

---

### Module 2: Consent & OTP Management
- **Purpose:** Secures compliance with the Kenya Data Protection Act (ODPC) 2019 and DHA certification requirements by acquiring verified digital consent before electronic health data capture or national HIE transmission.
- **Primary Roles:** `receptionist`, `records_officer`, `triage_nurse`, `doctor`.
- **Key Workflows:**
  1. Intake staff triggers OTP generation on the patient registration form.
  2. System generates a 6-digit numeric token with a 10-minute expiry and saves it in `consent_otps`.
  3. Dispatches SMS via Africa's Talking Edge Function (`send-sms`) to the patient's mobile number.
  4. Patient provides the code; staff inputs it into the UI.
  5. System validates token, sets `patient_consents.consented = true` and `hie_data_sharing_consented = true`, logging timestamp and authenticated user ID.
- **Key DB Tables:** `consent_otps`, `patient_consents`, `audit_log`.
- **Business Rules Enforced:**
  - OTP tokens expire after 600 seconds (10 minutes).
  - Maximum 3 failed verification attempts before token invalidation.
  - HIE data synchronization in `claims-dispatcher` edge function is strictly suppressed if `hie_data_sharing_consented` is false.
- **Edge Cases Handled:**
  - Minors / Incapacitated Patients: Parent/guardian phone number capture with explicit relationship logging.
  - Network Outage / SMS Delay: Authorized manual override with mandatory written paper consent upload/reference.

---

### Module 3: Queue Management
- **Purpose:** Real-time orchestrator directing patient flow across physical service rooms, calculating wait times, preventing bottlenecks, and maintaining service transparency.
- **Primary Roles:** `receptionist`, `triage_nurse`, `doctor`, `clinical_officer`, `lab_tech`, `radiologist`, `pharmacist`, `accountant`.
- **Key Workflows:**
  1. Front desk routes an active encounter to a room (`encounters.room_id = target_room_id`).
  2. Departmental workbench displays live patient list filtered by room and status (`waiting`, `in_progress`, `done`).
  3. Practitioner clicks "Call Patient" → Status updates to `in_progress` and start timestamp recorded.
  4. On service completion, practitioner selects next destination (e.g., Doctor → Lab → Doctor → Pharmacy).
  5. System records history in `encounter_room_visits` and resets status to `waiting` in destination room.
- **Key DB Tables:** `encounters`, `rooms`, `encounter_room_visits`, `user_room_access`.
- **Business Rules Enforced:**
  - Practitioners can only access queues for rooms where they possess explicit `user_room_access` or have `admin` role (`can_access_room()` function).
  - Automated return-to-requesting-room routing upon lab or radiology completion (`send_lab_results_to_requesting_room()`).
- **Edge Cases Handled:**
  - "Patient Absent / Skipped" state transitions preserve queue sequence without dropping encounter.
  - Simultaneous multi-department orders (e.g., Lab + Ultrasound) allow parallel queue presence.

---

### Module 4: Triage
- **Purpose:** Systematic physiological assessment of arriving outpatients, capturing baseline vitals, calculating body mass indexes, screening pediatric malnutrition, and scoring acuity.
- **Primary Roles:** `triage_nurse`, `nurse`, `clinical_officer`, `doctor`.
- **Key Workflows:**
  1. Triage nurse pulls patient from triage room queue.
  2. Captures Systolic/Diastolic Blood Pressure, Pulse Rate, Body Temperature, Respiratory Rate, Oxygen Saturation (SpO2), Random Blood Sugar (RBS), Weight, Height, and MUAC.
  3. System automatically computes BMI and categorizes nutritional status.
  4. Clinical urgency flag assigned (`normal`, `urgent`, `critical_emergency`).
  5. Vitals JSON payload committed to `encounters.vitals` and patient routed to consultation room.
- **Key DB Tables:** `encounters`, `rooms`, `audit_log`.
- **Business Rules Enforced:**
  - Automatic critical alerts triggered for systolic BP >180 or <90 mmHg, SpO2 <90%, Temperature >39.0°C.
  - Demographic indicators (`tag_encounter_demographics()`) evaluated upon triage save.
- **Edge Cases Handled:**
  - Pediatric weight-for-height and MUAC fields dynamically required for patients aged <5 years.
  - Unresponsive/Emergency triage pathways allow direct casualty transfer with partial vitals capture.

---

### Module 5: Insurance Desk (SHA + Private + Corporate)
- **Purpose:** Comprehensive policy verification, pre-authorization capture, benefit category mapping, co-payment processing, and contracted tariff application.
- **Primary Roles:** `insurance_agent`, `accountant`, `admin`.
- **Key Workflows:**
  1. Front desk routes insured patient to Insurance Desk.
  2. Agent selects underwriter from `insurance_providers` and specific scheme from `insurance_benefit_plans`.
  3. Verifies member eligibility number and captures Pre-Authorization Code (for inpatient/specialized procedures).
  4. Enforces copayment requirements by appending copay charge to open invoice.
  5. Marks insurance status as `cleared` and routes patient to Triage/Consultation.
- **Key DB Tables:** `insurance_providers`, `insurance_benefit_plans`, `insurance_benefit_categories`, `insurance_contracted_prices`, `encounters`, `sha_claims`.
- **Business Rules Enforced:**
  - Visit frequency limits enforced via `enforce_insurance_visit_limit()` trigger.
  - Automatic pricing engine overrides baseline cash catalog prices with insurer contracted tariffs (`get_contracted_price()` RPC).
  - SHA fund types (`phf`, `shif`, `eccif`) automatically classified based on facility level and service room via `set_sha_fund_type()`.
- **Edge Cases Handled:**
  - Expired / Suspended policy: Agent can reject clearance, prompting system to seamlessly convert encounter to cash mode with full invoice recalculation.
  - Co-pay waiver workflows with mandatory supervisor sign-off.

---

### Module 6: Consultation / Clinical
- **Purpose:** The core clinical diagnostic and therapeutic workstation for outpatient and inpatient clinician workflows.
- **Primary Roles:** `doctor`, `clinical_officer`, `dental_officer`.
- **Key Workflows:**
  1. Clinician reviews patient past medical history, previous visits, allergy alerts, and triage vitals.
  2. Documents Chief Complaints, History of Present Illness, Physical Examination, and Treatment Plans in `clinical_notes`.
  3. Searches live WHO ICD-11 database via `icd11-search` edge function and attaches primary and secondary diagnoses to `encounter_diagnoses`.
  4. Orders diagnostic tests (Lab / Radiology) and prescribes pharmaceutical regimens.
  5. Initiates inpatient ward admission if required.
  6. Finalizes and electronically signs encounter (`sign_encounter` permission), cryptographically locking records.
- **Key DB Tables:** `clinical_notes`, `encounter_diagnoses`, `lab_orders`, `radiology_orders`, `prescriptions`, `admissions`, `encounters`.
- **Business Rules Enforced:**
  - At least one valid ICD-11 diagnosis code required before signing encounter.
  - Encounter signing irreversibly locks clinical notes, diagnoses, and orders (`enforce_encounter_lock()` trigger).
  - Only authorized clinical roles (`doctor`, `clinical_officer`, `dental_officer`, `admin`) can execute encounter signing.
- **Edge Cases Handled:**
  - Break-Glass emergency override allows clinicians to view restricted records with mandatory clinical justification (`log_break_glass_access()`).
  - Offline / Uncoded fallback: Assigns provisional `UNCODED` classification with manual description until ICD-11 connection resolves.

---

### Module 7: Laboratory
- **Purpose:** Diagnostic specimen accessioning, bench testing, analyzer result capture, panic-value flagging, and technologist validation.
- **Primary Roles:** `lab_tech`, `staff`, `admin`.
- **Key Workflows:**
  1. Patient arrives at lab; lab tech reviews pending `lab_orders`.
  2. Collects specimen, logs sample collection timestamp, and updates order status to `in_progress`.
  3. Performs diagnostic assay and inputs quantitative/qualitative values into `lab_results`.
  4. System automatically validates results against age/sex reference ranges.
  5. Technologist clicks "Verify & Publish" → Result locked, automated SMS sent to patient, and encounter automatically routed back to ordering clinician room.
- **Key DB Tables:** `lab_orders`, `lab_results`, `lab_test_catalog`, `encounter_room_visits`, `dha_outbound_queue`.
- **Business Rules Enforced:**
  - Automatic invoice line-item generation upon lab test order (`sync_invoice_line_items_from_tests()`).
  - Critical panic values trigger prominent red visual badges on clinician screens.
  - Results publication creates a FHIR Observation resource queued for DHA SHR transmission (`queue_lab_result_fhir()`).
- **Edge Cases Handled:**
  - Hemolyzed / Insufficient Specimen: Technologist rejects specimen with structured reason; system alerts ordering doctor for redraw.

---

### Module 8: Radiology
- **Purpose:** Diagnostic medical imaging order tracking, modality examination management, radiologist reporting, and PACs/film handover.
- **Primary Roles:** `radiologist`, `doctor`, `admin`.
- **Key Workflows:**
  1. Imaging requisition received in radiology queue (`radiology_orders`).
  2. Radiographer completes scan (X-Ray, Ultrasound, CT, MRI, ECG).
  3. Radiologist inputs structured radiological interpretation, organ findings, and conclusion in `radiology_results`.
  4. Radiologist signs report → Order status set to `completed`.
  5. Automated SMS alert sent to patient and encounter auto-returned to requesting doctor (`send_radiology_results_to_requesting_room()`).
- **Key DB Tables:** `radiology_orders`, `radiology_results`, `rooms`, `invoices`, `invoice_line_items`.
- **Business Rules Enforced:**
  - Automatic billing line item synchronization upon imaging requisition (`sync_invoice_line_item_from_radiology()`).
  - Modification locked once report is signed by radiologist.
- **Edge Cases Handled:**
  - Repeat exposures or contrast surcharge additions automatically append supplemental line items to invoice.

---

### Module 9: Pharmacy
- **Purpose:** Outpatient and inpatient prescription validation, contraindication screening, batch-specific drug dispensing, and automated inventory deduction.
- **Primary Roles:** `pharmacist`, `admin`.
- **Key Workflows:**
  1. Pharmacist opens prescription queue filtered by pending orders (`prescriptions.status = 'pending'`).
  2. Verifies drug strength, dosage, route, and interaction profile.
  3. Verifies invoice payment or insurance clearance before dispensing.
  4. Selects physical drug batch and clicks "Dispense".
  5. System marks prescription `dispensed`, logs `dispensed_at` and `dispensed_by`, and automatically decrements inventory from Pharmacy Store.
- **Key DB Tables:** `prescriptions`, `stock_items`, `stock_movements`, `invoices`, `invoice_line_items`.
- **Business Rules Enforced:**
  - Stock Guard: Dispensing blocked if warehouse available quantity < requested quantity (`dispense_prescription_stock()` trigger).
  - ICU prescriptions are segregated: General pharmacy cannot dispense ICU store medications (`sprint13b_dispense_stock_guard.sql`).
  - Dispense event automatically queues a FHIR `MedicationDispense` resource (`trg_medication_dispense_fhir()`).
- **Edge Cases Handled:**
  - Partial dispensing: Pharmacist dispenses available units and leaves remainder pending for subsequent replenishment.
  - Drug substitution / Generic switch with mandatory clinician consultation note.

---

### Module 10: Inpatient (Wards + ICU + Dialysis)
- **Purpose:** Complete inpatient lifecycle management across General Wards, Maternity, Pediatrics, Surgical units, Intensive Care Units, and Hemodialysis units.
- **Primary Roles:** `nurse`, `icu_nurse`, `dialysis_nurse`, `doctor`, `clinical_officer`, `admin`.
- **Key Workflows:**
  1. **Admission:** Doctor issues admission order → Patient assigned ward and bed (`admissions`, `beds.status = 'occupied'`).
  2. **Ward Care:** Nurses record vitals, administer scheduled drugs in Medication Administration Record (`medication_administrations`), and log nursing notes.
  3. **ICU Unit:** ICU nurses maintain hourly charts (`icu_hourly_charts`) tracking arterial pressures, ventilator parameters (PEEP, FiO2, VT), RASS sedation scores, and direct ICU store drug dispensing.
  4. **Dialysis Unit:** Renal nurses log sessions (`dialysis_sessions`), dialyzer models, pre/post weights, BFR, and consumed dialyzer consumables, auto-billed via `process_dialysis_session_billing()`.
  5. **Discharge:** Doctor completes mandatory discharge summary (`require_discharge_summary()`), pharmacy reconciles take-home drugs, accountant clears bill, and bed is reset to `available`.
- **Key DB Tables:** `admissions`, `wards`, `beds`, `icu_hourly_charts`, `dialysis_sessions`, `medication_administrations`, `invoices`.
- **Business Rules Enforced:**
  - Nightly cron job (`accrue_daily_bed_charges()`) accrues daily bed fees at 00:00 EAT.
  - Admitting to ICU automatically applies one-off ICU admission fee (`charge_icu_admission_fee()`).
  - Discharge blocked without comprehensive discharge summary text.
- **Edge Cases Handled:**
  - Inter-ward bed transfers: Automatically updates ward assignment, recalibrates daily bed rates, and logs audit trigger (`audit_ward_transfers`).

---

### Module 11: Mortuary
- **Purpose:** Cold-room storage management, body intake logging (internal ward deaths vs. external police/home cases), preservation tracking, post-mortem records, and body release billing.
- **Primary Roles:** `mortician`, `accountant`, `admin`.
- **Key Workflows:**
  1. **Intake:** Mortician admits body, assigns sequential mortuary reference (`assign_mortuary_reference()`), records body source (`internal` vs. `external`), next-of-kin, and cold storage slot.
  2. **Preservation & Services:** Logs embalming, post-mortem examination, post-mortem pathology notes, and dressing requests.
  3. **Daily Accrual:** Nightly daemon (`accrue_daily_mortuary_charges()`) posts daily refrigeration charges to mortuary invoice.
  4. **Handover & Release:** Next-of-kin presents national ID and burial permit, accountant verifies invoice clearance, and mortician executes formal body release.
- **Key DB Tables:** `mortuary_records`, `invoices`, `invoice_line_items`, `rooms`.
- **Business Rules Enforced:**
  - External body intake automatically provisions a dedicated mortuary invoice linked to next-of-kin (`create_external_mortuary_invoice()`).
  - Daily storage rate applied every 24 hours until `released_at` timestamp is committed.
  - Body release strictly locked until invoice balance reaches zero or an authorized waiver is applied.
- **Edge Cases Handled:**
  - Unclaimed bodies / State medical examiner cases: Flagged with police OB number and exempted from automated standard billing accruals.

---

### Module 12: Billing & Accounting
- **Purpose:** Core financial engine handling ledger balances, multi-channel payment collections, supervisor waivers, credit note adjustments, and cashier cash drawer closures.
- **Primary Roles:** `accountant`, `admin`, `director`.
- **Key Workflows:**
  1. Cashier searches invoice by patient file number, invoice number, or encounter ID.
  2. Reviews itemized billable line items (consultations, lab, imaging, drugs, bed days, procedures).
  3. Selects payment method (Cash, M-Pesa, Credit Card, Bank Transfer, Insurance Guarantee).
  4. Submits payment → System records `invoice_payments`, recalculates invoice balance, issues receipt number, and sends SMS receipt.
  5. Performs End-of-Day (EOD) reconciliation reconciling cash collections against system totals.
- **Key DB Tables:** `invoices`, `invoice_line_items`, `invoice_payments`, `encounters`.
- **Business Rules Enforced:**
  - Real-time balance integrity maintained via PostgreSQL triggers (`recalc_invoice_payments()`, `recalc_invoice_totals()`).
  - Invoice balance = `amount_total` - `amount_paid` - `waiver_amount`.
  - Cashier payment reversal strictly locked—requires accounting supervisor credit note transaction.
- **Edge Cases Handled:**
  - Overpayment handling: Automatically calculates change or holds overpayment as patient unallocated credit for future visits.

---

### Module 13: Invoices
- **Purpose:** Master fiscal ledger maintaining real-time itemized accounting for every billable clinical and administrative transaction.
- **Primary Roles:** `accountant`, `admin`, `insurance_agent`, `receptionist`.
- **Key Workflows:**
  1. Encounter creation automatically provisions linked master invoice (`create_invoice_for_encounter()`).
  2. Downstream clinical actions (lab orders, imaging orders, pharmacy dispenses, bed stays) dynamically attach line items via database triggers.
  3. Invoices display real-time status: `draft`, `pending`, `partial`, `paid`, `waived`, `claimed`.
  4. Printable MoH compliant invoice generated with institutional letterhead, tax registration, and KMHFL codes.
- **Key DB Tables:** `invoices`, `invoice_line_items`, `invoice_payments`, `patients`.
- **Business Rules Enforced:**
  - Immutability of line-item amounts once payment is applied against them.
  - Strict foreign key constraints binding every line item to its parent invoice and source clinical order.
- **Edge Cases Handled:**
  - Split billing: Supports encounters split across insurance coverage caps with residual balances routed to self-pay cash invoices.

---

### Module 14: Stock Management
- **Purpose:** Multi-location inventory warehouse management, supplier delivery receiving, batch tracking, inter-store transfer requisitions, and departmental consumption tracking.
- **Primary Roles:** `store_keeper`, `pharmacist`, `lab_tech`, `admin`.
- **Key Workflows:**
  1. Storekeeper receives commercial vendor shipment in Main Store (`a0000000-0000-0000-0000-000000000001`), logging batch number, expiry date, purchase cost, and quantity in `stock_deliveries`.
  2. Department heads (Pharmacy, ICU, Dialysis, Lab) submit transfer requests.
  3. Storekeeper approves and dispatches items (`transfer_stock_between_locations()` RPC).
  4. Clinical usage logged directly at bedside or during procedures (`record_stock_usage()` RPC).
  5. System generates automated stock valuation ledgers and reorder alerts.
- **Key DB Tables:** `stock_items`, `stock_locations`, `stock_movements`, `stock_transfers`, `stock_deliveries`, `stock_usage`, `user_stock_location_access`.
- **Business Rules Enforced:**
  - Double-entry stock ledger: Every physical quantity change demands a corresponding immutable row in `stock_movements`.
  - Negative inventory strictly prevented via database check constraints.
  - Sub-location access controlled via `grant_stock_location_access()` security matrix.
- **Edge Cases Handled:**
  - Damaged / Expired stock write-offs: Logged under `adjustment` movement type with mandatory supervisory reason notes.

---

### Module 15: Appointments
- **Purpose:** Forward scheduling for outpatient specialist clinics (GOPC, SOPC, MCH/ANC, Dental, Eye Clinic, Physiotherapy, Nutrition), managing clinic capacities and automated patient reminders.
- **Primary Roles:** `receptionist`, `nurse`, `doctor`, `records_officer`.
- **Key Workflows:**
  1. Staff schedules booking specifying patient, target clinician/clinic room, appointment date, time window, and clinical indication.
  2. System records entry in `appointments` and calculates start/end ranges via `set_appointment_time_range()`.
  3. Automated SMS reminder queued for delivery 24 hours prior to appointment.
  4. Patient arrives on scheduled date → Receptionist clicks "Check-In" → System converts booking into active clinical encounter via `create_encounter_from_appointment()`.
- **Key DB Tables:** `appointments`, `encounters`, `rooms`, `patients`.
- **Business Rules Enforced:**
  - Double-booking prevention guards on individual practitioner calendars.
  - Automatic status transitions: `scheduled` → `checked_in` → `completed` / `cancelled` / `no_show`.
- **Edge Cases Handled:**
  - Walk-in patient prioritization during clinic sessions without displacing booked appointments.

---

### Module 16: Reports (MOH + Finance + Clinical)
- **Purpose:** Comprehensive institutional business intelligence and statutory epidemiological compliance reporting engine.
- **Primary Roles:** `records_officer`, `accountant`, `director`, `admin`.
- **Key Workflows:**
  1. **MOH Statutory Reports:** Records officer selects reporting month and executes `get_moh_705_report(start_date, end_date, '705A')` for under-5 morbidity or `'705B'` for over-5 morbidity.
  2. **Financial Reports:** Accountant generates Revenue Ledgers, Departmental Sales, Cashier Collections, Insurance Aging, and Waiver Summaries.
  3. **Clinical Reports:** Clinicians analyze Disease Incidence Trends, Lab Test Yields, Inpatient Length of Stay, and Mortality Rates.
  4. One-click export to CSV and formatted printable PDF.
- **Key DB Tables:** `moh_monthly_aggregates`, `encounter_indicator_tags`, `moh_indicator_definitions`, `invoices`, `encounters`.
- **Business Rules Enforced:**
  - Two-layer tagging architecture ensures 100% automated indicator compilation without manual tally sheets.
  - Demographics (Under 5, Over 5, Gender, New vs. Revisit) tagged universally on every encounter.
- **Edge Cases Handled:**
  - Historical retrospective aggregate recalculation supported via `refresh_moh_aggregates(target_month)`.

---

### Module 17: Admin
- **Purpose:** Centralized facility configuration suite managing hospital metadata, master price tariffs, clinical test templates, rooms, wards, beds, medical machines, and user roles.
- **Primary Roles:** `admin`, `system_admin`.
- **Key Workflows:**
  1. **Facility Settings:** Configures KMHFL code, SHA facility ID, facility level, contact info, and operational parameters.
  2. **User & Access Management:** Invites staff, approves accounts, and assigns roles (`user_roles`) and permissions (`role_permissions`).
  3. **Room & Ward Rosters:** Creates consultation suites, wards, and beds with associated base rates.
  4. **Machine Registers:** Logs biomedical equipment (`machines`) and schedules preventative maintenance (`machine_logs`).
  5. **Tariffs & Pricing:** Sets master prices and insurer-contracted rate schedules.
- **Key DB Tables:** `app_settings`, `profiles`, `user_roles`, `role_permissions`, `rooms`, `wards`, `beds`, `machines`, `machine_logs`, `facility_features`.
- **Business Rules Enforced:**
  - Self-demotion guard: Administrators cannot revoke their own admin permissions.
  - Facility level gating: Modules automatically disabled if facility MoH level does not support them (e.g., ICU locked for Level 2/3).
- **Edge Cases Handled:**
  - Emergency user deactivation instantly terminates active Supabase Auth sessions.

---

### Module 18: Audit Log
- **Purpose:** Immutable forensic logging providing complete accountability, regulatory data protection compliance, and tamper-evident operational trails.
- **Primary Roles:** `admin`, `system_admin`, `director`.
- **Key Workflows:**
  1. System triggers (`audit_trigger_fn()`) capture every database mutation across 15+ core tables.
  2. Writes immutable record containing actor UUID, timestamp, action type (`INSERT`, `UPDATE`, `DELETE`, `BREAK_GLASS`), table name, record ID, and before/after JSON data.
  3. Administrators review filtered security feeds in the UI (`/admin/audit-log`).
  4. Nightly daemon (`archive_old_audit_logs()`) moves records older than 2 years to `audit_log_archive` for 20-year statutory retention.
- **Key DB Tables:** `audit_log`, `audit_log_archive`, `audit_archive_runs`.
- **Business Rules Enforced:**
  - Append-only security: Explicit RLS policies reject all manual `UPDATE` and `DELETE` queries on `audit_log` and `audit_log_archive`.
- **Edge Cases Handled:**
  - Automated tracking and notification of emergency break-glass electronic record access.

---

### Module 19: Dashboard + System Health
- **Purpose:** Real-time executive situational awareness, operational clinical monitoring, financial summary KPIs, and backend system health metrics.
- **Primary Roles:** `director`, `admin`, `accountant`, `doctor`.
- **Key Workflows:**
  1. Dashboard loads live clinical throughput cards (Today's Registrations, Active Inpatients, Lab Queue, Pharmacy Queue).
  2. Visualizes epidemiological disease trends via `dashboard_top_diseases()` RPC.
  3. Displays 7-day OPD vs. Admitted trends via `dashboard_admitted_opd_trend()`.
  4. Monitors system health (Supabase connection, Edge Function response latency, SMS gateway credit balance).
- **Key DB Tables:** `encounters`, `admissions`, `invoices`, `lab_orders`, `prescriptions`, `app_settings`.
- **Business Rules Enforced:**
  - Role-gated dashboard views: Financial revenue cards hidden from clinical-only staff roles.
- **Edge Cases Handled:**
  - Graceful degradation to cached summary snapshots during heavy database workload spikes.

---

## 4. Integration Points

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                AEGISCARE HMS INTEGRATIONS                                   │
├─────────────────────────┬─────────────────────────┬───────────────────┬─────────────────────┤
│ Service / Platform      │ Protocol / Standard     │ Status            │ Key Functionality   │
├─────────────────────────┼─────────────────────────┼───────────────────┼─────────────────────┤
│ Africa's Talking SMS    │ REST HTTP (Form/JSON)   │ ✅ Production     │ OTP, Lab & Bills    │
│ WHO ICD-11 Cloud API    │ REST OAuth2 (MMS)       │ ✅ Production     │ Real-time Diagnosis │
│ Kenya DHA AfyaLink HIE  │ FHIR R4 REST API        │ ⏳ Stubs Ready    │ National SHR Sync   │
│ SHA Claims API          │ FHIR R4 / JSON API      │ ⏳ Stubs Ready    │ Claim Dispatch      │
│ IPRS National Identity  │ REST HTTPS / DHA Proxy  │ ⏳ Stubs Ready    │ Citizen ID Verify   │
│ Safaricom M-Pesa Daraja │ REST HTTPS (STK Push)   │ 📋 Planned (Ph 3) │ Mobile Cashier Pay  │
└─────────────────────────┴─────────────────────────┴───────────────────┴─────────────────────┘
```

### 1. Africa's Talking SMS Gateway
- **Status:** ✅ Active & Verified in Production.
- **Configuration:** Supabase secrets `AT_USERNAME`, `AT_API_KEY`.
- **Functionality:** 
  - Standardizes telephone numbers to Kenyan international format (`+254...`).
  - Dispatches OTP verification tokens during patient intake.
  - Sends automated diagnostic test completion alerts when lab/radiology reports are signed.
  - Employs sandbox endpoint when username is configured as `sandbox`.

### 2. WHO ICD-11 Cloud API
- **Status:** ✅ Active & Operational.
- **Configuration:** Supabase secrets `ICD_CLIENT_ID`, `ICD_CLIENT_SECRET`.
- **Functionality:**
  - Executes OAuth2 Client Credentials authentication against WHO servers with automated in-memory token caching.
  - Performs flexisearch against ICD-11 MMS (Mortality & Morbidity Statistics) 2024 linearization.
  - Strips HTML markup and normalizes diagnostic titles for clean clinical display and indexing.

### 3. DHA AfyaLink National HIE (Shared Health Record)
- **Status:** ⏳ Architectural Stubs Built & Certification Ready (Awaiting National HIE Gateway Credentials).
- **Functionality:**
  - Compiles FHIR R4 Bundle resources containing Patient, Encounter, Condition, and MedicationDispense resources.
  - Transmits payloads via `dha_outbound_queue` with automated retry, backoff, and mediator transaction tracking.
  - Governed by patient consent verification (`hie_data_sharing_consented = true`).

### 4. Social Health Authority (SHA) Claims API
- **Status:** ⏳ Architectural Stubs Built & Database Foundation Complete.
- **Functionality:**
  - Evaluates encounter diagnoses, procedures, and pharmaceutical items against SHA tariff schedules.
  - Automatically compiles standard FHIR `Claim` resources (`build_fhir_claim()` RPC).
  - Handles SHIF, PHF, and ECCIF benefit package allocations and pre-authorization linkages.

### 5. Safaricom M-Pesa Daraja API
- **Status:** 📋 Planned for Phase 3 Roadmap.
- **Functionality:**
  - Direct cashier STK Push prompts to patient mobile phones.
  - Real-time C2B payment validation callbacks automatically clearing invoice balances.

---

## 5. Security & Compliance

### 1. Row-Level Security (RLS) Policies
AegisCare enforces PostgreSQL Row-Level Security across all 35+ relational database tables.
- **User Approval Gate:** All access demands `public.is_approved(auth.uid()) = true`. Unapproved user accounts cannot read or write any clinical data.
- **Role-Based Permissions:** Data mutations require explicit roles verified via `public.has_role()` or permissions evaluated via `public.user_has_permission()`.
- **Departmental Room Security:** Room clinical data restricted to assigned practitioners via `public.can_access_room()`.
- **Append-Only Auditing:** Audit tables strictly reject direct client-side `INSERT`, `UPDATE`, and `DELETE` operations.

### 2. Kenya Data Protection Act (ODPC) Compliance
- **Consent by Default:** Clinical data capture demands documented consent.
- **Two-Factor Digital Verification:** OTP SMS consent mechanism validates citizen authorization.
- **Purpose Specification & Access Minimization:** Practitioners only see clinical fields necessary for their functional department.

### 3. Break-Glass Emergency Access
- In acute trauma or unconscious emergency scenarios where patient consent cannot be acquired, authorized doctors and clinical officers can invoke **Break Glass Access**.
- The clinician must provide an explicit, mandatory written medical justification.
- The system immediately invokes `log_break_glass_access()`, writing an immutable `BREAK_GLASS` security event in `audit_log` capturing accessor email, timestamp, and justification.

### 4. Audit Logging & 20-Year Archival Retention
- Every database insert, update, and delete on patient records, diagnoses, prescriptions, lab results, and financial invoices triggers `audit_trigger_fn()`.
- Nightly scheduled daemons (`archive_old_audit_logs()`) move records exceeding two years to `audit_log_archive` to meet Kenya's statutory 20-year medical record retention standard.

---

## 6. Cron Jobs (Automated Background Daemons)

AegisCare utilizes `pg_cron` inside PostgreSQL to manage mission-critical background hospital operations:

```sql
-- 1. Accrue Daily Inpatient Ward Bed Charges (Nightly at 00:01 EAT = 21:01 UTC)
SELECT cron.schedule('accrue-bed-charges-nightly', '1 21 * * *',
  $$ SELECT public.accrue_daily_bed_charges(); $$
);

-- 2. Accrue Daily Mortuary Cold Storage Charges (Nightly at 00:05 EAT = 21:05 UTC)
SELECT cron.schedule('accrue-mortuary-charges-nightly', '5 21 * * *',
  $$ SELECT public.accrue_daily_mortuary_charges(); $$
);

-- 3. Archive Stale Audit Logs to Long-Term Storage (Nightly at 02:00 EAT = 23:00 UTC)
SELECT cron.schedule('archive-audit-logs-nightly', '0 23 * * *',
  $$ SELECT public.archive_old_audit_logs(); $$
);
```

### Daemon Functions:
1. `accrue_daily_bed_charges()`: Iterates over all active inpatient admissions (`status = 'admitted'`), queries the ward's daily rate, and appends a `bed_day` line item to the patient's open invoice.
2. `accrue_daily_icu_charges()`: Applies specialized intensive care monitoring daily surcharges for patients admitted to ICU wards.
3. `accrue_daily_mortuary_charges()`: Iterates over non-released mortuary records, calculating daily refrigeration storage fees and appending them to the mortuary invoice.
4. `archive_old_audit_logs()`: Identifies audit entries older than 2 years, copies them into `audit_log_archive`, purges them from the operational `audit_log` table, and logs the batch run metrics in `audit_archive_runs`.

---

## 7. Supabase Edge Functions

| Function Name | Runtime | Method | Purpose & Integration |
|---|---|---|---|
| `send-sms` | Deno / TS | `POST` | Dispatches SMS via Africa's Talking API for OTPs and lab completion alerts. Formats numbers to `+254...`. |
| `icd11-search` | Deno / TS | `POST` | Proxies live search requests to WHO ICD-11 API with server-side OAuth2 caching and HTML stripping. |
| `claims-dispatcher` | Deno / TS | `POST` | Evaluates completed encounters, builds FHIR claim payloads, and inserts them into `dha_outbound_queue`. |
| `fhir-patient` | Deno / TS | `POST` | Compiles a FHIR R4 `Patient` resource from database patient demographics. |
| `fhir-encounter` | Deno / TS | `POST` | Generates a FHIR R4 `Encounter` resource including class, diagnoses, and service provider. |
| `fhir-condition` | Deno / TS | `POST` | Generates an array of FHIR R4 `Condition` resources mapped to ICD-11 URIs. |
| `fhir-bundle` | Deno / TS | `POST` | Compiles a full FHIR R4 `Bundle` (type=collection) for DHA SHR submission. |

---

## 8. Known Limitations & Pending Items

- ⏳ **DHA AfyaLink Production Credentials:** Outbound HIE synchronization queues payloads locally in `dha_outbound_queue` awaiting DHA production gateway endpoint access.
- ⏳ **SHA Biometric Smart Reader Hardware:** Frontend UI components architected; physical USB smart-card / biometric scanner drivers scheduled for Phase 3 field testing.
- ⏳ **Safaricom M-Pesa STK Push Gateway:** Cashier payment workflow currently supports manual M-Pesa reference capture; automated STK push API integration planned for Phase 3.
- ⏳ **NLMIS Supply Chain Auto-Sync:** Pharmaceutical inventory supports NLMIS commodity codes; automated national KEMSA/NLMIS stock balance reporting currently requires manual CSV export.

---

## 9. Future Roadmap

```
┌───────────────────────────────────────────────────────────────────────────────────────┐
│                              AEGISCARE HMS ROADMAP                                    │
├──────────────────────────┬──────────────────────────┬─────────────────────────────────┤
│ Phase 1 (Completed ✅)    │ Phase 2 (Current ⏳)      │ Phase 3 (Planned 📋)            │
├──────────────────────────┼──────────────────────────┼─────────────────────────────────┤
│ - Core OPD / IPD Clinical│ - DHA Certification      │ - M-Pesa STK Push Integration   │
│ - Pharmacy & Multi-Store │ - SHA FHIR Claim Testing │ - Biometric Hardware Drivers    │
│ - Lab & Radiology Flow   │ - Outbound Queue Workers │ - Telemedicine Video Suite      │
│ - ICU & Dialysis Units   │ - Multi-Facility Rollout │ - AI Clinical Decision Support  │
│ - Mortuary Management    │ - MOH 705/717 Auto-Sync  │ - Patient Mobile Portal App     │
│ - Africa's Talking SMS   │                          │ - Offline Sync PWA Node         │
│ - WHO ICD-11 Search      │                          │                                 │
└──────────────────────────┴──────────────────────────┴─────────────────────────────────┘
```
