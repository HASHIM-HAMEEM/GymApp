import type { User } from "./deps.ts";
import type { AdminRequestContext } from "./supabase.ts";
import { ApiError, isRecord } from "./http.ts";
import {
  finalizeMemberInvitation,
  invitationLinkState,
  markMemberInvitationFailed,
} from "./database.ts";

export interface DeliveryRequest {
  email: string;
  expectedAuthUserId: string | null;
  invitationId: string;
  newAuthUserExpected: boolean;
  sendAttempt?: number;
}

export interface DeliveryResult {
  authUserId: string;
}

function normalizedEmail(value: string | undefined): string {
  return value?.normalize("NFKC").trim().toLowerCase() ?? "";
}

function isConfirmed(user: User): boolean {
  return Boolean(user.email_confirmed_at || user.confirmed_at);
}

function existingAppMetadata(user: User): Record<string, unknown> {
  return isRecord(user.app_metadata) ? user.app_metadata : {};
}

function wasCreatedDuringInvite(user: User, inviteStartedAt: number): boolean {
  const createdAt = Date.parse(user.created_at);
  return Number.isFinite(createdAt) &&
    createdAt >= inviteStartedAt - 10_000 &&
    createdAt <= Date.now() + 10_000;
}

async function failInvitation(
  context: AdminRequestContext,
  request: DeliveryRequest,
  error: ApiError,
  authUserId: string | null = null,
  canDeleteAuthUser = false,
): Promise<never> {
  await markMemberInvitationFailed(context.service, request.invitationId, `${error.code}: ${error.message}`);

  if (authUserId && canDeleteAuthUser) {
    const linkState = await invitationLinkState(context.service, request.invitationId, authUserId);
    if (linkState === "unlinked") {
      try {
        const { error: deleteError } = await context.service.auth.admin.deleteUser(authUserId);
        if (deleteError) console.error("Could not clean up an unlinked auth user");
      } catch {
        console.error("Could not clean up an unlinked auth user");
      }
    }
  }

  throw error;
}

async function resendKey(context: AdminRequestContext): Promise<string> {
  const { data, error } = await context.service.rpc("get_expiry_resend_key");
  if (error || typeof data !== "string" || !data) {
    throw new ApiError(500, "SERVER_MISCONFIGURED", "Invitation email is not configured.");
  }
  return data;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

async function sendInviteWithResend(
  context: AdminRequestContext,
  request: DeliveryRequest,
  tokenHash: string,
  verificationType: "invite" | "recovery",
): Promise<void> {
  const link = `${context.config.redirectUrl}?token_hash=${encodeURIComponent(tokenHash)}&type=${verificationType}`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await resendKey(context)}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `member-invite-${request.invitationId}-${request.sendAttempt ?? 1}`,
    },
    body: JSON.stringify({
      from: "Apex <auth@scnz.site>",
      to: [request.email],
      subject: "Your Apex membership invitation",
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#141414"><h1 style="font-size:24px">Welcome to Apex Athletic Club</h1><p>Your membership account is ready. Use this one-time link to accept your invitation and choose a password.</p><p><a href="${escapeHtml(link)}" style="display:inline-block;background:#111;color:#fff;padding:12px 18px;border-radius:999px;text-decoration:none">Accept invitation</a></p><p style="color:#666;font-size:13px">If you were not expecting this invitation, you can ignore this email.</p></div>`,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new ApiError(502, "INVITATION_SEND_FAILED", "The invitation email could not be sent. Try again later.");
  }
}

async function getExpectedAuthUser(
  context: AdminRequestContext,
  request: DeliveryRequest,
): Promise<User | null> {
  if (!request.expectedAuthUserId) return null;

  try {
    const { data, error } = await context.service.auth.admin.getUserById(request.expectedAuthUserId);
    if (error || !data.user) {
      return failInvitation(
        context,
        request,
        new ApiError(409, "INVITATION_NOT_ELIGIBLE", "The invitation is not linked to an unconfirmed account."),
      );
    }
    return data.user;
  } catch {
    return failInvitation(
      context,
      request,
      new ApiError(503, "AUTH_UNAVAILABLE", "The invitation account could not be checked right now."),
    );
  }
}

