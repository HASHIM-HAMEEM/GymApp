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

interface ReceiptUpdate {
  receipt_id: string;
  action: "delivered" | "failed" | "unknown" | "retry";
  error_code?: string;
  error_message?: string | null;
}

interface UpdateCounts {
  delivered: number;
  failed: number;
  unknown: number;
  retried: number;
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

function retryUpdate(receipt: PendingReceipt): ReceiptUpdate {
  return receipt.attempts >= 5
    ? {
        receipt_id: receipt.id,
        action: "unknown",
        error_code: "RECEIPT_NOT_AVAILABLE",
        error_message: "Expo did not return a final receipt after repeated checks.",
      }
    : { receipt_id: receipt.id, action: "retry" };
}

async function applyUpdates(service: SupabaseClient, updates: ReceiptUpdate[]): Promise<UpdateCounts> {
  const { data, error } = await service.rpc("apply_push_receipt_updates", { p_updates: updates });
  if (error) {
    throw new ApiError(500, "RECEIPT_UPDATE_FAILED", "Push receipt results could not be saved.");
  }
  const row = Array.isArray(data) ? data[0] : data;
  return {
    delivered: Number(row?.delivered ?? 0),
    failed: Number(row?.failed ?? 0),
    unknown: Number(row?.unknown ?? 0),
    retried: Number(row?.retried ?? 0),
  };
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

    const ticketIds = receipts.map((receipt) => receipt.expo_ticket_id).filter(Boolean);
    const result = await fetchWithRetry(ticketIds, 1);

    if (!result.ok) {
      const counts = await applyUpdates(service, receipts.map(retryUpdate));
      return successResponse({
        processed: counts.unknown,
        delivered: 0,
        failed: 0,
        unknown: counts.unknown,
        retried: receipts.length - counts.unknown,
        error: `Expo receipt service returned ${result.status}`,
      });
    }

    const receiptResults = result.data ?? {};
    const invalidTokens: string[] = [];
    const updates = receipts.map((receipt): ReceiptUpdate => {
      const expoReceipt = receiptResults[receipt.expo_ticket_id];
      if (!expoReceipt) return retryUpdate(receipt);
      if (expoReceipt.status === "ok") {
        return { receipt_id: receipt.id, action: "delivered" };
      }
      const errorCode = expoReceipt.details?.error ?? "EXPO_RECEIPT_ERROR";
      if (!TERMINAL_ERRORS.has(errorCode)) return retryUpdate(receipt);
      if (errorCode === "DeviceNotRegistered") invalidTokens.push(receipt.expo_push_token);
      return {
        receipt_id: receipt.id,
        action: "failed",
        error_code: errorCode,
        error_message: expoReceipt.message ?? null,
      };
    });

    const counts = await applyUpdates(service, updates);
    if (invalidTokens.length > 0) {
      await service.rpc("disable_push_devices", { p_expo_push_tokens: invalidTokens });
    }

    return successResponse({
      processed: counts.delivered + counts.failed + counts.unknown,
      delivered: counts.delivered,
      failed: counts.failed,
      unknown: counts.unknown,
      retried: receipts.length - counts.delivered - counts.failed - counts.unknown,
    });
  }),
);
