import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, rgb, StandardFonts } from "npm:pdf-lib@1.17.1";

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

const ALLOWED_ORIGINS = [
  "https://aegiscare-orcin.vercel.app",
  "http://localhost:5173",
  "http://localhost:3000",
];

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Credentials": "true",
    Vary: "Origin",
  };
}

function formatDateTime(dateInput?: string | Date | null): string {
  if (!dateInput) return "N/A";
  const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return "N/A";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, "0");
  const mins = String(d.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${mins}`;
}

function formatDateOnly(dateInput?: string | Date | null): string {
  if (!dateInput) return "N/A";
  const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return "N/A";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function escapeHtml(text?: string | null): string {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  const len = bytes.byteLength;
  const chunkSize = 8192;
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

interface LabOrder {
  id: string;
  patient_id: string;
  test_name: string;
  order_number: string;
  status: string;
  clinical_indication: string | null;
  specimen_type: string | null;
  collected_at: string | null;
  is_critical: boolean | null;
  ordered_at: string | null;
  ordered_by: string | null;
}

interface LabResult {
  id: string;
  lab_order_id: string;
  result_value: string | null;
  unit: string | null;
  reference_range: string | null;
  is_critical: boolean | null;
  notes: string | null;
  verified_by: string | null;
  verified_at: string | null;
}

interface Patient {
  id: string;
  email: string | null;
  patient_name: string | null;
  file_number: string | null;
}

async function generateLabReportPdf(
  order: LabOrder,
  patient: Patient,
  results: LabResult[],
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const page = pdfDoc.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();

  // Header bar (teal #0F766E)
  const tealColor = rgb(15 / 255, 118 / 255, 110 / 255);
  const darkTextColor = rgb(0.12, 0.16, 0.22);
  const mutedTextColor = rgb(0.38, 0.44, 0.52);

  page.drawRectangle({
    x: 0,
    y: height - 60,
    width,
    height: 60,
    color: tealColor,
  });

  const headerTitle = "AegisCare HMS — Laboratory Report";
  const titleSize = 16;
  const titleWidth = fontBold.widthOfTextAtSize(headerTitle, titleSize);
  page.drawText(headerTitle, {
    x: (width - titleWidth) / 2,
    y: height - 37,
    size: titleSize,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  // Sub-header: CONFIDENTIAL
  const subHeader = "CONFIDENTIAL";
  const subHeaderSize = 10;
  const subHeaderWidth = fontBold.widthOfTextAtSize(subHeader, subHeaderSize);
  page.drawText(subHeader, {
    x: (width - subHeaderWidth) / 2,
    y: height - 80,
    size: subHeaderSize,
    font: fontBold,
    color: rgb(0.85, 0.15, 0.15),
  });

  // Patient section box
  const boxX = 40;
  const boxY = height - 190;
  const boxWidth = width - 80;
  const boxHeight = 98;

  page.drawRectangle({
    x: boxX,
    y: boxY,
    width: boxWidth,
    height: boxHeight,
    color: rgb(0.97, 0.98, 0.99),
    borderColor: rgb(0.85, 0.88, 0.92),
    borderWidth: 1,
  });

  const leftColX = boxX + 16;
  const rightColX = boxX + boxWidth / 2 + 10;
  let currentY = boxY + boxHeight - 20;
  const rowSpacing = 18;
  const labelSize = 9;
  const valueSize = 9;

  // Row 1
  page.drawText("Patient Name:", {
    x: leftColX,
    y: currentY,
    size: labelSize,
    font: fontBold,
    color: mutedTextColor,
  });
  page.drawText(patient.patient_name || "N/A", {
    x: leftColX + 75,
    y: currentY,
    size: valueSize,
    font,
    color: darkTextColor,
  });

  page.drawText("Specimen:", {
    x: rightColX,
    y: currentY,
    size: labelSize,
    font: fontBold,
    color: mutedTextColor,
  });
  page.drawText(order.specimen_type || "N/A", {
    x: rightColX + 65,
    y: currentY,
    size: valueSize,
    font,
    color: darkTextColor,
  });

  // Row 2
  currentY -= rowSpacing;
  page.drawText("File Number:", {
    x: leftColX,
    y: currentY,
    size: labelSize,
    font: fontBold,
    color: mutedTextColor,
  });
  page.drawText(patient.file_number || "N/A", {
    x: leftColX + 75,
    y: currentY,
    size: valueSize,
    font,
    color: darkTextColor,
  });

  page.drawText("Collected:", {
    x: rightColX,
    y: currentY,
    size: labelSize,
    font: fontBold,
    color: mutedTextColor,
  });
  page.drawText(formatDateTime(order.collected_at), {
    x: rightColX + 65,
    y: currentY,
    size: valueSize,
    font,
    color: darkTextColor,
  });

  // Row 3
  currentY -= rowSpacing;
  page.drawText("Order Number:", {
    x: leftColX,
    y: currentY,
    size: labelSize,
    font: fontBold,
    color: mutedTextColor,
  });
  page.drawText(order.order_number || "N/A", {
    x: leftColX + 75,
    y: currentY,
    size: valueSize,
    font,
    color: darkTextColor,
  });

  page.drawText("Reported:", {
    x: rightColX,
    y: currentY,
    size: labelSize,
    font: fontBold,
    color: mutedTextColor,
  });
  page.drawText(formatDateTime(new Date()), {
    x: rightColX + 65,
    y: currentY,
    size: valueSize,
    font,
    color: darkTextColor,
  });

  // Row 4
  currentY -= rowSpacing;
  page.drawText("Test:", {
    x: leftColX,
    y: currentY,
    size: labelSize,
    font: fontBold,
    color: mutedTextColor,
  });
  page.drawText(order.test_name || "N/A", {
    x: leftColX + 75,
    y: currentY,
    size: valueSize,
    font: fontBold,
    color: darkTextColor,
  });

  // Results table
  let tableY = boxY - 26;
  const colTestX = 40;
  const colResultX = 180;
  const colUnitX = 270;
  const colRangeX = 350;
  const colFlagX = 480;
  const tableWidth = width - 80;

  // Table header bar
  page.drawRectangle({
    x: colTestX,
    y: tableY - 18,
    width: tableWidth,
    height: 24,
    color: tealColor,
  });

  const headerY = tableY - 12;
  page.drawText("Test", {
    x: colTestX + 10,
    y: headerY,
    size: 9,
    font: fontBold,
    color: rgb(1, 1, 1),
  });
  page.drawText("Result", {
    x: colResultX,
    y: headerY,
    size: 9,
    font: fontBold,
    color: rgb(1, 1, 1),
  });
  page.drawText("Unit", {
    x: colUnitX,
    y: headerY,
    size: 9,
    font: fontBold,
    color: rgb(1, 1, 1),
  });
  page.drawText("Reference Range", {
    x: colRangeX,
    y: headerY,
    size: 9,
    font: fontBold,
    color: rgb(1, 1, 1),
  });
  page.drawText("Flag", {
    x: colFlagX,
    y: headerY,
    size: 9,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  tableY -= 20;

  if (results.length === 0) {
    tableY -= 20;
    page.drawRectangle({
      x: colTestX,
      y: tableY,
      width: tableWidth,
      height: 22,
      color: rgb(0.98, 0.98, 0.99),
      borderColor: rgb(0.9, 0.92, 0.95),
      borderWidth: 0.5,
    });
    const pendingText = "Results pending verification";
    page.drawText(pendingText, {
      x: colTestX + 10,
      y: tableY + 6,
      size: 9,
      font: fontOblique,
      color: mutedTextColor,
    });
    tableY -= 10;
  } else {
    for (let i = 0; i < results.length; i++) {
      const res = results[i];
      tableY -= 22;
      const isEven = i % 2 === 0;
      page.drawRectangle({
        x: colTestX,
        y: tableY,
        width: tableWidth,
        height: 22,
        color: isEven ? rgb(1, 1, 1) : rgb(0.97, 0.98, 0.99),
        borderColor: rgb(0.9, 0.92, 0.95),
        borderWidth: 0.5,
      });

      const textY = tableY + 6;
      page.drawText(order.test_name || "Test", {
        x: colTestX + 10,
        y: textY,
        size: 9,
        font,
        color: darkTextColor,
      });
      page.drawText(res.result_value ?? "—", {
        x: colResultX,
        y: textY,
        size: 9,
        font: fontBold,
        color: darkTextColor,
      });
      page.drawText(res.unit ?? "—", {
        x: colUnitX,
        y: textY,
        size: 9,
        font,
        color: darkTextColor,
      });
      page.drawText(res.reference_range ?? "—", {
        x: colRangeX,
        y: textY,
        size: 9,
        font,
        color: darkTextColor,
      });

      const isCritical = Boolean(res.is_critical);
      const flagText = isCritical ? "CRITICAL" : "NORMAL";
      const flagColor = isCritical ? rgb(0.86, 0.15, 0.15) : rgb(0.09, 0.55, 0.27);

      page.drawText(flagText, {
        x: colFlagX,
        y: textY,
        size: 9,
        font: fontBold,
        color: flagColor,
      });
    }
  }

  // Clinical indication & Verification section
  tableY -= 28;
  page.drawText("Clinical indication:", {
    x: colTestX,
    y: tableY,
    size: 9,
    font: fontBold,
    color: mutedTextColor,
  });
  page.drawText(order.clinical_indication || "None specified", {
    x: colTestX + 95,
    y: tableY,
    size: 9,
    font,
    color: darkTextColor,
  });

  const verifiedAt = results.find((r) => r.verified_at)?.verified_at || null;
  if (verifiedAt) {
    tableY -= 16;
    page.drawText("Verified by:", {
      x: colTestX,
      y: tableY,
      size: 9,
      font: fontBold,
      color: mutedTextColor,
    });
    page.drawText(formatDateOnly(verifiedAt), {
      x: colTestX + 95,
      y: tableY,
      size: 9,
      font,
      color: darkTextColor,
    });
  }

  // Footer (every page)
  const pages = pdfDoc.getPages();
  const totalPages = pages.length;
  for (let i = 0; i < totalPages; i++) {
    const p = pages[i];
    const { width: pWidth } = p.getSize();

    p.drawLine({
      start: { x: 40, y: 72 },
      end: { x: pWidth - 40, y: 72 },
      thickness: 0.5,
      color: rgb(0.85, 0.88, 0.92),
    });

    const disclaimer1 =
      "CONFIDENTIALITY NOTICE: This laboratory report contains confidential medical information intended solely for the";
    const disclaimer2 =
      "named patient. If you have received this in error, please delete it immediately and notify the sender. Unauthorised";
    const disclaimer3 = "disclosure is prohibited under the Kenya Data Protection Act 2019.";

    p.drawText(disclaimer1, {
      x: 40,
      y: 58,
      size: 6.8,
      font,
      color: mutedTextColor,
    });
    p.drawText(disclaimer2, {
      x: 40,
      y: 49,
      size: 6.8,
      font,
      color: mutedTextColor,
    });
    p.drawText(disclaimer3, {
      x: 40,
      y: 40,
      size: 6.8,
      font,
      color: mutedTextColor,
    });

    const pageStr = `Page ${i + 1} of ${totalPages}`;
    const pageStrWidth = font.widthOfTextAtSize(pageStr, 8);
    p.drawText(pageStr, {
      x: (pWidth - pageStrWidth) / 2,
      y: 26,
      size: 8,
      font,
      color: mutedTextColor,
    });
  }

  return await pdfDoc.save();
}

function buildHtmlEmail(order: LabOrder, patient: Patient): string {
  const patientName = patient.patient_name || "Patient";
  const orderNumber = order.order_number || "N/A";
  const testName = order.test_name || "N/A";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Your Laboratory Results — AegisCare HMS</title>
</head>
<body style="margin:0;padding:24px;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1e293b;line-height:1.6;">
  <div style="max-width:600px;margin:0 auto;background-color:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    <div style="background-color:#0F766E;padding:24px 32px;color:#ffffff;">
      <h1 style="margin:0;font-size:20px;font-weight:600;letter-spacing:-0.02em;">AegisCare HMS</h1>
      <p style="margin:4px 0 0 0;font-size:13px;opacity:0.9;text-transform:uppercase;letter-spacing:0.05em;">Confidential Laboratory Report</p>
    </div>
    <div style="padding:32px;">
      <p style="margin-top:0;font-size:16px;">Dear <strong>${escapeHtml(patientName)}</strong>,</p>
      <p style="font-size:15px;color:#334155;">
        Your laboratory results from AegisCare HMS are ready. Please find your confidential report attached.
      </p>
      <div style="background-color:#f1f5f9;border-left:4px solid #0F766E;padding:14px 18px;margin:20px 0;border-radius:0 4px 4px 0;">
        <span style="font-size:14px;color:#0f172a;font-weight:500;">
          Order Number: <strong>${escapeHtml(orderNumber)}</strong> &nbsp;|&nbsp; Test: <strong>${escapeHtml(testName)}</strong>
        </span>
      </div>
      <p style="font-size:14px;color:#475569;">
        If you have questions about your results, please contact your healthcare provider.
      </p>
      <div style="margin-top:28px;padding-top:16px;border-top:1px solid #e2e8f0;">
        <p style="font-size:11px;color:#64748b;line-height:1.5;margin:0 0 12px 0;">
          <strong>CONFIDENTIALITY NOTICE:</strong> This laboratory report contains confidential medical information intended solely for the named patient. If you have received this in error, please delete it immediately and notify the sender. Unauthorised disclosure is prohibited under the Kenya Data Protection Act 2019.
        </p>
        <p style="font-size:11px;color:#94a3b8;margin:0;text-align:center;">
          AegisCare HMS | This is an automated message
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const brevoApiKey = Deno.env.get("BREVO_API_KEY");
  const brevoSenderEmail = Deno.env.get("BREVO_SENDER_EMAIL");
  const brevoSenderName = Deno.env.get("BREVO_SENDER_NAME") || "AegisCare HMS Laboratory";

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let currentLabOrderId: string | null = null;
  let currentPatientId: string | null = null;
  let currentPatientEmail: string | null = null;

  try {
    let body: { lab_order_id?: string } = {};
    try {
      body = (await req.json()) as { lab_order_id?: string };
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON request body" }), {
        status: 400,
        headers: {
          ...getCorsHeaders(req),
          "Content-Type": "application/json",
        },
      });
    }

    const { lab_order_id } = body;
    if (!lab_order_id) {
      return new Response(JSON.stringify({ error: "lab_order_id is required" }), {
        status: 400,
        headers: {
          ...getCorsHeaders(req),
          "Content-Type": "application/json",
        },
      });
    }

    currentLabOrderId = lab_order_id;

    // Fetch lab_order
    const { data: labOrder, error: orderError } = await supabase
      .from("lab_orders")
      .select(
        "id, patient_id, test_name, order_number, status, clinical_indication, specimen_type, collected_at, is_critical, ordered_at, ordered_by",
      )
      .eq("id", lab_order_id)
      .maybeSingle();

    if (orderError) {
      throw new Error(`Failed to fetch lab order: ${orderError.message}`);
    }

    if (!labOrder) {
      return new Response(JSON.stringify({ error: "Lab order not found" }), {
        status: 404,
        headers: {
          ...getCorsHeaders(req),
          "Content-Type": "application/json",
        },
      });
    }

    currentPatientId = labOrder.patient_id;

    if (labOrder.status !== "completed") {
      return new Response(JSON.stringify({ sent: false, reason: "not_completed" }), {
        status: 200,
        headers: {
          ...getCorsHeaders(req),
          "Content-Type": "application/json",
        },
      });
    }

    // Fetch patient
    const { data: patient, error: patientError } = await supabase
      .from("patients")
      .select("id, email, patient_name, file_number")
      .eq("id", labOrder.patient_id)
      .maybeSingle();

    if (patientError) {
      throw new Error(`Failed to fetch patient: ${patientError.message}`);
    }

    const email = patient?.email ? patient.email.trim() : "";
    if (!email) {
      await supabase.from("email_send_log").insert({
        patient_id: labOrder.patient_id,
        lab_order_id: labOrder.id,
        email_address: null,
        status: "no_email",
        brevo_message_id: null,
        error_message: "Patient has no email address",
      });

      return new Response(JSON.stringify({ sent: false, reason: "no_email" }), {
        status: 200,
        headers: {
          ...getCorsHeaders(req),
          "Content-Type": "application/json",
        },
      });
    }

    currentPatientEmail = email;

    // Fetch lab_results
    const { data: labResults, error: resultsError } = await supabase
      .from("lab_results")
      .select(
        "id, lab_order_id, result_value, unit, reference_range, is_critical, notes, verified_by, verified_at",
      )
      .eq("lab_order_id", labOrder.id);

    if (resultsError) {
      throw new Error(`Failed to fetch lab results: ${resultsError.message}`);
    }

    const resultsList: LabResult[] = (labResults as LabResult[]) ?? [];

    // Generate PDF
    const pdfBytes = await generateLabReportPdf(
      labOrder as LabOrder,
      patient as Patient,
      resultsList,
    );
    const base64Pdf = uint8ArrayToBase64(pdfBytes);

    if (!brevoApiKey || !brevoSenderEmail) {
      const configError = "Brevo configuration missing (BREVO_API_KEY or BREVO_SENDER_EMAIL)";
      await supabase.from("email_send_log").insert({
        patient_id: labOrder.patient_id,
        lab_order_id: labOrder.id,
        email_address: email,
        status: "failed",
        brevo_message_id: null,
        error_message: configError,
      });

      return new Response(JSON.stringify({ sent: false, error: configError }), {
        status: 200,
        headers: {
          ...getCorsHeaders(req),
          "Content-Type": "application/json",
        },
      });
    }

    // Send email via Brevo
    const htmlEmail = buildHtmlEmail(labOrder as LabOrder, patient as Patient);
    const orderNumberSafe = labOrder.order_number || labOrder.id;

    const brevoPayload = {
      sender: {
        name: brevoSenderName,
        email: brevoSenderEmail,
      },
      to: [
        {
          email,
          name: patient?.patient_name || email,
        },
      ],
      subject: "Your Laboratory Results — AegisCare HMS",
      htmlContent: htmlEmail,
      attachment: [
        {
          content: base64Pdf,
          name: `lab-results-${orderNumberSafe}.pdf`,
        },
      ],
    };

    const brevoRes = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": brevoApiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(brevoPayload),
    });

    const brevoJson = (await brevoRes.json().catch(() => null)) as {
      messageId?: string;
      messageIds?: string[];
      message?: string;
    } | null;

    if (brevoRes.ok) {
      const messageId = brevoJson?.messageId || brevoJson?.messageIds?.[0] || "sent";

      await supabase.from("email_send_log").insert({
        patient_id: labOrder.patient_id,
        lab_order_id: labOrder.id,
        email_address: email,
        status: "sent",
        brevo_message_id: messageId,
        error_message: null,
      });

      return new Response(JSON.stringify({ sent: true, message_id: messageId }), {
        status: 200,
        headers: {
          ...getCorsHeaders(req),
          "Content-Type": "application/json",
        },
      });
    } else {
      const errorMsg = brevoJson?.message || `Brevo API call failed with status ${brevoRes.status}`;

      await supabase.from("email_send_log").insert({
        patient_id: labOrder.patient_id,
        lab_order_id: labOrder.id,
        email_address: email,
        status: "failed",
        brevo_message_id: null,
        error_message: errorMsg,
      });

      return new Response(JSON.stringify({ sent: false, error: errorMsg }), {
        status: 200,
        headers: {
          ...getCorsHeaders(req),
          "Content-Type": "application/json",
        },
      });
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error";
    console.error("send-lab-results error:", err);

    try {
      if (currentLabOrderId) {
        await supabase.from("email_send_log").insert({
          patient_id: currentPatientId,
          lab_order_id: currentLabOrderId,
          email_address: currentPatientEmail,
          status: "failed",
          brevo_message_id: null,
          error_message: errorMsg,
        });
      }
    } catch (insertErr) {
      console.error("Failed to log error into email_send_log:", insertErr);
    }

    return new Response(JSON.stringify({ sent: false, error: errorMsg }), {
      status: 200,
      headers: {
        ...getCorsHeaders(req),
        "Content-Type": "application/json",
      },
    });
  }
});
