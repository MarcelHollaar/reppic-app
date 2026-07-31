import { NextRequest, NextResponse } from "next/server";
import { verifyAudioAccess } from "../../../utils/audioSigning";
import { downloadFileFromFtp } from "../../../utils/fileStorage";

const RECORDINGS_FOLDER = process.env.RECORDINGS_FOLDER || "recordings";

export const dynamic = "force-dynamic";

/**
 * Authenticated byte proxy for private recordings. Access is granted by a
 * short-lived signed URL minted by the authorized audio-stream endpoint — the
 * recording is streamed from FTP through the app, never exposed as a public
 * URL. Supports HTTP range requests so audio players can seek.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const conversationId = sp.get("c") || "";
  const userId = sp.get("u") || "";
  const exp = Number(sp.get("exp"));
  const sig = sp.get("sig") || "";

  if (!conversationId || !userId || !verifyAudioAccess(conversationId, userId, exp, sig)) {
    return NextResponse.json(
      { message: "Invalid or expired link" },
      { status: 403 },
    );
  }

  // IDs are signed by us, so trusted; downloadFileFromFtp additionally rejects
  // traversal as a backstop.
  const relativePath = `${RECORDINGS_FOLDER}/${userId}/${conversationId}/recording-${conversationId}.webm`;

  let buffer: Buffer;
  try {
    buffer = await downloadFileFromFtp(relativePath);
  } catch {
    return NextResponse.json({ message: "Recording not found" }, { status: 404 });
  }

  const total = buffer.length;
  const range = req.headers.get("range");
  if (range) {
    const match = /bytes=(\d+)-(\d*)/.exec(range);
    if (match) {
      const start = parseInt(match[1], 10);
      const end = match[2] ? Math.min(parseInt(match[2], 10), total - 1) : total - 1;
      if (Number.isFinite(start) && start <= end && start < total) {
        const chunk = buffer.subarray(start, end + 1);
        return new NextResponse(chunk, {
          status: 206,
          headers: {
            "Content-Type": "audio/webm",
            "Content-Range": `bytes ${start}-${end}/${total}`,
            "Accept-Ranges": "bytes",
            "Content-Length": String(chunk.length),
            "Cache-Control": "private, no-store",
          },
        });
      }
    }
  }

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "audio/webm",
      "Accept-Ranges": "bytes",
      "Content-Length": String(total),
      "Cache-Control": "private, no-store",
    },
  });
}
