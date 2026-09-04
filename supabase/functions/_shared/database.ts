import type { SupabaseClient } from "./deps.ts";
import { ApiError, isRecord } from "./http.ts";
import { isUuid, normalizeEmail, type MemberInvitationInput } from "./validation.ts";

export interface CreatedInvitation {
  invitationId: string;
  memberId: string;
  memberNumber: string;
}

export interface ClaimedInvitation {
  authUserId: string | null;
  email: string;
  invitationId: string;
  sendAttempts: number;
}

export type InvitationLinkState = "linked" | "unlinked" | "unknown";

const MEMBER_NUMBER_PATTERN = /^MRD-[0-9]{4}$/;

function resultRow(data: unknown): Record<string, unknown> | null {
  if (isRecord(data)) return data;
  if (Array.isArray(data) && data.length === 1 && isRecord(data[0])) return data[0];
  return null;
}

function contractError(): ApiError {
  return new ApiError(500, "DATABASE_CONTRACT_ERROR", "The invitation could not be processed.");
}

function rpcError(error: { code?: string; message?: string } | null | undefined, fallback: ApiError): ApiError {
  switch (error?.code) {
    case "42501":
      return new ApiError(403, "ADMIN_REQUIRED", "An active administrator account is required.");
    case "23505":
      return new ApiError(409, "INVITATION_EXISTS", "An account or invitation already exists for this email.");
    case "22023":
      return new ApiError(400, "VALIDATION_ERROR", error.message || "The invitation details are invalid.");
    case "P0002":
      return new ApiError(404, "NOT_FOUND", "The requested record was not found.");
    default:
      return fallback;
  }
}

export async function createMemberInvitation(
  caller: SupabaseClient,
  input: MemberInvitationInput,
): Promise<CreatedInvitation> {
  const args: Record<string, unknown> = {
    p_first_name: input.firstName,
    p_last_name: input.lastName,
    p_email: input.email,
  };
  if (input.phone !== null) args.p_phone = input.phone;
  if (input.dateOfBirth !== null) args.p_date_of_birth = input.dateOfBirth;
  if (input.emergencyName !== null) args.p_emergency_contact_name = input.emergencyName;
  if (input.emergencyPhone !== null) args.p_emergency_contact_phone = input.emergencyPhone;
  if (input.nationalId !== null) args.p_national_id = input.nationalId;
  if (input.address !== null) args.p_address = input.address;
  if (input.planId !== null) args.p_plan_id = input.planId;
  if (input.membershipStartDate !== null) args.p_membership_start_date = input.membershipStartDate;
  if (input.amountPaid !== null) args.p_amount_paid = input.amountPaid;
  if (input.paymentMethod !== null) args.p_payment_method = input.paymentMethod;

  const { data, error } = await caller.rpc("create_member_invitation", args);
  if (error) {
    throw rpcError(error, new ApiError(500, "INVITATION_CREATE_FAILED", "The member invitation could not be created."));
  }

  const row = resultRow(data);
  if (!row) throw contractError();

  const invitationId = row.invitation_id;
  const memberId = row.member_id;
  const memberNumber = row.member_number;
  if (
    !isUuid(invitationId) ||
    !isUuid(memberId) ||
    typeof memberNumber !== "string" ||
    !MEMBER_NUMBER_PATTERN.test(memberNumber)
  ) {
    throw contractError();
  }

  return { invitationId, memberId, memberNumber };
}

export async function claimMemberInvitationResend(
  caller: SupabaseClient,
  invitationId: string,
): Promise<ClaimedInvitation> {
  const { data, error } = await caller.rpc("claim_member_invitation_resend", {
    p_invitation_id: invitationId,
  });
  if (error) {
    throw rpcError(error, new ApiError(500, "INVITATION_LOOKUP_FAILED", "The invitation could not be checked."));
  }

  const row = resultRow(data);
  switch (row?.outcome) {
    case "not_found":
      throw new ApiError(404, "INVITATION_NOT_FOUND", "The invitation was not found.");
    case "not_eligible":
      throw new ApiError(409, "INVITATION_NOT_ELIGIBLE", "Only unaccepted, unexpired invitations can be resent.");
    case "retry_too_soon":
      throw new ApiError(429, "INVITATION_RETRY_TOO_SOON", "Wait before resending this invitation.");
    case "attempt_limit":
      throw new ApiError(429, "INVITATION_ATTEMPT_LIMIT", "This invitation has reached its resend limit.");
    case "not_authorized":
      throw new ApiError(403, "ADMIN_REQUIRED", "An active administrator account is required.");
    case "claimed":
      break;
    default:
      throw contractError();
  }
  if (!row) throw contractError();

  const claimedId = row.invitation_id;
  const authUserId = row.auth_user_id;
  const sendAttempts = row.send_attempts;
  let email: string;
  try {
    email = normalizeEmail(row.email);
  } catch {
    throw contractError();
  }

  if (
    !isUuid(claimedId) ||
    claimedId.toLowerCase() !== invitationId.toLowerCase() ||
    (authUserId !== null && !isUuid(authUserId)) ||
    !Number.isSafeInteger(sendAttempts) ||
    (sendAttempts as number) < 1
  ) {
    throw contractError();
  }

  return {
    authUserId: authUserId as string | null,
    email,
    invitationId: claimedId,
    sendAttempts: sendAttempts as number,
  };
}

export async function finalizeMemberInvitation(
  service: SupabaseClient,
  invitationId: string,
  authUserId: string,
): Promise<boolean> {
  try {
    const { error } = await service.rpc("finalize_member_invitation", {
      p_auth_user_id: authUserId,
      p_invitation_id: invitationId,
    });
    return !error;
  } catch {
    return false;
  }
}

export async function markMemberInvitationFailed(
  service: SupabaseClient,
  invitationId: string,
  reason: string,
): Promise<void> {
  try {
    const { error } = await service.rpc("mark_member_invitation_failed", {
      p_error: reason.slice(0, 2000),
      p_invitation_id: invitationId,
    });
    if (error) console.error("Could not mark the member invitation as failed");
  } catch {
    console.error("Could not mark the member invitation as failed");
  }
}

export async function invitationLinkState(
  service: SupabaseClient,
  invitationId: string,
  authUserId: string,
): Promise<InvitationLinkState> {
  try {
    const { data, error } = await service.rpc("member_invitation_auth_user", {
      p_invitation_id: invitationId,
    });
    if (error || data === undefined) return "unknown";
    const linkedAuthUserId = data === null ? null : String(data);
    return linkedAuthUserId === authUserId ? "linked" : "unlinked";
  } catch {
    return "unknown";
  }
}
