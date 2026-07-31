"use client";

import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  ReactNode,
} from "react";
import { ConversationDetailResponse } from "@/app/conversations/[id]/src/providers/ConversationDetailProvider";
import { useFetchConversationDetails } from "@/hooks/useFetchConversationDetails";
import { useFetchCustomers } from "@/hooks/useFetchCustomers";
import { useInitializeConversation } from "@/hooks/useInitializeConversation";

interface PageContextType {
  conversationId: string | null;
  conversationIdRef: React.MutableRefObject<string | null>;
  isInitializing: boolean;
  customers: any[];
  refetchConversationDetails: () => Promise<
    ConversationDetailResponse | undefined
  >;
  conversation: ConversationDetailResponse | undefined;
  isLoadingCustomers: boolean;
  isLoadingConversation: boolean;
  isLoadingInitializeConversation: boolean;
}

interface PageProviderProps {
  children: ReactNode;
  createInitialConversation?: boolean;
}

const PageContext = createContext<PageContextType | undefined>(undefined);

export const ConversationCreateProvider: React.FC<PageProviderProps> = ({
  children,
  createInitialConversation = true,
}) => {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [customers, setCustomers] = useState<any[]>([]);
  const [conversation, setConversation] = useState<
    ConversationDetailResponse | undefined
  >(undefined);

  const { fetch: fetchCustomersApi, loading: loadingCustomers } =
    useFetchCustomers();
  const { fetch: fetchConversationApi, loading: loadingConversation } =
    useFetchConversationDetails();
  const {
    fetch: initializeConversationApi,
    loading: loadingInitializeConversation,
  } = useInitializeConversation();

  const fetchCustomers = async () => {
    try {
      const result = await fetchCustomersApi();
      setCustomers(result?.data || []);
    } catch (error) {
      console.error("Error fetching customers:", error);
      setCustomers([]);
    }
  };

  const initializeConversation = async () => {
    try {
      const result = await initializeConversationApi();

      if (!result) {
        throw new Error("Failed to initialize conversation");
      }

      if (result.conversationId) {
        console.log("Conversation initialized:", result.conversationId);
        conversationIdRef.current = result.conversationId;
        setConversationId(result.conversationId);
      }
    } catch (error) {
      console.error("Error initializing conversation:", error);
    } finally {
      setIsInitializing(false);
    }
  };

  const fetchConversationDetails = async (): Promise<
    ConversationDetailResponse | undefined
  > => {
    if (!conversationId) {
      console.error("No conversationId available");
      return undefined;
    }

    try {
      const result = await fetchConversationApi(conversationId);

      if (!result) {
        throw new Error("Failed to fetch conversation details");
      }

      const data: ConversationDetailResponse = result.data;
      conversationIdRef.current = data.id;
      const conversationData = {
        ...data,
        conversation_summaries: data.conversation_summaries_x || [],
      };
      setConversation(conversationData);
      return conversationData;
    } catch (error) {
      console.error("Error fetching conversation details:", error);
      return undefined;
    }
  };

  useEffect(() => {
    if (createInitialConversation) {
      initializeConversation();
    }
  }, [createInitialConversation]);

  useEffect(() => {
    fetchCustomers();
  }, []);

  return (
    <PageContext.Provider
      value={{
        conversationId,
        conversationIdRef,
        isInitializing,
        customers,
        refetchConversationDetails: fetchConversationDetails,
        conversation,
        isLoadingCustomers: loadingCustomers,
        isLoadingConversation: loadingConversation,
        isLoadingInitializeConversation: loadingInitializeConversation,
      }}
    >
      {children}
    </PageContext.Provider>
  );
};

export const usePageContext = () => {
  const context = useContext(PageContext);

  if (context === undefined) {
    throw new Error("usePageContext must be used within a PageProvider");
  }

  return context;
};
