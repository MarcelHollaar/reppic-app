import { prisma } from "./prisma";

type Requester = {
  id?: string;
  role?: { name?: string } | null;
  company_id?: string | null;
};

/**
 * Authorize access to a single conversation by its owner.
 *
 * Mirrors the rule already used by the audio-stream / audio-chunks routes:
 * - the owner may always access,
 * - a manager may access conversations of users in their own company,
 * - a superadmin may access any,
 * - anyone else is denied.
 *
 * Use this on read paths that fetch a conversation unscoped (passing "" to
 * ConversationModel.getConversationById). Write paths should instead stay
 * owner-only by passing the requester's id to getConversationById.
 */
export async function canAccessConversation(
  ownerUserId: string | null | undefined,
  requester: Requester,
): Promise<boolean> {
  if (!ownerUserId) return false;

  const role = requester?.role?.name;
  if (ownerUserId === requester?.id || role === "superadmin") return true;

  if (role === "manager") {
    const owner = await prisma.user.findUnique({
      where: { id: ownerUserId },
      select: { company_id: true },
    });
    return Boolean(
      owner?.company_id &&
        requester?.company_id &&
        owner.company_id === requester.company_id,
    );
  }

  return false;
}
