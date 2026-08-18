/**
 * AegisCare — OTP Service
 * Generates, stores and sends OTP via Africa's Talking SMS Edge Function
 */
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/lib/supabase-untyped";

const LEGAL_TEXT =
  "Your AegisCare verification code is {OTP}. Valid for 10 mins. " +
  "By sharing this code you consent to treatment and data processing " +
  "under the ODPC Act 2019 and SHA Act 2023.";

export async function generateAndSendOtp(
  phone: string,
  patientId: string,
  encounterId: string,
  userId: string | null,
): Promise<{ otpId: string }> {
  // 1. Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  // 2. Hash it for security — never store raw OTP
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(otp));
  const otpHash = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // 3. Save hashed OTP to DB
  const { data, error: dbError } = await db
    .from("consent_otps")
    .insert({
      patient_id: patientId,
      encounter_id: encounterId,
      phone: phone,
      otp_hash: otpHash,
      consent_type: "general_treatment",
      expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
      receptionist_user_id: userId ?? null,
      delivery_status: "pending",
    })
    .select("id");

  if (dbError) throw new Error(dbError.message);
  const otpId = (data as { id: string }[] | null)?.[0]?.id;
  if (!otpId) throw new Error("Failed to create OTP record");

  // 4. Send SMS via Edge Function
  const message = LEGAL_TEXT.replace("{OTP}", otp);
  const { error: smsError } = await supabase.functions.invoke("send-sms", {
    body: { to: phone, message },
  });

  // 5. Update delivery status
  await db
    .from("consent_otps")
    .update({ delivery_status: smsError ? "failed" : "sent" })
    .eq("id", otpId);

  if (smsError) {
    throw new Error(`SMS delivery failed: ${smsError.message}`);
  }

  return { otpId };
}
