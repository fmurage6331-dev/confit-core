/**
 * LabTrack — shared role definitions.
 */
export const APP_ROLES = [
  "admin",
  "system_admin",
  "staff",
  "receptionist",
  "accountant",
  "insurance_agent",
  "records_officer",
  "triage_nurse",
  "nurse",
  "doctor",
  "clinical_officer",
  "dental_officer",
  "nutritionist",
  "physiotherapist",
  "hts_counsellor",
  "lab_tech",
  "radiologist",
  "pharmacist",
  "mortician",
] as const;

export type AppRole = (typeof APP_ROLES)[number];
export type AssignableRole = AppRole | "none";

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Admin",
  system_admin: "System administrator",
  staff: "Staff (general)",
  receptionist: "Receptionist",
  accountant: "Accountant",
  insurance_agent: "Insurance agent",
  records_officer: "Records officer",
  triage_nurse: "Triage nurse",
  nurse: "Nurse",
  doctor: "Doctor",
  clinical_officer: "Clinical officer",
  dental_officer: "Dental officer",
  nutritionist: "Nutritionist",
  physiotherapist: "Physiotherapist",
  hts_counsellor: "HTS counsellor",
  lab_tech: "Lab technician",
  radiologist: "Radiologist",
  pharmacist: "Pharmacist",
  mortician: "Mortician",
};

// Ordered for "primary role" display when a user has multiple roles.
export const ROLE_DISPLAY_ORDER: AppRole[] = [
  "admin",
  "system_admin",
  "doctor",
  "clinical_officer",
  "dental_officer",
  "radiologist",
  "pharmacist",
  "nurse",
  "triage_nurse",
  "hts_counsellor",
  "nutritionist",
  "physiotherapist",
  "lab_tech",
  "records_officer",
  "receptionist",
  "insurance_agent",
  "accountant",
  "mortician",
  "staff",
];
