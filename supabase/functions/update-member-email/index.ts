import { handlePost, readJsonObject, successResponse, ApiError, assertOnlyKeys, isRecord } from "../_shared/http.ts";
import { requireActiveAdmin } from "../_shared/supabase.ts";
import { isUuid, normalizeEmail } from "../_shared/validation.ts";

/**
 * Correct a not-yet-onboarded member's sign-in email. The database RPC owns
 * every rule (admin only, not removed, not activated, uniqueness) and
 * retargets the pending invitation; this function's only extra job is moving
 * the linked auth account — if one exists — to the same address so the next
 * "Resend invitation" reaches the corrected inbox.
 */
Deno.serve((request) =>
  handlePost(request, async () => {
    const context = await requireActiveAdmin(request);
    const body = await readJsonObject(request);
    assertOnlyKeys(body, ["memberId", "email"]);
    if (!isUuid(body.memberId)) {
      throw new ApiError(400, "VALIDATION_ERROR", "memberId must be a valid UUID.");
    }
    const email = normalizeEmail(body.email);

    const { data, error } = await context.caller.rpc("update_member_email", {
      p_member_id: body.memberId,
      p_email: email,
    });
    if (error) {
      switch (error.code) {
        case "42501":
          throw new ApiError(403, "ADMIN_REQUIRED", "An active administrator account is required.");
        case "23505":
          throw new ApiError(409, "INVITATION_EXISTS", error.message || "A member already uses this email.");
        case "22023":
          throw new ApiError(400, "VALIDATION_ERROR", error.message || "The email could not be changed.");
        case "P0002":
          throw new ApiError(404, "NOT_FOUND", "The member was not found.");
        default:
          throw new ApiError(500, "EMAIL_UPDATE_FAILED", "The email could not be changed.");
      }
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!isRecord(row)) {
      throw new ApiError(500, "DATABASE_CONTRACT_ERROR", "The email change could not be confirmed.");
    }

    const authUserId = typeof row.auth_user_id === "string" ? row.auth_user_id : null;
    const oldEmail = typeof row.old_email === "string" ? row.old_email : null;
    if (authUserId) {
      const { error: authError } = await context.service.auth.admin.updateUserById(authUserId, { email });
      if (authError) {
        // Roll the database back so members.email and the auth account never disagree.
        if (oldEmail) {
          await context.caller.rpc("update_member_email", { p_member_id: body.memberId, p_email: oldEmail });
        }
        throw new ApiError(502, "EMAIL_UPDATE_FAILED", "The sign-in account could not be updated. Try again later.");
      }
    }

    return successResponse({ memberId: body.memberId, email, status: "updated" });
  })
);
