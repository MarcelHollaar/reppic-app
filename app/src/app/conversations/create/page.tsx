"use client";
import React, { useEffect } from "react";
import authMiddleware from "@/middleware/authMiddleware";
import { useBreadcrumb } from "@/context/BreadcrumbContext";
import { useSearchParams } from "next/navigation";
import { ConversationCreateProvider } from "@/app/conversations/create/src/providers/ConversationCreateProvider";
import { ConversationCreatePage } from "@/app/conversations/create/src/ConversationCreatePage";
import { Toaster } from "react-hot-toast";
import { AudioRecorderProvider } from "@/context/AudioRecorderContext";

function ConversationPage() {
  const { setBreadcrumbs } = useBreadcrumb();
  const searchParams = useSearchParams();
  const editBlobId = searchParams.get("editBlobId");
  const conversationId = searchParams.get("conversationId");
  useEffect(() => {
    setBreadcrumbs([
      { label: "Conversations", href: "/conversations" },
      {
        label:
          editBlobId || conversationId
            ? "Edit conversation"
            : "Create new conversation",
        href: "#",
      },
    ]);
  }, []);
  return (
    <AudioRecorderProvider>
      <ConversationCreateProvider createInitialConversation={!conversationId}>
        <ConversationCreatePage />
      </ConversationCreateProvider>
      <Toaster />
    </AudioRecorderProvider>
  );
}

export default authMiddleware(ConversationPage);