export async function deliverMemberInvitation(
  context: AdminRequestContext,
  request: DeliveryRequest,
): Promise<DeliveryResult> {
  const expectedUser = await getExpectedAuthUser(context, request);
  const verificationType: "invite" | "recovery" = expectedUser && isConfirmed(expectedUser)
    ? "recovery"
    : "invite";
  if (expectedUser) {
    if (normalizedEmail(expectedUser.email) !== request.email) {
      return failInvitation(
        context,
        request,
        new ApiError(409, "INVITATION_NOT_ELIGIBLE", "The invitation account does not match the requested email."),
      );
    }

    const expectedRole = existingAppMetadata(expectedUser).role;
    if (expectedRole !== undefined && expectedRole !== "member") {
      return failInvitation(
        context,
        request,
        new ApiError(409, "ACCOUNT_ROLE_CONFLICT", "The invitation email belongs to another account role."),
      );
    }
  }

  let invitedUser: User | null = null;
  let tokenHash = "";
  const inviteStartedAt = Date.now();
  try {
    const { data, error } = await context.service.auth.admin.generateLink({
      type: verificationType,
      email: request.email,
      options: { redirectTo: context.config.redirectUrl },
    });
    if (!error) {
      invitedUser = data.user;
      tokenHash = data.properties.hashed_token;
    }
  } catch {
    invitedUser = null;
  }

  if (!invitedUser || !tokenHash) {
    return failInvitation(
      context,
      request,
      new ApiError(502, "INVITATION_SEND_FAILED", "A fresh invitation link could not be created. Try again later."),
    );
  }

  const authUserId = invitedUser.id;
  const canDeleteAuthUser = request.newAuthUserExpected &&
    request.expectedAuthUserId === null &&
    wasCreatedDuringInvite(invitedUser, inviteStartedAt);
  if (
    normalizedEmail(invitedUser.email) !== request.email ||
    (request.expectedAuthUserId !== null && authUserId !== request.expectedAuthUserId)
  ) {
    return failInvitation(
      context,
      request,
      new ApiError(502, "INVITATION_SEND_FAILED", "The invitation email could not be sent. Try again later."),
      authUserId,
      canDeleteAuthUser,
    );
  }

  if (verificationType === "invite" && isConfirmed(invitedUser)) {
    throw new ApiError(409, "INVITATION_ALREADY_ACCEPTED", "This invitation has already been accepted.");
  }

  const appMetadata = {
    ...(expectedUser ? existingAppMetadata(expectedUser) : {}),
    ...existingAppMetadata(invitedUser),
  };
  if (appMetadata.role !== undefined && appMetadata.role !== "member") {
    return failInvitation(
      context,
      request,
      new ApiError(409, "ACCOUNT_ROLE_CONFLICT", "The invitation email belongs to another account role."),
      authUserId,
      canDeleteAuthUser,
    );
  }

  let metadataUpdated = false;
  try {
    const { error } = await context.service.auth.admin.updateUserById(authUserId, {
      app_metadata: { ...appMetadata, role: "member" },
    });
    metadataUpdated = !error;
  } catch {
    metadataUpdated = false;
  }
  if (!metadataUpdated) {
    return failInvitation(
      context,
      request,
      new ApiError(502, "INVITATION_SEND_FAILED", "The invitation account could not be prepared. Try again later."),
      authUserId,
      canDeleteAuthUser,
    );
  }

  try {
    await sendInviteWithResend(context, request, tokenHash, verificationType);
  } catch (error) {
    return failInvitation(
      context,
      request,
      error instanceof ApiError
        ? error
        : new ApiError(502, "INVITATION_SEND_FAILED", "The invitation email could not be sent. Try again later."),
      authUserId,
      canDeleteAuthUser,
    );
  }

  const finalized = await finalizeMemberInvitation(context.service, request.invitationId, authUserId);
  if (!finalized) {
    const linkState = await invitationLinkState(context.service, request.invitationId, authUserId);
    if (linkState !== "linked") {
      return failInvitation(
        context,
        request,
        new ApiError(500, "INVITATION_LINK_FAILED", "The invitation account could not be linked."),
        authUserId,
        canDeleteAuthUser && linkState === "unlinked",
      );
    }
  }

  return { authUserId };
}
