import { CONVERSATION_STATUS } from "@/configs/constants";
import { useUserRole } from "@/hooks/useUserRole";
import { useAssembleAndProcess } from "../../../../hooks/useAssembleAndProcess";
import { useDeleteAudioChunks } from "../../../../hooks/useDeleteAudioChunks";
import { useMergeAudioChunks } from "../../../../hooks/useMergeAudioChunks";
import { useUpdateConversation } from "../../../../hooks/useUpdateConversation";
import { useUploadAudioChunk } from "../../../../hooks/useUploadAudioChunk";
import AudioRecorderComponent from "../../create/src/components/AudioRecorder";
import ConversationForm from "../../create/src/components/ConversationForm";
import { ConversationFormSchemaType } from "../../create/src/validation/conversationFormSchema";
import { ConversationListingHeaderButton } from "../../src/components/conversationListingHeaderButton";
import { ConversationProfileCard } from "./components/ConversationProfileCard";
import { ConversationSummary } from "./components/ConversationSummary";
import {
  ConversationDetailResponse,
  useConversationDetailContext,
} from "./providers/ConversationDetailProvider";
import { summaryFormatter } from "./utils/summaryFormatter";
import { toast } from "react-hot-toast";
import { useEffect, useCallback, useRef } from "react";
import { useAudioRecorderContext } from "@/context/AudioRecorderContext";
import { useMergeAssembleAndProcess } from "@/hooks/useMergeAssembleAndProcess";

const ON_CHUNK_TRIGGER_TIME = 10000;

