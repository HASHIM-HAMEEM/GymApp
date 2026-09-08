import { createClient } from "../_shared/deps.ts";
import { ApiError, handlePost, successResponse } from "../_shared/http.ts";

type Reminder = {
  reminder_id: string;
  membership_id: string;
  email: string;
  member_name: string;
  expiry_date: string;
  club_name: string;
};

function required(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new ApiError(500, "SERVER_MISCONFIGURED", "Expiry reminders are not configured.");
  return value;
}

function requiredOne(names: string[]): string {
  for (const name of names) {
    const value = Deno.env.get(name)?.trim();
    if (value) return value;
  }
  throw new ApiError(500, "SERVER_MISCONFIGURED", "Expiry reminders are not configured.");
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? character);
}

Deno.serve((request) => handlePost(request, async () => {
  const supabase = createClient(required("SUPABASE_URL"), requiredOne(["SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY"]), {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
  const { data: cronAuthorized, error: cronError } = await supabase.rpc("verify_cron_secret", {
    p_secret: request.headers.get("x-cron-secret"),
  });
  if (cronError || cronAuthorized !== true) throw new ApiError(401, "AUTH_REQUIRED", "Cron authorization is invalid.");

  const { data: resendKey, error: resendKeyError } = await supabase.rpc("get_expiry_resend_key");
  if (resendKeyError || typeof resendKey !== "string" || !resendKey) {
    throw new ApiError(500, "SERVER_MISCONFIGURED", "Expiry reminder email is not configured.");
  }
  const from = Deno.env.get("REMINDER_FROM_EMAIL")?.trim() || "Apex <auth@scnz.site>";
  const appUrl = Deno.env.get("APP_URL")?.trim() || "https://apexgc.vercel.app";
  const { data, error } = await supabase.rpc("claim_expiry_reminders");
  if (error) throw new ApiError(500, "REMINDER_CLAIM_FAILED", "Expiry reminders could not be claimed.");

  let sent = 0;
  let failed = 0;
  for (const reminder of (data ?? []) as Reminder[]) {
    const member = escapeHtml(reminder.member_name);
    const club = escapeHtml(reminder.club_name);
    const expiry = escapeHtml(reminder.expiry_date);
    let deliveryError: string | null = null;
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json", "Idempotency-Key": `expiry-${reminder.reminder_id}` },
        body: JSON.stringify({
          from,
          to: [reminder.email],
          subject: `${reminder.club_name} membership expires in 5 days`,
          html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#141414"><h1 style="font-size:24px">Your membership expires soon</h1><p>Hello ${member},</p><p>Your ${club} membership expires on <strong>${expiry}</strong>.</p><p>Renew in Apex to keep your club access active.</p><p><a href="${escapeHtml(appUrl)}/membership" style="display:inline-block;background:#111;color:#fff;padding:12px 18px;border-radius:999px;text-decoration:none">Review membership</a></p><p style="color:#666;font-size:13px">If you have already renewed, no action is needed.</p></div>`,
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) deliveryError = `Resend returned ${response.status}`;
    } catch {
      deliveryError = "Email service unavailable";
    }
    await supabase.rpc("record_expiry_reminder", { p_reminder_id: reminder.reminder_id, p_sent: deliveryError === null, p_error: deliveryError });
    if (deliveryError) failed += 1; else sent += 1;
  }
  return successResponse({ attempted: sent + failed, sent, failed });
}));
