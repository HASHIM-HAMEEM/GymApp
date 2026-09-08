import { createMemberInvitation } from "../_shared/database.ts";
import { handlePost, readJsonObject, successResponse } from "../_shared/http.ts";
import { deliverMemberInvitation } from "../_shared/invitations.ts";
import { requireActiveAdmin } from "../_shared/supabase.ts";
import { parseMemberInvitationInput } from "../_shared/validation.ts";

Deno.serve((request) =>
  handlePost(request, async () => {
    const context = await requireActiveAdmin(request);
    const input = parseMemberInvitationInput(await readJsonObject(request));
    const invitation = await createMemberInvitation(context.caller, input);

    await deliverMemberInvitation(context, {
      email: input.email,
      expectedAuthUserId: null,
      invitationId: invitation.invitationId,
      newAuthUserExpected: true,
      sendAttempt: 1,
    });

    return successResponse(
      {
        invitationId: invitation.invitationId,
        memberId: invitation.memberId,
        memberNumber: invitation.memberNumber,
        status: "sent",
      },
      201,
    );
  })
);
