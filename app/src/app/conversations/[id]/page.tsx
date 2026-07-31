"use client";
import authMiddleware from "@/middleware/authMiddleware";
import { useParams } from "next/navigation";
import { ConversationDetailPage } from "./src/ConversationDetailPage";
import { ConversationDetailProvider } from "./src/providers/ConversationDetailProvider";
import { AudioRecorderProvider } from "@/context/AudioRecorderContext";
import { Toaster } from "react-hot-toast";

function ConversationSummary() {
  const params = useParams();
  const conversationId = params?.id;

  return (
    <>
      <AudioRecorderProvider>
        <ConversationDetailProvider conversationId={conversationId}>
          <ConversationDetailPage />
        </ConversationDetailProvider>
      </AudioRecorderProvider>
      <Toaster />
    </>
  );
}

export default authMiddleware(ConversationSummary);
