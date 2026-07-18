import nodemailer from "npm:nodemailer";
import { logError, logInfo } from "../logging.ts";

const BREVO_API_KEY = String(Deno.env.get("BREVO_API_KEY") || "").trim();
const BREVO_EMAIL_API_URL = "https://api.brevo.com/v3/smtp/email";
const SMTP_HOST = String(
  Deno.env.get("BREVO_SMTP_HOST") || Deno.env.get("SMTP_HOST") || "smtp-relay.brevo.com",
).trim();
const SMTP_PORT = Number(Deno.env.get("BREVO_SMTP_PORT") || Deno.env.get("SMTP_PORT") || "587");
const SMTP_USERNAME = String(
  Deno.env.get("BREVO_SMTP_USERNAME") ||
    Deno.env.get("BREVO_SMTP_USER") ||
    Deno.env.get("SMTP_USERNAME") ||
    Deno.env.get("SMTP_USER") ||
    "",
).trim();
const SMTP_PASSWORD = String(
  Deno.env.get("BREVO_SMTP_PASSWORD") ||
    Deno.env.get("BREVO_SMTP_PASS") ||
    Deno.env.get("SMTP_PASSWORD") ||
    Deno.env.get("SMTP_PASS") ||
    "",
).trim();
const SMTP_SECURE = String(Deno.env.get("BREVO_SMTP_SECURE") || Deno.env.get("SMTP_SECURE") || "")
  .trim()
  .toLowerCase();
const REPORT_TO_EMAIL = String(Deno.env.get("MODERATION_REPORT_TO_EMAIL") || "").trim();
const REPORT_FROM_EMAIL = String(
  Deno.env.get("MODERATION_REPORT_FROM_EMAIL") || REPORT_TO_EMAIL,
).trim();
const REPORT_FROM_NAME =
  String(Deno.env.get("MODERATION_REPORT_FROM_NAME") || "UniVerse").trim() || "UniVerse";

export type ModerationMailDeliveryResult = {
  errorMessage?: string;
  status: "failed" | "sent" | "skipped";
};

type DeliveryParams = {
  htmlContent: string;
  reportId: string;
  reporterEmail: string;
  subject: string;
  targetType: string;
  textContent: string;
};

function truncateError(value: unknown) {
  const normalized = String(value || "").trim();
  return normalized.length <= 500 ? normalized : `${normalized.slice(0, 497)}...`;
}

function hasSmtpConfig() {
  return Boolean(SMTP_HOST && SMTP_PORT > 0 && SMTP_USERNAME && SMTP_PASSWORD);
}

async function sendViaBrevoApi(params: DeliveryParams): Promise<ModerationMailDeliveryResult> {
  try {
    const response = await fetch(BREVO_EMAIL_API_URL, {
      body: JSON.stringify({
        sender: { email: REPORT_FROM_EMAIL, name: REPORT_FROM_NAME },
        to: [{ email: REPORT_TO_EMAIL }],
        ...(params.reporterEmail ? { replyTo: { email: params.reporterEmail } } : {}),
        htmlContent: params.htmlContent,
        subject: params.subject,
        textContent: params.textContent,
      }),
      headers: {
        accept: "application/json",
        "api-key": BREVO_API_KEY,
        "content-type": "application/json",
      },
      method: "POST",
    });
    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      return {
        errorMessage: truncateError(errorBody || `brevo-http-${response.status}`),
        status: "failed",
      };
    }
    logInfo("reports/email", "moderation-report-email-sent", {
      deliveryMode: "brevo-api",
      reportId: params.reportId,
      targetType: params.targetType,
    });
    return { status: "sent" };
  } catch (error) {
    logError("reports/email", "moderation-report-email-send-failed", error, {
      deliveryMode: "brevo-api",
      reportId: params.reportId,
      targetType: params.targetType,
    });
    return {
      errorMessage: truncateError(
        (error as { message?: string })?.message || error || "brevo-send-failed",
      ),
      status: "failed",
    };
  }
}

async function sendViaSmtp(params: DeliveryParams): Promise<ModerationMailDeliveryResult> {
  try {
    const transporter = nodemailer.createTransport({
      auth: { pass: SMTP_PASSWORD, user: SMTP_USERNAME },
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE === "true" || (SMTP_SECURE !== "false" && SMTP_PORT === 465),
    });
    await transporter.sendMail({
      from: `"${REPORT_FROM_NAME}" <${REPORT_FROM_EMAIL}>`,
      html: params.htmlContent,
      replyTo: params.reporterEmail || undefined,
      subject: params.subject,
      text: params.textContent,
      to: REPORT_TO_EMAIL,
    });
    logInfo("reports/email", "moderation-report-email-sent", {
      deliveryMode: "smtp",
      reportId: params.reportId,
      targetType: params.targetType,
    });
    return { status: "sent" };
  } catch (error) {
    logError("reports/email", "moderation-report-email-send-failed", error, {
      deliveryMode: "smtp",
      reportId: params.reportId,
      targetType: params.targetType,
    });
    return {
      errorMessage: truncateError(
        (error as { message?: string })?.message || error || "smtp-send-failed",
      ),
      status: "failed",
    };
  }
}

export async function deliverModerationReportEmail(
  params: DeliveryParams,
): Promise<ModerationMailDeliveryResult> {
  if (!REPORT_TO_EMAIL || !REPORT_FROM_EMAIL) {
    return { errorMessage: "moderation-report-addresses-missing", status: "skipped" };
  }
  if (!BREVO_API_KEY && !hasSmtpConfig()) {
    logInfo("reports/email", "moderation-report-email-skipped", {
      deliveryMode: "none",
      reason: "delivery-config-missing",
      reportId: params.reportId,
      targetType: params.targetType,
    });
    return { errorMessage: "moderation-report-delivery-config-missing", status: "skipped" };
  }

  if (BREVO_API_KEY) {
    const apiResult = await sendViaBrevoApi(params);
    if (apiResult.status === "sent" || !hasSmtpConfig()) return apiResult;
    logInfo("reports/email", "moderation-report-email-fallback", {
      from: "brevo-api",
      reason: apiResult.errorMessage || "brevo-send-failed",
      reportId: params.reportId,
      to: "smtp",
      targetType: params.targetType,
    });
  }
  return sendViaSmtp(params);
}
