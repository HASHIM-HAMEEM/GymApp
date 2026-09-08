import { claimMemberInvitationResend } from "../_shared/database.ts";
import { handlePost, readJsonObject, successResponse } from "../_shared/http.ts";
import { deliverMemberInvitation } from "../_shared/invitations.ts";
import { requireActiveAdmin } from "../_shared/supabase.ts";
import { parseInvitationId } from "../_shared/validation.ts";

Deno.serve((request) =>
  handlePost(request, async () => {
    const context = await requireActiveAdmin(request);
    const invitationId = parseInvitationId(await readJsonObject(request));
    const invitation = await claimMemberInvitationResend(context.caller, invitationId);

    await deliverMemberInvitation(context, {
      email: invitation.email,
      expectedAuthUserId: invitation.authUserId,
      invitationId: invitation.invitationId,
      newAuthUserExpected: invitation.authUserId === null,
      sendAttempt: invitation.sendAttempts,
    });

    return successResponse({
      invitationId: invitation.invitationId,
      sendAttempts: invitation.sendAttempts,
      status: "sent",
    });
  })
);
