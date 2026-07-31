"use client";

import {types} from "@/app/api/utils/type-constants";
import {getAuthHeaders} from "@/utils/getAuthHeaders";
import {createContext, FC, ReactNode, useContext, useEffect, useRef, useState,} from "react";
import {ConversationDetailResponse} from "@/app/conversations/[id]/src/providers/ConversationDetailProvider";

interface ConversationInsightsContextType {
    conversationId: string | string[] | undefined;
    conversation: ConversationDetailResponse | undefined;
}

interface ConversationInsightsProviderProps {
    children: ReactNode;
    conversationId: string | string[] | undefined;
}

const ConversationInsightsContext = createContext<
    ConversationInsightsContextType | undefined
>(undefined);

export const ConversationInsightsProvider: FC<
    ConversationInsightsProviderProps
> = ({ children, conversationId }) => {
    const [conversation, setConversation] = useState<
        ConversationDetailResponse | undefined
    >(undefined);

    const fetchConversationDetails = async (): Promise<void> => {
        const headers = getAuthHeaders({}, true);

        if (!headers) {
            console.error("No auth token available");
            return;
        }

        try {
            const response = await fetch(
                `/api/conversations/?id=${conversationId}&type=${types.GET_CONVERSATIONS}`,
                {
                    method: "GET",
                    headers: headers,
                }
            );

            if (!response.ok) {
                throw new Error("Failed to fetch conversation details");
            }

            const data: ConversationDetailResponse = (await response.json()).data;

            setConversation({
                ...data,
                conversation_summaries: data.conversation_summaries_x || [],
            });
        } catch (error) {
            console.error("Error fetching conversation details:", error);
        }
    };

    useEffect(() => {
        if (conversationId) {
            void fetchConversationDetails();
        }
    }, [conversationId]);

    return (
        <ConversationInsightsContext.Provider
            value={{
                conversationId,
                conversation,
            }}
        >
            {children}
        </ConversationInsightsContext.Provider>
    );
};

export const useConversationInsightsContext = () => {
    const context = useContext(ConversationInsightsContext);

    if (context === undefined) {
        throw new Error(
            "useConversationInsightsContext must be used within a ConversationInsightsProvider"
        );
    }

    return context;
};
