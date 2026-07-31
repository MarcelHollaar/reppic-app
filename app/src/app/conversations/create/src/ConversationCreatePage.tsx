import AudioRecorderComponent from "@/app/conversations/create/src/components/AudioRecorder";
import ConversationForm from "@/app/conversations/create/src/components/ConversationForm";
import { usePageContext } from "@/app/conversations/create/src/providers/ConversationCreateProvider";
import { ConversationFormSchemaType } from "@/app/conversations/create/src/validation/conversationFormSchema";
import { useAudioRecorderContext } from "@/context/AudioRecorderContext";
import { useAssembleAndProcess } from "@/hooks/useAssembleAndProcess";
import { useDeleteAudioChunks } from "@/hooks/useDeleteAudioChunks";
import { useMergeAssembleAndProcess } from "@/hooks/useMergeAssembleAndProcess";
import { useMergeAudioChunks } from "@/hooks/useMergeAudioChunks";
import { useSaveDraft } from "@/hooks/useSaveDraft";
import { useUploadAudioChunk } from "@/hooks/useUploadAudioChunk";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { ConversationListingHeaderButton } from "../../src/components/conversationListingHeaderButton";
import { ConversationDetailResponse } from "../../[id]/src/providers/ConversationDetailProvider";

const ON_CHUNK_TRIGGER_TIME = 10000;

