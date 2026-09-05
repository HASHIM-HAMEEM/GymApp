import { assertOnlyKeys, ApiError, handlePost, readJsonObject, successResponse } from "../_shared/http.ts";
import { requireActiveAdmin } from "../_shared/supabase.ts";
import { isUuid } from "../_shared/validation.ts";

interface PushRow {
  body: string;
  expo_push_token: string;
  notice_id: string;
  title: string;
  urgent: boolean;
}

interface ExpoPushTicket {
  status?: string;
  id?: string;
  details?: { error?: string };
  message?: string;
}

Deno.serve((request) =>
  handlePost(request, async () => {
    const context = await requireActiveAdmin(request);
    const body = await readJsonObject(request);
    assertOnlyKeys(body, ["noticeId"]);
    if (!isUuid(body.noticeId)) {
      throw new ApiError(400, "VALIDATION_ERROR", "A valid notice ID is required.");
    }

    const { data, error } = await context.service.rpc("notice_push_messages", {
      p_notice_id: body.noticeId,
    });
    if (error) {
      throw new ApiError(500, "PUSH_RECIPIENTS_FAILED", "Push recipients could not be loaded.");
    }

    const rows = (Array.isArray(data) ? data : []) as PushRow[];
    let sent = 0;
    let failed = 0;
    const invalidTokens: string[] = [];
    const receipts: unknown[] = [];

    for (let index = 0; index < rows.length; index += 100) {
      const chunk = rows.slice(index, index + 100);
      const messages = chunk.map((row) => ({
        to: row.expo_push_token,
        title: row.title,
        body: row.body.length > 220 ? `${row.body.slice(0, 217)}…` : row.body,
        sound: "default",
        priority: row.urgent ? "high" : "default",
        channelId: "club-notices",
        data: { noticeId: row.notice_id, url: `/notice?id=${row.notice_id}` },
      }));

      let response: Response;
      try {
        response = await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Accept-Encoding": "gzip, deflate",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(messages),
          signal: AbortSignal.timeout(10_000),
        });
      } catch {
        for (const row of chunk) {
          receipts.push({
            expo_push_token: row.expo_push_token,
            expo_ticket_id: null,
            status: "failed",
            error_code: "PUSH_SERVICE_UNAVAILABLE",
            error_message: "The push service could not be reached.",
          });
          failed += 1;
        }
        continue;
      }

      if (!response.ok) {
        for (const row of chunk) {
          receipts.push({
            expo_push_token: row.expo_push_token,
            expo_ticket_id: null,
            status: "failed",
            error_code: "PUSH_SERVICE_REJECTED",
            error_message: "The push service rejected the request.",
          });
          failed += 1;
        }
        continue;
      }

      const payload = await response.json() as { data?: ExpoPushTicket[] };
      const tickets = Array.isArray(payload.data) ? payload.data : [];
      tickets.forEach((ticket, ticketIndex) => {
        const token = chunk[ticketIndex]?.expo_push_token;
        if (ticket.status === "ok") {
          sent += 1;
          if (token) {
            receipts.push({
              expo_push_token: token,
              expo_ticket_id: ticket.id ?? null,
              status: "pending",
            });
          }
        } else {
          failed += 1;
          const errorCode = ticket.details?.error ?? "EXPO_TICKET_ERROR";
          if (token) {
            receipts.push({
              expo_push_token: token,
              expo_ticket_id: null,
              status: "failed",
              error_code: errorCode,
              error_message: ticket.message ?? null,
            });
            if (errorCode === "DeviceNotRegistered") {
              invalidTokens.push(token);
            }
          }
        }
      });
      if (tickets.length < chunk.length) {
        for (let i = tickets.length; i < chunk.length; i++) {
          const token = chunk[i]?.expo_push_token;
          if (token) {
            receipts.push({
              expo_push_token: token,
              expo_ticket_id: null,
              status: "failed",
              error_code: "EXPO_TICKET_MISSING",
              error_message: "Expo did not return a ticket for this message.",
            });
          }
          failed += 1;
        }
      }
    }

    if (receipts.length > 0) {
      await context.service.rpc("record_push_receipts", {
        p_notice_id: body.noticeId,
        p_receipts: receipts,
      });
    }

    if (invalidTokens.length > 0) {
      await context.service.rpc("disable_push_devices", {
        p_expo_push_tokens: invalidTokens,
      });
    }

    return successResponse({
      attempted: rows.length,
      failed,
      sent,
      queued: receipts.filter((r) => {
        const row = r as { status?: string };
        return row.status === "pending";
      }).length,
    });
  })
);
