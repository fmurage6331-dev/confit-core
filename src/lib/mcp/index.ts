import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listPatients from "./tools/list-patients";
import getPatient from "./tools/get-patient";
import listServices from "./tools/list-services";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "labtrack-mcp",
  title: "LabTrack Hospital MCP",
  version: "0.1.0",
  instructions:
    "Tools to read patients, services, and clinical activity from LabTrack. Use `list_patients` to browse recent registrations, `get_patient` to see one patient's visit, tests and prescriptions, and `list_services` to inspect the service catalog.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listPatients, getPatient, listServices],
});
