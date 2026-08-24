# AegisCare HMS — Role-Based User Manual

**Document Title:** Standard Operating Procedures & Role-Based User Manual  
**Document Version:** 1.0.0  
**Target Audience:** Clinical, Administrative, and Financial Hospital Staff  
**Applicable Facilities:** Kenya MoH Level 1–6 Facilities  

---

## Manual Structure & Table of Contents

1. [Receptionist](#1-receptionist)
2. [Insurance Agent](#2-insurance-agent)
3. [Triage Nurse](#3-triage-nurse)
4. [Doctor / Clinical Officer](#4-doctor--clinical-officer)
5. [Laboratory Technician](#5-laboratory-technician)
6. [Radiologist / Radiographer](#6-radiologist--radiographer)
7. [Pharmacist](#7-pharmacist)
8. [ICU Nurse](#8-icu-nurse)
9. [Dialysis Nurse](#9-dialysis-nurse)
10. [Accountant / Cashier](#10-accountant--cashier)
11. [Mortician](#11-mortician)
12. [Store Keeper](#12-store-keeper)
13. [System Administrator (Admin)](#13-system-administrator-admin)
14. [Medical Director / Executive Management](#14-medical-director--executive-management)

---

## 1. Receptionist

---

### Task 1.1: Register a New Patient & Capture Digital Consent OTP
**Who:** `receptionist`, `records_officer`  
**Steps:**
1. Log into AegisCare HMS and navigate to **Register Patient** (`/register-patient`) on the main navigation bar.
2. In the **Patient Identification** section, enter the patient's National ID, Passport Number, or Birth Certificate Number (for minors).
3. Fill in the demographic details:
   - Full Legal Name (First Name, Middle Name, Family Name).
   - Date of Birth (or check *Unknown DOB* and enter *Estimated Age*).
   - Gender / Biological Sex (`Male` / `Female`).
   - Mobile Phone Number (Must be formatted as `07...` or `01...` or `+254...`).
   - County of Residence and Residential Sub-County / Estate / Town.
   - Next of Kin Full Name, Relationship, and Contact Telephone.
4. In the **Consent Verification (ODPC Compliance)** section:
   - Click **Send Consent OTP SMS**.
   - An automated SMS containing a 6-digit numeric verification code is dispatched immediately via Africa's Talking to the patient's phone.
   - Request the 6-digit code from the patient and type it into the **Enter OTP Code** field.
   - Click **Verify & Accept Consent**. The status badge will change to a green **Verified & Consented** banner.
5. In the **Encounter & Payment Setup** section:
   - Select **Payment Mode**: `Cash`, `SHA SHIF / PHF`, `Private Insurance`, `Corporate Scheme`, or `Government Exemption`.
   - If Insurance or SHA: Select the provider and scheme, and input the Member / Policy Number.
   - Check the **Emergency Case** checkbox if the patient presents in acute clinical distress.
6. In the **Destination Room** dropdown, select the next operational station:
   - For Cash patients: Select **Triage** (or **Consultation Room** if pre-triaged).
   - For Insurance / SHA patients: Select **Insurance Desk**.
   - For Acute Emergencies: Select **Resuscitation / Casualty Room**.
7. Click **Complete Registration & Open Encounter**.
8. The system generates a permanent **Patient File Number** (e.g., `P000248`), opens an active encounter, generates a blank master invoice, and routes the patient's name to the live queue of the selected room.

**Notes:**
- ⚠️ *Emergency Override:* If a patient is unconscious, severely traumatized, or in shock and cannot receive an SMS OTP, check the **Emergency Intake Bypass** toggle. You must provide a brief mandatory justification note. The encounter will proceed immediately, and consent must be regularized upon patient stabilization.
- Ensure the phone number is verified carefully; critical lab panic alerts and digital payment receipts are delivered to this number.

---

### Task 1.2: Check-In a Returning Patient (Revisit)
**Who:** `receptionist`, `records_officer`  
**Steps:**
1. Navigate to **Patients** (`/patients`) or use the global top search bar.
2. Search for the returning patient by **File Number**, **National ID**, **Phone Number**, or **Name**.
3. Click on the patient record to open their master file.
4. Verify demographic details and update phone numbers or residential addresses if changed.
5. Click the **New Encounter** button in the top right corner.
6. Select the **Encounter Type** (`Outpatient`, `Specialist Clinic`, `Emergency`).
7. Confirm the **Payment Mode** and select the **Destination Room** (e.g., Triage, Insurance Desk, or MCH Clinic).
8. Click **Start Encounter**. The encounter is automatically categorized as an `OPD_REVISIT` for statutory MoH epidemiological reporting.

**Notes:**
- Never create a duplicate master file for an existing patient. Always search the central repository first to preserve longitudinal medical history.

---

### Task 1.3: Check-In an Appointment Booking
**Who:** `receptionist`  
**Steps:**
1. Navigate to **Appointments** (`/appointments`).
2. Review the daily calendar or list view for scheduled patients.
3. Locate the arriving patient and verify their identity.
4. Click the **Check-In** action button next to their booking.
5. Confirm the payment mode and destination room.
6. Click **Confirm Arrival**. The system invokes `create_encounter_from_appointment`, transitions the appointment status to `checked_in`, creates an active clinical encounter, and sends the patient to the assigned clinician's waiting room.

**Notes:**
- If the patient fails to show up by clinic close, click **Mark No-Show** to release the clinician's calendar slot.

---

## 2. Insurance Agent

---

### Task 2.1: Process Insurance Clearance (SHA / Private / Corporate)
**Who:** `insurance_agent`, `accountant`  
**Steps:**
1. Navigate to **Admin → Insurance Clearance** or open the **Insurance Desk** room queue (`/admin/insurance`).
2. Select a patient from the **Waiting for Clearance** queue.
3. Review the patient's insurance details:
   - Underwriter Name (e.g., Social Health Authority, Jubilee, Britam, CIC, APA).
   - Scheme / Benefit Plan (e.g., SHA Outpatient, Corporate Comprehensive, Executive Inpatient).
   - Policy / Member Number.
4. **Eligibility Check:**
   - For SHA: Verify active member status on the SHA portal / NHIF legacy terminal.
   - For Private / Corporate: Verify physical/digital smart card, biometric validity, and active member status on the insurer's portal.
5. **Pre-Authorization (Preauth):**
   - If the visit involves specialized procedures, MRI/CT imaging, or inpatient admission, input the approved **Pre-Authorization Code** provided by the insurer into the preauth field.
6. **Co-Payment:**
   - If the plan requires a fixed co-pay (e.g., KSh 500), verify the co-pay amount. The system automatically appends a co-pay line item to the patient's invoice.
7. Click **Approve Clearance**.
8. Select the destination room (e.g., **Triage** or **Doctor Consultation Room**) and click **Dispatch Patient**.
9. The encounter status changes to `insurance_status = 'cleared'`, unlocking doctor consultations, lab orders, and pharmacy dispenses under contracted insurance tariffs.

**Notes:**
- ⚠️ *Visit Limit Warnings:* If a patient has exceeded their monthly or annual insurance visit cap, the system trigger `enforce_insurance_visit_limit` will display an on-screen alert. Do not approve clearance without documented authorization from the underwriter.

---

### Task 2.2: Reject Clearance & Switch Patient to Cash Mode
**Who:** `insurance_agent`  
**Steps:**
1. If the patient's insurance policy is lapsed, invalid, exhausted, or rejected by the underwriter:
2. Click **Reject Clearance** on the insurance clearance panel.
3. Select a structured rejection reason (e.g., `Policy Inactive / Expired`, `Benefit Limit Exhausted`, `Service Not Covered`, `Dependent Not Registered`).
4. Click **Convert Encounter to Cash**.
5. Inform the patient politely that the insurer has declined coverage.
6. Route the patient to the **Cashier / Triage** for cash-mode processing. The billing engine instantly switches price lookups from contracted insurance tariffs to standard cash prices.

**Notes:**
- Always document the underwriter's rejection reference code in the notes field for future dispute resolution.

---

### Task 2.3: Track & View SHA / Insurance Claim Status by Date
**Who:** `insurance_agent`, `accountant`  
**Steps:**
1. Navigate to **Insurance & SHA Claims** (`/admin/insurance`).
2. Use the date range picker to filter claims by admission, discharge, or submission date.
3. Filter claims by status:
   - `draft`: Encounter concluded, claim pending review.
   - `pending`: Queued in `dha_outbound_queue` awaiting transmission.
   - `submitted`: Transmitted to SHA / Insurer clearinghouse.
   - `approved`: Underwriter approved payment.
   - `rejected`: Underwriter query or rejection.
4. Click on any claim ID to inspect itemized diagnostic line items, attached ICD-11 codes, and the compiled FHIR Claim resource JSON bundle.

**Notes:**
- For queried claims, review the adjudicator notes, attach requested medical reports or lab results, and click **Re-Queue Claim**.

---

## 3. Triage Nurse

---

### Task 3.1: Capture Patient Vital Signs & Acuity Assessment
**Who:** `triage_nurse`, `nurse`  
**Steps:**
1. Open **Queue** (`/queue`) and switch to your assigned **Triage Room**.
2. Select the next patient listed under **Waiting** and click **Call Patient**.
3. Measure and enter physiological parameters:
   - **Blood Pressure (BP):** Systolic and Diastolic in mmHg (e.g., `120` / `80`).
   - **Pulse / Heart Rate:** Beats per minute (e.g., `76` bpm).
   - **Body Temperature:** Degrees Celsius (e.g., `36.8` °C).
   - **Respiratory Rate:** Breaths per minute (e.g., `18` /min).
   - **Oxygen Saturation (SpO2):** Percentage on room air (e.g., `98` %).
   - **Random Blood Sugar (RBS):** In mmol/L (if clinically indicated or diabetic).
   - **Weight (kg) & Height (cm):** System automatically calculates BMI and displays nutritional status.
4. **Pediatric Assessment (For Patients Under 5 Years):**
   - Enter **MUAC (Mid-Upper Arm Circumference)** in centimeters:
     - 🔴 Red (<11.5 cm): Severe Acute Malnutrition (SAM).
     - 🟡 Yellow (11.5–12.5 cm): Moderate Acute Malnutrition (MAM).
     - 🟢 Green (>12.5 cm): Normal.
5. **Clinical Acuity Tagging:**
   - Select **Triage Priority**: `Green (Routine)`, `Yellow (Urgent)`, `Red (Immediate Resuscitation)`.
6. Click **Save Vitals & Route Patient**.
7. Select the target **Consultation Room** (e.g., Doctor Room 1, Pediatric Clinic, MCH/FP Clinic, Dental) from the dropdown and click **Send to Doctor**.

**Notes:**
- 🔴 *Panic Vitals:* If Systolic BP >180 mmHg, Temperature >39.5°C, or SpO2 <90%, the system flags a prominent red **Critical Alert**. Escort the patient immediately to the emergency resuscitation room and notify the casualty medical officer verbally.

---

## 4. Doctor / Clinical Officer

---

### Task 4.1: Conduct Clinical Consultation & Review History
**Who:** `doctor`, `clinical_officer`, `dental_officer`  
**Steps:**
1. Open **Queue** (`/queue`) and select your assigned **Consultation Room** (`/rooms/$id`).
2. The waiting list shows triaged patients prioritized by acuity (Red/Yellow/Green) and arrival time.
3. Select the patient and click **Start Consultation**.
4. Review the patient banner:
   - Demographics, Age, Gender, Payment Mode, Allergy Alerts.
   - Live Triage Vitals and computed BMI/MUAC.
   - Past medical history, chronic condition flags, previous clinic visits, and previous prescriptions.
5. In the **Clinical Notes** tab, document structured clinical findings:
   - **Chief Complaints (CC):** Presenting symptoms and duration.
   - **History of Presenting Illness (HPI):** Systematic chronological progression.
   - **Review of Systems (ROS) & Physical Examination (PE):** General examination, systemic findings (CVS, RS, PA, CNS).
   - **Treatment Plan:** Intended clinical management strategy.
6. Click **Save Clinical Notes**.

**Notes:**
- 🔒 *Break-Glass Emergency:* If accessing a restricted or non-consented file during an emergency, click the **Break-Glass** shield button. Enter a mandatory medical justification (e.g., *"Unconscious road traffic accident victim requiring immediate neurotrauma review"*). The file will open instantly and record an immutable security audit event.

---

### Task 4.2: Assign WHO ICD-11 Diagnosis Codes
**Who:** `doctor`, `clinical_officer`, `dental_officer`  
**Steps:**
1. Scroll to the **Diagnoses** section on the consultation workbench.
2. In the **ICD-11 Search Bar**, begin typing the disease name, symptom, or code (minimum 2 characters, e.g., *"Malaria"*, *"Hypertension"*, *"Pneumonia"*).
3. The system queries WHO's live ICD-11 API via the `icd11-search` edge function and displays standardized international search results.
4. Click on the correct matching condition.
5. Select the **Diagnosis Type**:
   - `Primary`: The main condition responsible for this encounter.
   - `Secondary`: Co-existing medical conditions or chronic diseases.
   - `Working`: Provisional clinical hypothesis pending lab/radiology confirmation.
   - `Differential`: Alternative diagnostic possibilities.
6. Click **Add Diagnosis**. The condition is saved in `encounter_diagnoses` with its official ICD-11 MMS URI and description.

**Notes:**
- ⚠️ *MOH Reporting Compliance:* Every encounter must possess at least one primary ICD-11 diagnosis before it can be legally signed.

---

### Task 4.3: Order Diagnostic Investigations (Laboratory & Radiology)
**Who:** `doctor`, `clinical_officer`  
**Steps:**
1. In the **Diagnostic Orders** tab:
   - **To Order Lab Tests:** Search the `lab_test_catalog` (e.g., *Full Hemogram*, *Malaria BS*, *Urinalysis*, *Lipid Profile*, *LFTs*). Check urgent priority if required. Add specific clinical instructions.
   - **To Order Imaging:** Select radiology modality and anatomical site (e.g., *Chest X-Ray PA*, *Abdominal Ultrasound*, *Head CT Plain*). Enter clinical indications.
2. Click **Submit Diagnostic Orders**.
3. The system instantly generates `lab_orders` and `radiology_orders`, attaches billable line items to the patient's invoice, and routes the patient's name to the respective Laboratory and Radiology queue screens.
4. Route the patient physically to the diagnostic departments.

**Notes:**
- When laboratory or imaging results are completed and verified, the patient will automatically re-appear in your room queue with a **Results Ready** notification badge.

---

### Task 4.4: Prescribe Medications & Formulations
**Who:** `doctor`, `clinical_officer`, `dental_officer`  
**Steps:**
1. Navigate to the **Prescriptions** section on the consultation screen.
2. Search for the required drug in the master formulary (e.g., *Amoxicillin/Clavulanic Acid 625mg Tab*, *Paracetamol 500mg Tab*, *Ceftriaxone 1g Inj*).
3. Specify the prescription parameters:
   - **Dose & Formulation:** e.g., `625 mg Tablet`.
   - **Frequency:** e.g., `TID (Three times daily)`, `BID (Twice daily)`, `OD (Once daily)`, `PRN (As needed)`.
   - **Duration:** Number of days (e.g., `7 days`).
   - **Route:** `Oral`, `Intravenous (IV)`, `Intramuscular (IM)`, `Topical`, `Inhalation`.
   - **Special Instructions:** e.g., *"Take with food"*, *"Complete full course"*.
4. Click **Add Prescription**.
5. Repeat for all required medications and click **Submit Prescriptions**.
6. The prescriptions are transmitted to the Pharmacy workbench, and invoice line items are generated automatically.

**Notes:**
- Review the patient's allergy alerts on the top header before prescribing penicillins, NSAIDs, or sulfa drugs.

---

### Task 4.5: Admit Patient to an Inpatient Ward / ICU
**Who:** `doctor`, `clinical_officer`  
**Steps:**
1. If the patient requires inpatient hospitalization, click the **Admit to Ward** button.
2. Select the target **Ward**:
   - *General Male Medical*, *General Female Surgical*, *Maternity*, *Pediatric*, *HDU*, or *Intensive Care Unit (ICU)*.
3. Select an **Available Bed** from the live bed occupancy map.
4. Input the **Admission Diagnosis** (ICD-11) and author the initial **Admission Orders** (nursing instructions, IV fluids, monitoring frequency).
5. Click **Confirm Admission**.
6. The system executes the following:
   - Updates `admissions` table with status `admitted`.
   - Updates bed status to `occupied`.
   - If admitting to ICU: Automatically executes `charge_icu_admission_fee` to post the mandatory one-time ICU admission charge.
   - Routes the electronic chart to the Inpatient Nursing Station.

**Notes:**
- Ensure the ward selected is compatible with the patient's gender and age (e.g., adults cannot be admitted to Pediatric Ward).

---

### Task 4.6: Finalize & Sign Clinical Encounter
**Who:** `doctor`, `clinical_officer`, `dental_officer` (Requires `sign_encounter` permission)  
**Steps:**
1. Once all clinical documentation, diagnoses, lab reviews, and prescriptions are complete:
2. Click the green **Sign & Finalize Encounter** button at the bottom of the clinical screen.
3. The system checks validation constraints:
   - Confirms at least one valid ICD-11 diagnosis exists.
   - Confirms clinical notes are not empty.
4. A confirmation dialog appears: *"Are you sure you want to sign this encounter? This action will cryptographically lock all notes and diagnoses against further changes."*
5. Click **Sign Encounter**.
6. The system:
   - Sets `encounters.status = 'signed'`.
   - Records your digital signature, user ID, and exact timestamp.
   - Irreversibly locks clinical notes, diagnoses, and orders (`enforce_encounter_lock` trigger).
   - Triggers `auto_generate_sha_claim` for SHA-insured patients.
   - Queues FHIR R4 Encounter and Condition resources in `dha_outbound_queue` for national SHR synchronization.
   - Routes patient to **Pharmacy** (for drug collection) or **Cashier** (for final bill settlement).

**Notes:**
- ⚠️ *Immutability:* Once an encounter is signed, it cannot be edited by any staff member. Any supplementary clinical observations must be entered as an addendum in a new encounter.

---

## 5. Laboratory Technician

---

### Task 5.1: Accession Specimens & Enter Laboratory Results
**Who:** `lab_tech`, `staff`  
**Steps:**
1. Open the **Laboratory Workbench** (`/laboratory` or `/laboratory/$id`).
2. The queue displays pending diagnostic orders grouped by patient and urgency.
3. When the patient presents at the lab reception:
   - Verify patient identity against their printed lab requisition or file number.
   - Collect the designated biological sample (e.g., Venous Blood, Urine, Stool, Sputum, Swab).
   - Click **Collect Sample / In Progress**.
4. Perform the analytical assay on the designated laboratory machine or manual bench test.
5. In the laboratory results entry screen:
   - Input the quantitative values (e.g., Hemoglobin `13.4` g/dL, WBC `6.2` x10^9/L, Platelets `250` x10^9/L) or qualitative results (e.g., Malaria BS `No Malaria Parasites Seen`, Urinalysis Protein `Negative`).
   - The system displays standard reference ranges and highlights values outside normal limits with yellow or red flags.
6. Enter technologist remarks or specimen quality notes if applicable.
7. Click **Save Draft Results** to save progress, or proceed to verification.

**Notes:**
- For panic/critical results (e.g., Blood Glucose <2.2 mmol/L, Hemoglobin <5.0 g/dL, Potassium >6.5 mmol/L), call the ordering clinician immediately via internal phone in addition to logging the value in the system.

---

### Task 5.2: Verify Results, Trigger Automated SMS & Auto-Return Patient
**Who:** `lab_tech`  
**Steps:**
1. Review the entered test values for quality control and technical consistency.
2. Click **Verify & Publish Results**.
3. The system executes the following automated workflow atomically:
   - Updates `lab_results.status = 'verified'` and records `verified_by` and `verified_at`.
   - Locks results against further modification.
   - Invokes Edge Function `send-sms` via Africa's Talking to dispatch an automated notification SMS to the patient's phone: *"Dear Patient, your laboratory test results at [Hospital Name] are now ready. Please proceed to your consultation room."*
   - Executes `send_lab_results_to_requesting_room()`, automatically transferring the patient back into the requesting doctor's room queue.
   - Queues FHIR R4 `Observation` resources in `dha_outbound_queue` for DHA SHR transmission.

**Notes:**
- If a specimen is hemolyzed, clotted, or insufficient, click **Reject Specimen**, select the rejection reason, and the ordering clinician will be prompted to request a redraw.

---

## 6. Radiologist / Radiographer

---

### Task 6.1: Process Radiology Order & Finalize Diagnostic Imaging Report
**Who:** `radiologist`, `doctor`  
**Steps:**
1. Navigate to **Radiology** (`/radiology` or `/radiology/$id`).
2. Select a patient from the **Pending Imaging Queue**.
3. Position patient and perform requested modality scan (X-Ray, Ultrasound, CT, MRI, ECG, Mammography).
4. In the **Radiology Report Editor**:
   - Select the **Modality** and **Anatomical Site**.
   - Input structured findings:
     - *Clinical Indications:* (Pre-filled from doctor's order).
     - *Technique / Projection:* e.g., *"Standard Erect Postero-Anterior (PA) view of the chest"*.
     - *Detailed Observations:* Systematic organ review (e.g., lung fields, cardiac silhouette, bony thorax, diaphragmatic costophrenic angles).
     - *Conclusion / Impression:* Concise diagnostic summary (e.g., *"Right lower lobe consolidation consistent with lobar pneumonia. No pleural effusion."*).
5. Click **Finalize & Sign Report**.
6. The system executes:
   - Commits report to `radiology_results`.
   - Sends automated completion SMS to the patient.
   - Invokes `send_radiology_results_to_requesting_room()`, routing the patient back to the ordering doctor's consultation queue.

**Notes:**
- If additional contrast or specialized extra projections were required during the scan, add the supplementary consumables so they are billed accurately on the invoice.

---

## 7. Pharmacist

---

### Task 7.1: Dispense Outpatient Prescriptions & Real-Time Stock Deduction
**Who:** `pharmacist`, `admin`  
**Steps:**
1. Open the **Pharmacy Dispensing Workbench** (`/rooms/$pharmacyRoomId`).
2. Select a patient from the **Pending Prescriptions** list.
3. Review the ordered medication list:
   - Drug Name, Strength, Dose, Frequency, Duration, and Special Instructions.
4. **Payment / Clearance Verification:**
   - Verify that the invoice line item for the prescription is marked `paid` (for Cash patients) or `cleared` (for SHA / Insurance patients).
   - If unpaid in cash mode: Direct the patient to the Cashier to settle the bill before dispensing.
5. In the dispensing panel, for each prescribed medication:
   - Select the active **Batch Number** and verify expiry date from the Central Pharmacy Store (`a0000000-0000-0000-0000-000000000003`).
   - Confirm available warehouse stock balance.
   - Pack the physical drugs, labeling each container with dosage, frequency, and cautionary instructions.
6. Click **Dispense Selected Medications**.
7. The system:
   - Updates `prescriptions.status = 'dispensed'` and stamps `dispensed_at` and `dispensed_by`.
   - Executes database trigger `dispense_prescription_stock()`, creating a negative movement in `stock_movements` and reducing physical stock balance.
   - Triggers `trg_medication_dispense_fhir` to compile a FHIR `MedicationDispense` resource for national health record sync.
8. Verbally counsel the patient on correct drug usage, potential side effects, and storage conditions. Hand over the medications.

**Notes:**
- ⚠️ *Stock Guard Violation:* If the pharmacy has zero available stock, the system will block dispensing. You must notify the storekeeper to execute an inter-store transfer from the Main Store or contact the clinician for an alternative therapeutic drug substitution.
- 🚫 *ICU Segregation:* General Pharmacy cannot dispense ICU store medications (`sprint13b_dispense_stock_guard`). ICU ward nurses dispense ICU medications directly from the ICU sub-store.

---

## 8. ICU Nurse

---

### Task 8.1: Maintain ICU Hourly Flow-Sheet & Critical Monitoring
**Who:** `nurse`, `icu_nurse`  
**Steps:**
1. Open the **Inpatient ICU Module** or select the **ICU Clinical Room** (`a839ad3e-8721-4428-a825-6eee1f75207b`).
2. Select an admitted ICU patient bed.
3. Click **New Hourly Flow-Sheet Entry**.
4. Document the critical monitoring parameters:
   - **Hemodynamics:** Arterial Blood Pressure (Systolic, Diastolic, Mean Arterial Pressure - MAP), Central Venous Pressure (CVP), Heart Rate, Cardiac Rhythm.
   - **Mechanical Ventilation Settings:** Ventilation Mode (e.g., SIMV, PRVC, CPAP), Tidal Volume (VT), PEEP (cmH2O), FiO2 (%), Peak Inspiratory Pressure (PIP), Respiratory Rate.
   - **Neurological & Sedation:** Glasgow Coma Scale (GCS /15), Richmond Agitation-Sedation Scale (RASS: -5 to +4), Pupil size and light reactivity (Left/Right).
   - **Fluid Balance & Renal:** Hourly Urine Output (mL/hr), Gastric Aspirate / NG Drainage, Chest Tube Drainage, Central Line Infusions.
   - **Inotrope / Vasopressor Infusions:** Noradrenaline (mcg/min), Adrenaline, Dopamine, Dobutamine, Midazolam, Fentanyl infusion rates.
   - **Arterial Blood Gas (ABG):** pH, PaO2, PaCO2, HCO3, Base Excess, Lactate, SaO2.
5. Click **Save Hourly Record**. The chart compiles into a longitudinal real-time trend line.

**Notes:**
- Maintain strict hourly documentation. For MAP <65 mmHg, Urine Output <0.5 mL/kg/hr for 2 consecutive hours, or sudden desaturation, alert the Critical Care Physician immediately.

---

### Task 8.2: Dispense Emergency Medications from ICU Sub-Store
**Who:** `icu_nurse`  
**Steps:**
1. On the ICU Patient Chart, navigate to **ICU Bedside Dispensing**.
2. Select the required critical care drug from the dedicated **ICU Store** (`a99583cd-9354-470a-9299-73457734284d`).
3. Enter the quantity administered (e.g., *Noradrenaline 4mg Ampoule x 2*, *Propofol 1% 20mL Vial x 1*).
4. Enter clinical indication and administering nurse initials.
5. Click **Confirm ICU Administration**.
6. The system automatically logs stock consumption in `stock_usage`, updates the ICU stock ledger, and appends the medication line item to the patient's active inpatient invoice.

**Notes:**
- Emergency ICU medications are administered immediately without waiting for cashier payment clearance.

---

## 9. Dialysis Nurse

---

### Task 9.1: Record Hemodialysis Session & Auto-Bill Consumables
**Who:** `dialysis_nurse`, `nurse`  
**Steps:**
1. Open the **Dialysis Unit Room** (`/rooms/$dialysisRoomId`).
2. Select an arriving renal patient or click **Start New Dialysis Session**.
3. In the **Pre-Dialysis Assessment** section:
   - Record Pre-Dialysis Weight (kg), Dry Weight (kg), and computed Fluid Overload.
   - Record Pre-Dialysis Blood Pressure, Pulse, Temperature.
   - Assess Vascular Access: Type (`AV Fistula`, `AV Graft`, `Temporary IJ Catheter`, `Permacath`), Access Site, Thrill/Bruit status, and signs of infection.
4. In the **Machine & Prescription Parameters** section:
   - Assign Dialysis Machine Number (`machines` table).
   - Select Dialyzer Model / Surface Area (e.g., *High-Flux F60*, *Low-Flux F6*).
   - Set Blood Flow Rate (BFR in mL/min, e.g., `300`), Dialysate Flow Rate (DFR in mL/min, e.g., `500`).
   - Set Prescribed Treatment Duration (e.g., `4.0 hours`).
   - Set Ultrafiltration Goal (UF Goal in mL, e.g., `2500 mL`).
   - Specify Anticoagulation: Heparin Loading Dose (IU) and Maintenance Infusion (IU/hr) or Saline Flushes (for heparin-free dialysis).
5. In the **Session Consumables Checklist**:
   - Check all single-use consumables utilized from the **Dialysis Store** (`d38d45c7-20f2-4e1b-9279-8cb5bf567cd1`):
     - `Dialyzer Filter` (Qty: 1)
     - `Arterial & Venous Bloodlines` (Qty: 1)
     - `AV Fistula Needles 16G` (Qty: 2)
     - `Acid Concentrate & Bicarbonate Cartridge` (Qty: 1)
     - `Heparin 5000 IU/mL` (Qty: 1)
     - `Normal Saline 1000mL` (Qty: 2)
     - `Dialysis Dressing Pack & Gauze` (Qty: 1)
6. Monitor and document hourly intra-dialytic blood pressures, pulse, arterial pressure, venous pressure, TMP, and cumulative UF volume removed.
7. Upon session completion, document:
   - Post-Dialysis Weight (kg), Net Ultrafiltration Removed (mL), Post-Dialysis BP.
   - Any complications during session: Check applicable flags (*Hypotension*, *Cramps*, *Nausea*, *Access Clotting*, *Disequilibrium Syndrome*).
8. Click **Complete Session & Generate Billing**.
9. The system invokes `process_dialysis_session_billing`:
   - Saves complete session clinical log in `dialysis_sessions`.
   - Decrements all selected consumables from the Dialysis Store in `stock_usage`.
   - Posts a comprehensive, itemized hemodialysis session bill to the invoice (or packages it for SHA Renal Replacement Claim submission).

**Notes:**
- For SHA-covered dialysis sessions, verify that the patient has not exceeded their 2 sessions/week statutory SHIF benefit allotment.

---

## 10. Accountant / Cashier

---

### Task 10.1: Collect Payment, Issue Receipt & Allocate Funds
**Who:** `accountant`, `admin`  
**Steps:**
1. Open **Billing & Accounting** (`/accounting` or `/invoices/$id`).
2. Search for the patient by **Invoice Number**, **Patient File Number**, **National ID**, or **Name**.
3. Click on the active invoice to inspect all itemized line items (Consultations, Lab, Imaging, Pharmacy, Procedures, Bed Days).
4. Review the computed totals: `Total Amount`, `Waivers Applied`, `Amount Already Paid`, and `Net Outstanding Balance`.
5. Click **Record Payment**.
6. In the payment modal:
   - Enter **Amount to Pay** (KSh).
   - Select **Payment Method**: `Cash`, `M-Pesa`, `Credit / Debit Card`, `Bank Transfer`, `Insurance Guarantee / Letter of Undertaking`.
   - If M-Pesa / Card / Bank: Enter the unique **Transaction Reference Number** (e.g., M-Pesa Transaction ID `SDF8923JKL`).
7. Click **Confirm Payment**.
8. The system executes database trigger `recalc_invoice_payments()`:
   - Inserts immutable transaction record into `invoice_payments`.
   - Updates invoice `amount_paid` and recalibrates balance.
   - If balance is zero: Updates invoice status to `paid` and clears encounter locks.
   - Generates printable official hospital receipt with QR verification code.
   - Dispatches automated SMS payment confirmation to patient's mobile phone.

**Notes:**
- Never accept cash without generating and issuing an official printed system receipt immediately.

---

### Task 10.2: Apply an Indigent Patient Waiver or Credit Note
**Who:** `accountant`, `admin` (Requires supervisory authorization)  
**Steps:**
1. Open the target patient invoice in `/invoices/$id`.
2. Click the **Apply Waiver / Adjustment** button.
3. Enter the **Waiver Amount** (KSh).
4. Select the **Waiver Category**: `Indigent Patient`, `Hospital Board Waiver`, `Clinical Service Waiver`, `Billing Correction`.
5. Enter the mandatory **Supervisory Approval Reference** and justification text.
6. Click **Authorize Waiver**.
7. The system updates `invoices.waiver_amount`, logs `waiver_approved_by` with your user ID and timestamp, recalculates the net balance, and writes an audit event to `audit_log`.

**Notes:**
- ⚠️ *Audit Scrutiny:* All waivers are audited during institutional financial reviews and MoH accounting inspections. Never apply a waiver without written executive management approval.

---

### Task 10.3: Execute End-of-Day (EOD) Cash Reconciliation
**Who:** `accountant`, `director`  
**Steps:**
1. At the close of each cashier shift (e.g., 17:00 or shift change), navigate to **Accounting → End-of-Day Reconciliation**.
2. Select your cashier user name and today's date range.
3. The system compiles total collections categorized by channel:
   - Total Cash Collected (KSh)
   - Total M-Pesa Receipts (KSh)
   - Total Credit Card / Electronic Funds (KSh)
   - Total Waivers Applied (KSh)
   - Total Outstanding Invoices (KSh)
4. Count physical currency in the cash drawer and enter the **Physical Cash Count** amount.
5. The system calculates any variance between physical cash and system receipts.
6. Click **Generate & Close EOD Shift Report**.
7. Print the reconciled EOD summary, attach banking deposit slips, sign the report, and submit to the Chief Accountant / Hospital Director.

---

## 11. Mortician

---

### Task 11.1: Admit an Internal Hospital Body to Mortuary
**Who:** `mortician`  
**Steps:**
1. Open the **Mortuary Department** room (`214aca6c-cbde-40ce-af5a-92cc7815bda9`).
2. Click **Admit Deceased Body**.
3. Select **Body Source**: `Internal Hospital Death`.
4. Search for the deceased patient by File Number or Inpatient Admission ID.
5. Demographic details, date/time of death, ward of death, and certifying medical officer are auto-populated.
6. Assign **Mortuary Cold Storage Unit / Vault Number** (e.g., `Cold Room B - Slot 14`).
7. Enter receiving mortician notes (presence of valuables, personal effects, physical body condition).
8. Click **Admit to Mortuary**.
9. The system executes `assign_mortuary_reference()` (generating a unique mortuary reference, e.g., `MORT-2026-0042`) and links the mortuary stay to the patient's existing hospital invoice.

---

### Task 11.2: Admit an External Body (Police Case / Home Death)
**Who:** `mortician`  
**Steps:**
1. In the Mortuary screen, click **Admit Deceased Body**.
2. Select **Body Source**: `External (Brought in Dead / Police Case / Home Death)`.
3. Input deceased demographic details: Full Name (or *Unknown Deceased Male/Female*), Estimated Age, Gender.
4. Input Intake Legal Metadata:
   - Brought In By: Name, ID Number, Phone, Relationship / Title.
   - If Police Case: Accompanying Police Officer Name, Rank, Service Number, Police Station, and Police OB (Occurrence Book) Number.
   - Place of Death, Date and Time of Death.
5. Assign **Cold Storage Unit / Slot**.
6. Click **Register External Body**.
7. The system:
   - Creates a record in `mortuary_records`.
   - Generates mortuary reference number.
   - Invokes `create_external_mortuary_invoice()` to provision a dedicated commercial mortuary invoice linked to the next-of-kin / police file.

---

### Task 11.3: Document Mortuary Services & Release Body
**Who:** `mortician`, `accountant`  
**Steps:**
1. As mortuary services are rendered during storage:
   - Click **Add Mortuary Service** on the deceased record.
   - Add billable services: *Embalming / Preservation*, *Post-Mortem Examination Attendance*, *Refrigeration Storage Days*, *Body Dressing & Beautification*, *Hearse Transfer*.
   - The system automatically appends line items to the mortuary invoice.
   - Nightly daemon `accrue_daily_mortuary_charges()` automatically accrues standard daily refrigeration storage fees.
2. **Body Release Procedure:**
   - Next-of-kin presents official **Burial Permit / Death Certificate** and national ID.
   - Next-of-kin proceeds to Cashier to settle the final mortuary invoice balance.
   - Mortician verifies invoice status is `paid` (or authorized waiver attached).
   - Click **Release Body**.
   - Input collecting next-of-kin name, national ID, vehicle registration, and burial destination.
   - Click **Confirm Body Handover & Discharge**. The storage slot is marked `available` and the mortuary record is officially closed.

**Notes:**
- 🚫 *Release Lock:* The system will strictly block body release if an outstanding financial balance exists without an authorized waiver.

---

## 12. Store Keeper

---

### Task 12.1: Receive Commercial Supplier Delivery into Main Store
**Who:** `store_keeper`, `admin`  
**Steps:**
1. Navigate to **Deliveries & Stock Intake** (`/deliveries`).
2. Click **New Delivery / Stock Receipt**.
3. Enter Delivery Metadata:
   - Supplier / Vendor Name (e.g., *KEMSA*, *MEDS*, *Harleys Ltd*).
   - Supplier Invoice Number / Delivery Note Number.
   - Local Purchase Order (LPO) Reference Number.
   - Receiving Location: Select **Main Store** (`a0000000-0000-0000-0000-000000000001`).
4. In the **Delivered Items** table, for each delivered commodity:
   - Search `stock_items` by name or SKU.
   - Enter **Quantity Received** (Pack count / Units).
   - Enter **Batch / Lot Number** and **Expiry Date**.
   - Enter Unit Buying Price (KSh) and confirm selling tariff.
5. Click **Post Delivery to Stock**.
6. The system executes `delivery_to_stock()`:
   - Records delivery in `stock_deliveries`.
   - Creates positive ledger entries in `stock_movements`.
   - Updates stock item current available quantities and logs weighted average buying costs.

**Notes:**
- Carefully check physical seals, batch numbers, and expiry dates against the delivery note before clicking submit. Never accept stock expiring within 6 months without supervisor sign-off.

---

### Task 12.2: Transfer Stock to Departmental Sub-Stores
**Who:** `store_keeper`, `pharmacist`  
**Steps:**
1. Navigate to **Stock Management** (`/stock`).
2. Click **Inter-Store Stock Transfer**.
3. Select **Source Location**: `Main Store`.
4. Select **Destination Location**:
   - `Central Pharmacy Store` (`a0000000-0000-0000-0000-000000000003`)
   - `ICU Store` (`a99583cd-9354-470a-9299-73457734284d`)
   - `Dialysis Store` (`d38d45c7-20f2-4e1b-9279-8cb5bf567cd1`)
   - `Laboratory Store`
5. Select the commodity and input the **Transfer Quantity**.
6. Add transfer note (e.g., *"Weekly stock requisition for ICU"*).
7. Click **Execute Stock Transfer**.
8. The system invokes `transfer_stock_between_locations()` RPC:
   - Deducts quantity from Source Store in `stock_movements`.
   - Credits quantity to Destination Store in `stock_movements`.
   - Generates printable inter-store transfer voucher.

---

## 13. System Administrator (Admin)

---

### Task 13.1: Manage Staff User Accounts, Roles & Permissions
**Who:** `admin`, `system_admin`  
**Steps:**
1. Navigate to **Admin → Users & Access** (`/admin/users`).
2. To approve a newly registered staff member:
   - Locate user under **Pending Account Approvals**.
   - Click **Approve Account** (`is_approved = true`).
3. To assign roles:
   - Click **Edit Roles** on the user card.
   - Assign applicable roles: `doctor`, `clinical_officer`, `nurse`, `triage_nurse`, `lab_tech`, `radiologist`, `pharmacist`, `accountant`, `insurance_agent`, `mortician`, `store_keeper`, `records_officer`, `admin`.
   - Click **Save Role Assignments**.
4. To grant room access:
   - Navigate to **Admin → Rooms** (`/admin/rooms`).
   - Select consultation room or diagnostic unit and assign user to `user_room_access`.
5. To configure practitioner council details:
   - In user profile, enter **Professional Council Type** (`KMPDC`, `COC`, `NCK`, `PPB`, `KMLTTB`) and **Council Registration Number** for statutory encounter signing.

**Notes:**
- Follow the principle of least privilege. Never assign `admin` or `sign_encounter` permissions to unauthorized non-clinical personnel.

---

### Task 13.2: Configure Facility Metadata, Wards, Beds & Tariffs
**Who:** `admin`  
**Steps:**
1. **Facility Settings (`/admin/settings`):**
   - Verify Facility Name, KMHFL Code, SHA Facility ID, MoH Level (1–6), County, Contact Phone, and Official Email. Click **Save Settings**.
2. **Wards & Beds (`/admin/wards`):**
   - Create inpatient wards, specify ward category, and assign standard **Daily Bed Rate (KSh)**.
   - Add individual physical bed numbers to each ward.
3. **Master Pricing Catalog (`/admin/services` & `/admin/pricing`):**
   - Set standard cash prices for general consultations, specialty clinics, procedures, and nursing services.
   - Configure **Insurer Contracted Tariffs** (`insurance_contracted_prices`) to establish contracted rate overrides for SHA, Jubilee, Britam, and other underwriters.

---

## 14. Medical Director / Executive Management

---

### Task 14.1: Review Executive Dashboard, Epidemiological Trends & Health
**Who:** `director`, `admin`  
**Steps:**
1. Log into the system and navigate to **Dashboard** (`/dashboard`).
2. **Clinical KPI Cards:**
   - Review Today's Outpatient Attendance, Total Active Inpatient Admissions, Bed Occupancy Rate (%), Emergency Casualty Volume, and Lab/Radiology Turnaround Times.
3. **MOH Epidemiological Surveillance:**
   - Inspect the **Top 10 Morbidity Disease Chart** generated by `dashboard_top_diseases()` RPC to detect community disease outbreaks (e.g., spikes in Malaria, Gastroenteritis, or Upper Respiratory Infections).
   - Review the 7-day OPD vs. Inpatient Admission Trend graph (`dashboard_admitted_opd_trend()`).
4. **Financial Summary:**
   - Inspect daily gross revenue, cash collections, insurance claims submitted, outstanding aging balances, and total waivers approved.
5. **System Health & Integrations:**
   - Check status badges for Supabase Database connectivity, Africa's Talking SMS credit balance, and DHA Outbound Queue transmission latency.

---

### Task 14.2: Generate & Export Statutory MoH Reports (705A, 705B, 717)
**Who:** `director`, `records_officer`, `admin`  
**Steps:**
1. Navigate to **MOH Reporting Suite** (`/moh` or `/moh/705`, `/moh/717`).
2. Select the target **Reporting Period** (Month and Year, e.g., *July 2026*).
3. Select Report Type:
   - **MOH 705A:** Under 5 Years Outpatient Morbidity Summary.
   - **MOH 705B:** Over 5 Years Outpatient Morbidity Summary.
   - **MOH 706:** Laboratory Diagnostic Return.
   - **MOH 707:** Inpatient Bed Utilization & Mortality Return.
   - **MOH 717:** Institutional Workload Return.
4. Click **Compile MoH Report**.
5. The system executes `get_moh_705_report(start_date, end_date, form_type)` against database aggregate tags.
6. Review the tabular return displaying disease classification, ICD-11 codes, male cases, female cases, and total incidence.
7. Click **Export to CSV / Excel** or **Print Official MoH PDF** for submission to the Sub-County Health Records Information Officer (SCHRIO) and upload to the national DHIS2 / KHIS portal.
