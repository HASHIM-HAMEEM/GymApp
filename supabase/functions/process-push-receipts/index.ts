import { ApiError, handlePost, successResponse } from "../_shared/http.ts";
import { createClient, type SupabaseClient } from "../_shared/deps.ts";

interface PendingReceipt {
  id: string;
  expo_ticket_id: string;
  expo_push_token: string;
  notice_id: string;
  attempts: number;
}

interface ExpoReceiptResult {
  status?: string;
  message?: string;
  details?: { error?: string };
}

const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [2_000, 4_000, 8_000];

const TERMINAL_ERRORS = new Set([
  "DeviceNotRegistered",
  "InvalidCredentials",
  "MessageTooBig",
  "InvalidNotification",
  "MismatchSenderId",
]);

function loadServiceKey(): string {
  const key = Deno.env.get("SUPABASE_SECRET_KEY")?.trim() || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  if (!key) {
    throw new ApiError(500, "SERVER_MISCONFIGURED", "The service is not configured correctly.");
  }
  return key;
}

function serviceClient(key: string, url: string): SupabaseClient {
  return createClient(url, key, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
}

async function retryOrExpire(service: SupabaseClient, receipt: PendingReceipt): Promise<boolean> {
  if (receipt.attempts >= 5) {
    const { error } = await service.rpc("update_push_receipt_status", {
      p_receipt_id: receipt.id,
      p_status: "unknown",
      p_error_code: "RECEIPT_NOT_AVAILABLE",
      p_error_message: "Expo did not return a final receipt after repeated checks.",
    });
    return !error;
  }
  await service.rpc("bump_push_receipt_attempt", { p_receipt_id: receipt.id });
  return false;
}

async function fetchWithRetry(
  ticketIds: string[],
  attempt: number,
): Promise<{ ok: boolean; status: number; data?: Record<string, ExpoReceiptResult> }> {
  try {
    const response = await fetch("https://exp.host/--/api/v2/push/getReceipts", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id: ticketIds }),
      signal: AbortSignal.timeout(10_000),
    });

    if (response.status === 429 || response.status >= 500) {
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, BACKOFF_MS[attempt - 1] ?? 8_000));
        return fetchWithRetry(ticketIds, attempt + 1);
      }
      return { ok: false, status: response.status };
    }

    if (!response.ok) {
      return { ok: false, status: response.status };
    }

    const payload = await response.json() as { data?: Record<string, ExpoReceiptResult> };
    return { ok: true, status: response.status, data: payload.data ?? {} };
  } catch (error) {
    if (attempt < MAX_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, BACKOFF_MS[attempt - 1] ?? 8_000));
      return fetchWithRetry(ticketIds, attempt + 1);
    }
    throw error;
  }
}

Deno.serve((request) =>
  handlePost(request, async () => {
    const serviceKey = loadServiceKey();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
    if (!supabaseUrl) {
      throw new ApiError(500, "SERVER_MISCONFIGURED", "The service is not configured correctly.");
    }

    const service = serviceClient(serviceKey, supabaseUrl);
    const { data: cronAuthorized, error: cronError } = await service.rpc("verify_cron_secret", {
      p_secret: request.headers.get("x-cron-secret"),
    });
    if (cronError || cronAuthorized !== true) {
      throw new ApiError(401, "AUTH_REQUIRED", "Cron authorization is invalid.");
    }
    const url = new URL(request.url);
    const limitParam = url.searchParams.get("limit");
    const limit = limitParam ? Math.min(Math.max(Number(limitParam) || 100, 1), 1000) : 100;

    const { data: pending, error: claimError } = await service.rpc("claim_pending_push_receipts", {
      p_limit: limit,
    });
    if (claimError) {
      throw new ApiError(500, "RECEIPT_CLAIM_FAILED", "Pending push receipts could not be loaded.");
    }

    const receipts = (Array.isArray(pending) ? pending : []) as PendingReceipt[];
    if (receipts.length === 0) {
      return successResponse({ processed: 0, delivered: 0, failed: 0, unknown: 0, retried: 0 });
    }

    const ticketIds = receipts.map((r) => r.expo_ticket_id).filter(Boolean) as string[];
    const result = await fetchWithRetry(ticketIds, 1);

    if (!result.ok) {
      let unknown = 0;
      for (const receipt of receipts) {
        if (await retryOrExpire(service, receipt)) unknown += 1;
      }
      return successResponse({
        processed: unknown,
        delivered: 0,
        failed: 0,
        unknown,
        retried: receipts.length - unknown,
        error: `Expo receipt service returned ${result.status}`,
      });
    }

    const receiptResults = result.data ?? {};
    let delivered = 0;
    let failed = 0;
    let unknown = 0;
    const invalidTokens: string[] = [];

    for (const receipt of receipts) {
      const expoReceipt = receiptResults[receipt.expo_ticket_id];
      if (!expoReceipt) {
        if (await retryOrExpire(service, receipt)) unknown += 1;
        continue;
      }

      if (expoReceipt.status === "ok") {
        const { error } = await service.rpc("update_push_receipt_status", {
          p_receipt_id: receipt.id,
          p_status: "delivered",
        });
        if (!error) delivered += 1;
      } else {
        const errorCode = expoReceipt.details?.error ?? "EXPO_RECEIPT_ERROR";
        const isTerminal = TERMINAL_ERRORS.has(errorCode);
        if (isTerminal) {
          const { error } = await service.rpc("update_push_receipt_status", {
            p_receipt_id: receipt.id,
            p_status: "failed",
            p_error_code: errorCode,
            p_error_message: expoReceipt.message ?? null,
          });
          if (!error) failed += 1;
          if (errorCode === "DeviceNotRegistered") {
            invalidTokens.push(receipt.expo_push_token);
          }
        } else if (await retryOrExpire(service, receipt)) {
          unknown += 1;
        }
      }
    }

    if (invalidTokens.length > 0) {
      await service.rpc("disable_push_devices", {
        p_expo_push_tokens: invalidTokens,
      });
    }

    return successResponse({
      processed: delivered + failed + unknown,
      delivered,
      failed,
      unknown,
      retried: receipts.length - delivered - failed - unknown,
    });
  }),
);
