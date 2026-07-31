"use client";
import React from "react";
import authMiddleware from "@/middleware/authMiddleware";
import ConversationInsightsPage from "@/app/conversations/insights/[id]/src/ConversationInsightsPage";
import {useParams} from "next/navigation";
import {
    ConversationInsightsProvider
} from "@/app/conversations/insights/[id]/src/providers/ConversationInsightsProvider";

function ConversationInsights() {
    const params = useParams();
    const conversationId = params?.id;

    return (
        <ConversationInsightsProvider conversationId={conversationId}>
            <ConversationInsightsPage/>
        </ConversationInsightsProvider>
    );
}

export default authMiddleware(ConversationInsights)
