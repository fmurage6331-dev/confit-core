/**
 * LabTrack — shared role definitions.
 */
export const APP_ROLES = [
  "admin",
  "staff",
  "accountant",
  "lab_tech",
  "records_officer",
  "doctor",
  "clinical_officer",
  "nurse",
  "radiologist",
  "pharmacist",
  "mortician",
] as const;

export type AppRole = (typeof APP_ROLES)[number];
export type AssignableRole = AppRole | "none";

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Admin",
  staff: "Staff (all access)",
  accountant: "Accountant",
  lab_tech: "Lab technician",
  records_officer: "Records officer",
  doctor: "Doctor",
  clinical_officer: "Clinical officer",
  nurse: "Nurse",
  radiologist: "Radiologist",
  pharmacist: "Pharmacist",
  mortician: "Mortician",
};

// Ordered for "primary role" display when a user has multiple roles.
export const ROLE_DISPLAY_ORDER: AppRole[] = [
  "admin",
  "doctor",
  "clinical_officer",
  "radiologist",
  "pharmacist",
  "nurse",
  "accountant",
  "lab_tech",
  "records_officer",
  "mortician",
  "staff",
];