export const ConversationDetailPage = () => {
  const role = useUserRole();
  const { isRecording } = useAudioRecorderContext();
  const { fetch: mergeChunks, loading: mergeChunksLoading } =
    useMergeAudioChunks();
  const {
    fetch: mergeAssembleAndProcess,
    loading: mergeAssembleAndProcessLoading,
  } = useMergeAssembleAndProcess();
  const { fetch: deleteChunks, loading: deleteChunksLoading } =
    useDeleteAudioChunks();
  const { fetch: assembleAndProcess, loading: assembleAndProcessLoading } =
    useAssembleAndProcess();
  const { fetch: updateConversation, loading: updateConversationLoading } =
    useUpdateConversation();
  const { fetch: uploadChunk, loading: uploadChunkLoading } =
    useUploadAudioChunk();
  const {
    conversation,
    conversationIdRef,
    customers,
    refetchConversationDetails,
    isLoadingCustomers,
    isLoadingConversation,
  } = useConversationDetailContext();
  const {
    id,
    customer,
    hasChunks,
    created_at,
    conversation_summaries,
    conversation_status,
    hasRecording,
    sourceFileUrl,
    transcript_status,
    twinai_run_status,
    file_duration,
    is_merging_chunks: isMergingChunks,
  } = conversation || {};
  const { name } = customer || {};
  const {
    total_score: score,
    salesperson_percentage: salesperson_speak_percentage,
    atmosphere,
  } = conversation_summaries?.[0] || {};
  const hasConversationSummaries =
    conversation_summaries && conversation_summaries.length > 0;
  const pollAbortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (isMergingChunks) {
      pollConversationDetailsUntil("is_merging_chunks", false);
    }
  }, [isMergingChunks]);

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
    if (
      (transcript_status === "completed" &&
        conversation_status ===
          CONVERSATION_STATUS.COMPLETED_TWIN_AI_PROCESS) ||
      twinai_run_status === null
    )
      return;

    const interval = setInterval(async () => {
      await refetchConversationDetails();
    }, 10000);

    return () => clearInterval(interval);
  }, [transcript_status, conversation_status]);

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
    await updateConversation(id!, { customer_name, title, notes });
  };

  const handleSendConversation = async (
    formData: ConversationFormSchemaType
  ) => {
    const { customer_name, title, notes } = formData;
    const loadingToastId = toast.loading("Sending conversation...", {
      duration: Infinity,
      position: "top-right",
    });

    await updateConversation(id!, { customer_name, title, notes });

    if (!hasRecording) {
      await mergeAssembleAndProcess(id!);
      await refetchConversationDetails();

      toast.success("Conversation sent successfully", {
        id: loadingToastId,
        duration: 3000,
      });

      return;
    }

    await assembleAndProcess(id!);
    await refetchConversationDetails();

    toast.success("Conversation sent successfully", {
      id: loadingToastId,
      duration: 3000,
    });
  };

  const handlePlayRecording = async () => {
    if (sourceFileUrl) return;

    await mergeChunks(id!);
    await refetchConversationDetails();
  };

  const handleDeleteRecording = async () => {
    await deleteChunks(id!);
    await refetchConversationDetails();
  };

  const handleOnAudioDataAvailable = async (
    chunk: Blob,
    mediaRecorder: MediaRecorder
  ) => {
    if (!id) {
      console.error("No conversationId available, cannot upload chunk");
      return;
    }

    if (mediaRecorder.state === "inactive") {
      await uploadChunk(id, chunk);
      await mergeChunks(id!);
      await refetchConversationDetails();
    }

    if (mediaRecorder.state === "recording") {
      await uploadChunk(id, chunk);
    }
  };

  return (
    <>
      <ConversationListingHeaderButton />
      {(isLoadingConversation || isLoadingCustomers) && !conversation && (
        <div className="tw-flex tw-justify-center tw-items-center tw-h-screen">
          <div className="tw-animate-spin tw-rounded-full tw-border-t-2 tw-border-b-2 tw-border-blue-500 tw-w-10 tw-h-10"></div>
        </div>
      )}

      {(transcript_status === "processing" ||
        transcript_status === "completed") &&
        conversation_status !==
          CONVERSATION_STATUS.COMPLETED_TWIN_AI_PROCESS && (
          <div className="tw-bg-white tw-rounded-2xl tw-font-inter md:tw-p-6 audio-recorder-card" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)" }}>
            <div className="tw-flex tw-justify-center tw-items-center tw-h-[500px]">
              <div className="tw-flex tw-flex-col tw-items-center tw-gap-2">
                <div className="tw-animate-spin tw-rounded-full tw-border-t-2 tw-border-b-2 tw-border-blue-500 tw-w-10 tw-h-10"></div>
                <div className="tw-text-center tw-text-black-500 tw-mt-4 ">
                  Processing conversation...
                </div>
              </div>
            </div>
          </div>
        )}

      {twinai_run_status === null && (
        <>
          {(conversation_status === CONVERSATION_STATUS.DRAFT ||
            conversation_status === null) && (
            <div className="tw-bg-white tw-rounded-2xl tw-font-inter md:tw-p-6 audio-recorder-card" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)" }}>
              <AudioRecorderComponent
                onChunkTriggerTime={ON_CHUNK_TRIGGER_TIME}
                hasInitialRecording={hasChunks || hasRecording}
                hasInitialDuration={file_duration}
                sourceFileUrl={sourceFileUrl || null}
                onStopRecording={() => {
                  return Promise.resolve(undefined);
                }}
                onSendChunk={() => {
                  return Promise.resolve(undefined);
                }}
                onPlayRecording={handlePlayRecording}
                onDeleteRecording={handleDeleteRecording}
                isAudioLoading={
                  deleteChunksLoading ||
                  mergeChunksLoading ||
                  mergeAssembleAndProcessLoading ||
                  isLoadingConversation ||
                  isMergingChunks
                }
                onAudioDataAvailable={handleOnAudioDataAvailable}
                isDraftSubmitting={updateConversationLoading}
                hideDeleteRecordingButton={
                  deleteChunksLoading || isMergingChunks
                }
              />
              <ConversationForm
                onSaveDraft={handleSaveDraft}
                onSendConversation={handleSendConversation}
                isEditingConversationForm={!!conversationIdRef.current}
                customers={customers}
                initialFormValues={{
                  title: conversation?.title || "",
                  customer_name: conversation?.customer?.name || "",
                  notes: conversation?.notes || undefined,
                  hasRecording: hasChunks || false,
                }}
                isSubmittingDraft={updateConversationLoading}
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
              />
            </div>
          )}
        </>
      )}

      {conversation_status === CONVERSATION_STATUS.COMPLETED_TWIN_AI_PROCESS &&
        hasConversationSummaries && (
          <div className="tw-flex tw-flex-col md:tw-flex-row tw-gap-6">
            <>
              <ConversationProfileCard
                conversationId={id || ""}
                name={name || ""}
                role={role || ""}
                score={score || "N/A"}
                salespersonSpeaks={salesperson_speak_percentage ?? "N/A"}
                atmosphere={atmosphere || ""}
                createdAt={created_at || ""}
              />
              <div className="tw-w-full md:tw-w-2/3">
                <ConversationSummary
                  summary={
                    summaryFormatter(
                      conversation_summaries[0]?.summary_text || ""
                    ) || ""
                  }
                  learningPoints={conversation_summaries[0]?.learning_points}
                />
              </div>
            </>
          </div>
        )}
    </>
  );
};
