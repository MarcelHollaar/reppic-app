import { NextRequest, NextResponse } from "next/server";
import { ConversationModel } from "../../../../models/conversation";
import { authMiddleware } from "../../../../middleware/authMiddleware";
import { prisma } from "../../../../utils/prisma";
import { signAudioAccess } from "../../../../utils/audioSigning";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    // Require authentication — these are private recordings.
    const authCheck = await authMiddleware(req);
    if (authCheck) return authCheck;
    const requester = (req as any).user;

    const { conversationId } = await params;

    if (!conversationId) {
      return NextResponse.json(
        { message: "conversationId is required" },
        { status: 400 }
      );
    }

    const conversation = await ConversationModel.getConversationById(
      conversationId,
      "",
      false
    );

    if (!conversation) {
      return NextResponse.json(
        { message: "Conversation not found" },
        { status: 404 }
      );
    }

    if (conversation.audio_deleted_at) {
      return NextResponse.json(
        { message: "Audio has been removed after analysis retention period" },
        { status: 410 }
      );
    }

    const userId = conversation.user_id;

    // Authorization: the owner may always access; a manager may access
    // recordings of their own company; superadmin may access any. Anyone else
    // gets 404 so we don't reveal the recording exists.
    const role = requester?.role?.name;
    let allowed = userId === requester?.id || role === "superadmin";
    if (!allowed && role === "manager") {
      const owner = await prisma.user.findUnique({
        where: { id: userId },
        select: { company_id: true },
      });
      allowed = Boolean(
        owner?.company_id &&
          requester?.company_id &&
          owner.company_id === requester.company_id,
      );
    }
    if (!allowed) {
      return NextResponse.json(
        { message: "Conversation not found" },
        { status: 404 }
      );
    }

    // Hand out a short-lived, signed URL to the authenticated byte proxy
    // instead of a permanent public FTP URL. The link expires and cannot be
    // forged, so learning the IDs no longer grants unauthenticated access.
    const { exp, sig } = signAudioAccess(conversationId, userId);
    const audioUrl = `/api/audio-stream/file?c=${encodeURIComponent(
      conversationId,
    )}&u=${encodeURIComponent(userId)}&exp=${exp}&sig=${sig}`;

    return NextResponse.json({
      audioUrl,
    });
  } catch (error: any) {
    console.error("[AudioStream] Error:", error);
    return NextResponse.json(
      { message: error.message || "Failed to get audio URL" },
      { status: 500 }
    );
  }
}