export const ConversationCreatePage = () => {
  const router = useRouter();
  const { t } = useTranslation();
  const { isRecording } = useAudioRecorderContext();

  const { loading: saveDraftLoading, fetch: saveDraft } = useSaveDraft();
  const { loading: mergeChunksLoading, fetch: mergeChunks } =
    useMergeAudioChunks();
  const {
    fetch: mergeAssembleAndProcess,
    loading: mergeAssembleAndProcessLoading,
  } = useMergeAssembleAndProcess();
  const { fetch: deleteChunks, loading: deleteChunksLoading } =
    useDeleteAudioChunks();
  const { fetch: assembleAndProcess, loading: assembleAndProcessLoading } =
    useAssembleAndProcess();
  const { fetch: uploadChunk, loading: uploadChunkLoading } =
    useUploadAudioChunk();
  const {
    conversationId,
    conversationIdRef,
    customers,
    conversation,
    refetchConversationDetails,
    isLoadingConversation,
  } = usePageContext();
  const {
    sourceFileUrl,
    hasChunks,
    hasRecording,
    is_merging_chunks: isMergingChunks,
  } = conversation || {};
  const pollAbortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      pollAbortControllerRef.current?.abort();
    };
  }, []);

  const pollConversationDetailsUntil = useCallback(
    async <K extends keyof ConversationDetailResponse>(
      key: K,
      value: ConversationDetailResponse[K]
    ): Promise<void> => {
      pollAbortControllerRef.current?.abort();
      pollAbortControllerRef.current = new AbortController();

      while (!pollAbortControllerRef.current.signal.aborted) {
        const result = await refetchConversationDetails();
        if (result?.[key] === value) {
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    },
    [refetchConversationDetails]
  );

  useEffect(() => {
    const handleLinkClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest("a");

      if (link && link.href) {
        const confirmed = window.confirm(
          "Weet je zeker dat je de pagina wilt verlaten?"
        );
        if (!confirmed) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    };
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      alert("beforeunload");
      if (isRecording) {
        const confirmed = window.confirm(
          "Weet je zeker dat je de pagina wilt verlaten?"
        );
        if (!confirmed) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    };

    document.removeEventListener("click", handleLinkClick, true);
    window.removeEventListener("beforeunload", handleBeforeUnload);

    if (!isRecording) {
      return;
    }

    document.addEventListener("click", handleLinkClick, true);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      document.removeEventListener("click", handleLinkClick, true);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isRecording]);

  const handleSaveDraft = async (formData: ConversationFormSchemaType) => {
    const { customer_name, title, notes } = formData;

    await saveDraft(conversationId!, { customer_name, title, notes });

    router.push(`/conversations`);
  };

  const handleSendConversation = async (
    formData: ConversationFormSchemaType
  ) => {
    const { customer_name, title, notes } = formData;
    const loadingToastId = toast.loading("Sending conversation...", {
      duration: Infinity,
      position: "top-right",
    });

    await saveDraft(conversationId!, { customer_name, title, notes });

    if (!hasRecording) {
      await mergeAssembleAndProcess(conversationId!);
      await refetchConversationDetails();

      toast.success("Conversation sent successfully", {
        id: loadingToastId,
        duration: 3000,
      });
      router.push(`/conversations/${conversationId}`);

      return;
    }

    await assembleAndProcess(conversationId!);

    toast.success("Conversation sent successfully", {
      id: loadingToastId,
      duration: 3000,
    });

    router.push(`/conversations/${conversationId}`);
  };

  const handleDeleteRecording = async () => {
    await deleteChunks(conversationId!);
    await refetchConversationDetails();
  };

  const handleOnAudioDataAvailable = async (
    chunk: Blob,
    mediaRecorder: MediaRecorder
  ) => {
    if (!conversationId) {
      return;
    }

    if (mediaRecorder.state === "inactive") {
      await uploadChunk(conversationId, chunk);
      await mergeChunks(conversationId!);
      await pollConversationDetailsUntil("hasRecording", true);
    }

    if (mediaRecorder.state === "recording") {
      await uploadChunk(conversationId, chunk);
    }
  };

  return (
    <>
      <ConversationListingHeaderButton />
      <div className="tw-mb-8 tw-text-center md:tw-text-left">
        <h1 className="tw-text-xl tw-font-bold tw-text-gray-900 tw-mb-1">
          {t("createConversation.addConversation")}
        </h1>
        <p className="tw-text-sm tw-text-gray-400">
          {t("createConversation.recordSalesConversationsForAnalysis")}
        </p>
      </div>

      <div className="tw-bg-white tw-rounded-2xl tw-font-inter md:tw-p-6 audio-recorder-card" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)" }}>
        <AudioRecorderComponent
          onStopRecording={() => {
            return Promise.resolve(undefined);
          }}
          sourceFileUrl={sourceFileUrl}
          onSendChunk={() => {
            return Promise.resolve(undefined);
          }}
          onPlayRecording={() => {
            return Promise.resolve(undefined);
          }}
          onDeleteRecording={handleDeleteRecording}
          onChunkTriggerTime={ON_CHUNK_TRIGGER_TIME}
          isAudioLoading={
            mergeChunksLoading ||
            mergeAssembleAndProcessLoading ||
            deleteChunksLoading ||
            isLoadingConversation ||
            isMergingChunks
          }
          onAudioDataAvailable={handleOnAudioDataAvailable}
          hasInitialRecording={hasChunks || hasRecording}
          isDraftSubmitting={saveDraftLoading}
          hideDeleteRecordingButton={deleteChunksLoading || isMergingChunks}
        />
        <ConversationForm
          onSaveDraft={handleSaveDraft}
          onSendConversation={handleSendConversation}
          isEditingConversationForm={!!conversationIdRef.current}
          customers={customers}
          isSubmittingDraft={saveDraftLoading}
          isSendingConversation={assembleAndProcessLoading}
          isSaveDraftSubmitionDisabled={
            deleteChunksLoading ||
            mergeChunksLoading ||
            mergeAssembleAndProcessLoading ||
            isRecording
          }
          isSendConversationSubmitionDisabled={
            deleteChunksLoading ||
            mergeChunksLoading ||
            mergeAssembleAndProcessLoading ||
            isRecording ||
            isMergingChunks
          }
          initialFormValues={{
            title: "",
            customer_name: "",
            notes: "",
            hasRecording: hasChunks || false,
          }}
        />
      </div>
    </>
  );
};
