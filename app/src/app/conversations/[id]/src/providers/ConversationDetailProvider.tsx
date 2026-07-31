"use client";

import {
  createContext,
  FC,
  ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useFetchConversationDetails } from "../../../../../hooks/useFetchConversationDetails";
import { useFetchCustomers } from "../../../../../hooks/useFetchCustomers";
import { TWIN_AI_STATUS } from "@/configs/constants";

interface ConversationDetailContextType {
  conversation: ConversationDetailResponse | undefined;
  conversationIdRef: React.MutableRefObject<string | null>;
  customers: any[];
  refetchConversationDetails: () => Promise<
    ConversationDetailResponse | undefined
  >;
  isLoadingCustomers: boolean;
  isLoadingConversation: boolean;
}

export interface ConversationDetailProviderProps {
  children: ReactNode;
  conversationId?: string | string[] | undefined;
}

export interface Customer {
  created_at: string;
  id: string;
  name: string;
  updated_at: string;
  user_id: string;
}

export interface ConversationSummaries {
  summary_text: string;
  total_score: number;
  salesperson_percentage: number | null;
  atmosphere: string;
  learning_points: string[];
  phases: Phase[];
  resistances: Resistance[];
  customer_type: string;
}

export interface Phase {
  phaseNumber: number;
  phaseTitle: string;
  cards: any[];
  AnalysePunten: string;
  DeelsGoedVoorbeeld: string;
  Doel: string;
  Fase: number;
  FoutVoorbeeld: string;
  GoedVoorbeeld: string;
  PuntenDeelsGoed: number;
  PuntenFout: number;
  PuntenGoed: number;
  Redenering: string;
  Score: number;
  Titel: string;
  ToekenningPuntenDeelsGoed: string;
  ToekenningPuntenFout: string;
  ToekenningPuntenGoed: string;
}

export interface Resistance {
  Conclusion: string;
  Objection: string;
  Reasoning: string;
  Response: string;
}

export interface ConversationDetailResponse {
  conversationId: string;
  conversation_status: string;
  id: string;
  customer: Customer;
  conversation_summaries: ConversationSummaries[];
  conversation_summaries_x: ConversationSummaries[];
  title: string;
  created_at: string;
  hasRecording: boolean;
  notes: string;
  customer_type: string | "Groen";
  sourceFileUrl: string | null;
  hasChunks: boolean;
  transcript_status: "processing" | "completed" | "pending";
  twinai_run_status: TWIN_AI_STATUS;
  file_duration: number;
  is_merging_chunks: boolean;
}

const ConversationDetailContext = createContext<
  ConversationDetailContextType | undefined
>(undefined);

export const ConversationDetailProvider: FC<
  ConversationDetailProviderProps
> = ({ children, conversationId }) => {
  const [conversation, setConversation] = useState<
    ConversationDetailResponse | undefined
  >(undefined);
  const conversationIdRef = useRef<string | null>(null);
  const [customers, setCustomers] = useState<any[]>([]);

  const { fetch: fetchCustomersApi, loading: loadingCustomers } =
    useFetchCustomers();
  const { fetch: fetchConversationApi, loading: loadingConversation } =
    useFetchConversationDetails();

  const fetchCustomers = async () => {
    try {
      const result = await fetchCustomersApi();
      setCustomers(result?.data || []);
    } catch (error) {
      console.error("Error fetching customers:", error);
      setCustomers([]);
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
      const result = await fetchConversationApi(conversationId as string);

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
    if (conversationId) {
      void fetchConversationDetails();
    }
  }, [conversationId]);

  useEffect(() => {
    void fetchCustomers();
  }, []);

  return (
    <ConversationDetailContext.Provider
      value={{
        refetchConversationDetails: fetchConversationDetails,
        conversation,
        conversationIdRef,
        customers,
        isLoadingCustomers: loadingCustomers,
        isLoadingConversation: loadingConversation,
      }}
    >
      {children}
    </ConversationDetailContext.Provider>
  );
};

export const useConversationDetailContext = () => {
  const context = useContext(ConversationDetailContext);

  if (context === undefined) {
    throw new Error(
      "useConversationDetailContext must be used within a ConversationDetailProvider"
    );
  }

  return context;
};
