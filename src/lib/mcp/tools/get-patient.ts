import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "get_patient",
  title: "Get patient",
  description: "Fetch a patient registration by file number, including requested services, associated lab tests, and prescriptions.",
  inputSchema: {
    file_number: z.string().trim().min(1).describe("Reception file/registration number."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ file_number }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const sb = supabaseForUser(ctx);
    const { data: reg, error } = await sb
      .from("patient_registrations")
      .select("*")
      .eq("file_number", file_number)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!reg) return { content: [{ type: "text", text: `No patient found with file ${file_number}` }], isError: true };
    const [{ data: tests }, { data: rx }] = await Promise.all([
      sb.from("lab_tests").select("id, test_name, test_date, result, is_positive").eq("registration_id", reg.id).order("test_date", { ascending: false }),
      sb.from("prescriptions").select("id, status, quantity, created_at").eq("registration_id", reg.id).order("created_at", { ascending: false }),
    ]);
    const payload = { registration: reg, lab_tests: tests ?? [], prescriptions: rx ?? [] };
    return { content: [{ type: "text", text: JSON.stringify(payload) }], structuredContent: payload };
  },
});
