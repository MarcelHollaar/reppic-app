"use client";
import { USER_ROLE } from "@/configs/constants";
import { getAuthHeaders } from "@/utils/getAuthHeaders";
import {
  ChevronLeftIcon,
  PlayIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";
import { ChevronRightIcon } from "@heroicons/react/24/solid";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

export default function DevelopmentPage() {
  const [videos, setVideos] = useState<any[]>([]);
  const [authors, setAuthors] = useState<{ [key: string]: any }>({});
  const scrollRef: any = useRef(null);
  const headers = getAuthHeaders() || { "Content-Type": "application/json" };
  const [loading, setLoading] = useState(true);
  const [recommendedVideos, setRecommendedVideos] = useState<any[]>([]);
  const router = useRouter();
  const { t } = useTranslation("common");
  const i18n = useTranslation().i18n;
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    const userData = localStorage.getItem("user_data");
    if (userData) {
      const user = JSON.parse(userData);
      if (user.role?.name === USER_ROLE.SUPER_ADMIN) {
        window.location.href = "/developments/library";
      }
    }
  }, []);

  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    fetchVideos();
  }, [i18n.language, page]);

  const fetchVideos = async () => {
    setLoading(true);
    try {
      const searchParams = new URLSearchParams();
      searchParams.append("type", "GET_VIDEOS");
      searchParams.append("lang_code", i18n.language || "en"); // Use current language
      searchParams.append("page", String(page));
      searchParams.append("per_page", String(pageSize));

      const response = await fetch(`/api/videos?${searchParams.toString()}`, {
        method: "GET",
        headers,
      });

      if (response.ok) {
        const result = await response.json();
        const fetchedVideos = result.data.records;
        setVideos(fetchedVideos);
        setTotalPages(result?.data?.pagination?.total_pages || 1);
      } else {
        console.error("Failed to fetch videos.");
      }
    } catch (error) {
      console.error("Error fetching videos:", error);
    } finally {
      setLoading(false);
    }
  };

  const scroll = (direction: any) => {
    if (scrollRef.current) {
      const scrollAmount = 300; // Adjust based on card width
      scrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  const handleNewConvBtnClick = () => {
    router.push("/conversations/new");
  };

  useEffect(() => {
    const fetchRecommendedVideos = async () => {
      setLoading(true);
      try {
        const headers = getAuthHeaders();

        const response = await fetch(
          `/api/suggested-videos?type=GET_SUGGESTED_VIDEOS&lang_code=${i18n.language}`,
          {
            method: "GET",
            headers,
          },
        );

        const result = await response.json();
        if (!response.ok) {
          console.error("Error fetching recommended videos:", result.message);
          setLoading(false);
          return;
        }
        const recommendedVideoData = result?.data?.records;

        setRecommendedVideos(recommendedVideoData);
      } catch (error) {
        console.error("Error fetching recommended videos:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchRecommendedVideos();
  }, [i18n.language]);

  useEffect(() => {
    // Check if scrolling is needed based on the number of recommended videos
    setCanScrollRight(recommendedVideos.length > 4);
  }, [recommendedVideos]);

  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 0);
      // Add a small threshold to handle floating point precision
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 2);
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.addEventListener("scroll", handleScroll);
    }
    return () => {
      if (scrollRef.current) {
        scrollRef.current.removeEventListener("scroll", handleScroll);
      }
    };
  }, []);

  // Function to get video thumbnail URL
  const getVideoThumbnail = (thumbnail_path: string) => {
    return thumbnail_path ?? "/img/reppic_transparant.svg";
  };

  return (
    <div className="tw-w-full tw-max-w-full tw-overflow-x-hidden">
      <h1 className="tw-text-3xl tw-font-medium tw-mb-10 tw-mt-3 tw-text-center md:tw-text-left">
        {t("developments.development")}
      </h1>

      <div className="recommended tw-w-full">
        <div className="tw-w-full">
          {/* Header with Navigation Buttons */}
          <div className="tw-flex tw-justify-between tw-items-center tw-mb-4">
            <h3 className="tw-text-xl tw-font-semibold">
              {t("developments.recommended")}
            </h3>
            <div className="tw-flex tw-gap-2">
              {canScrollLeft && (
                <button
                  onClick={() => scroll("left")}
                  className="tw-bg-transparent tw-border tw-border-gray-400 tw-w-8 tw-h-8 tw-rounded-full tw-flex tw-items-center tw-justify-center hover:tw-bg-gray-100"
                >
                  <ChevronLeftIcon className="tw-w-5 tw-h-5 tw-text-gray-700" />
                </button>
              )}
              {canScrollRight && (
                <button
                  onClick={() => scroll("right")}
                  className="tw-bg-transparent tw-border tw-border-gray-400 tw-w-8 tw-h-8 tw-rounded-full tw-flex tw-items-center tw-justify-center hover:tw-bg-gray-100"
                >
                  <ChevronRightIcon className="tw-w-5 tw-h-5 tw-text-gray-700" />
                </button>
              )}
            </div>
          </div>

          {/* Carousel Container */}
          <div className="tw-overflow-hidden tw-w-full">
            <div
              ref={scrollRef}
              className="tw-flex tw-gap-4 tw-overflow-x-auto tw-scroll-smooth tw-pb-2"
              style={{ scrollbarWidth: "none" }}
            >
              {recommendedVideos.length === 0 ? (
                <div className="tw-border tw-border-gray-500 tw-rounded-3xl tw-w-full tw-flex tw-flex-col tw-items-center tw-justify-center tw-py-10">
                  <p className="tw-text-lg tw-font-semibold tw-mb-2">
                    {t("conversationsCard.noConversationsFound")}
                  </p>
                  <p className="tw-text-sm tw-text-gray-500">
                    {t("conversationsCard.conversationRecommended")}
                  </p>
                  <button
                    className="tw-mt-4 tw-bg-button tw-text-white tw-rounded-full tw-px-4 tw-py-2 tw-flex tw-items-center tw-gap-2 hover:tw-bg-opacity-90 tw-text-xs"
                    onClick={handleNewConvBtnClick}
                  >
                    <PlusIcon className="tw-w-5 tw-h-5" />
                    {t("conversationsCard.newConversation")}
                  </button>
                </div>
              ) : (
                recommendedVideos.map((recommendedVideo: any, index: any) => (
                  <div
                    key={index}
                    className="tw-bg-white tw-rounded-3xl tw-p-3 tw-flex-shrink-0 tw-cursor-pointer tw-w-full xs:tw-min-w-[calc(50%-0.5rem)] md:tw-min-w-[calc(33.333%-0.66rem)] lg:tw-min-w-[calc(25%-0.75rem)]"
                    style={{
                      width: "calc(100% / 4 - 12px)",
                      minWidth: "250px",
                    }}
                    onClick={() =>
                      (window.location.href = `/developments/playback?id=${recommendedVideo?.video?.id}`)
                    }
                  >
                    {/* Video Thumbnail */}
                    <div
                      className="tw-relative tw-rounded-xl tw-overflow-hidden tw-cursor-pointer tw-border-gray-300 tw-mb-2 tw-w-full tw-aspect-video"
                      onClick={() =>
                        (window.location.href = `/developments/playback?id=${recommendedVideo?.video?.id}`)
                      }
                    >
                      <div className="tw-absolute tw-inset-0 tw-flex tw-items-center tw-justify-center tw-bg-black/20 tw-z-10">
                        <div className="tw-bg-black/50 tw-rounded-full tw-p-2">
                          <PlayIcon className="tw-w-8 tw-h-8 tw-text-white" />
                        </div>
                      </div>
                      <img
                        src={getVideoThumbnail(
                          recommendedVideo?.thumbnail_path,
                        )}
                        alt={
                          recommendedVideo?.video?.title ||
                          t("developments.videoThumbnail")
                        }
                        className="tw-w-full tw-h-full tw-object-cover"
                      />
                    </div>

                    <div className="tw-flex tw-flex-col tw-flex-wrap tw-gap-2 tw-justify-between tw-items-start">
                      {/* Type */}
                      <span className="tw-bg-blue-50 tw-text-button tw-text-xs tw-capitalize tw-rounded-3xl tw-py-1 tw-px-4 tw-inline-block tw-break-words tw-max-w-full">
                        {t(
                          `typeDropdown.${recommendedVideo.video?.type?.toLowerCase()}`,
                        ) || t("developments.noType")}
                      </span>

                      {/* Category */}
                      <span className="tw-bg-blue-900 tw-text-white tw-text-xs tw-uppercase tw-rounded-3xl tw-py-1 tw-px-4 tw-inline-block tw-break-words tw-max-w-full">
                        {recommendedVideo?.video?.category?.name ||
                          t("developments.unCategorized")}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="tw-mb-10 tw-mt-10 tw-w-full">
        <h3 className="tw-text-xl tw-font-semibold tw-mb-2">
          {t("developments.categories")}
        </h3>
        {loading ? (
          <div className="tw-mb-10 tw-mt-10 tw-flex tw-justify-center">
            <p>
              <div className="tw-w-8 tw-h-8 tw-border-2 tw-border-[#5971F6] tw-border-t-transparent tw-rounded-full tw-animate-spin" />
            </p>
          </div>
        ) : videos.length > 0 ? (
          <>
            <div className="tw-grid md:tw-grid-cols-3 lg:tw-grid-cols-4 tw-gap-4 tw-w-full">
              {videos.map((video) => {
                return (
                  <div
                    key={video.id}
                    className="tw-bg-white tw-rounded-3xl tw-p-3 tw-w-full tw-cursor-pointer"
                    onClick={() =>
                      (window.location.href = `/developments/playback?id=${video.id}`)
                    }
                  >
                    {/* Video Thumbnail */}
                    <div
                      className="tw-relative tw-rounded-xl tw-overflow-hidden tw-cursor-pointer tw-border-gray-300 tw-mb-2 tw-w-full tw-aspect-video"
                      onClick={() =>
                        (window.location.href = `/developments/playback?id=${video.id}`)
                      }
                    >
                      <div className="tw-absolute tw-inset-0 tw-flex tw-items-center tw-justify-center tw-bg-black/20 tw-z-10">
                        <div className="tw-bg-black/50 tw-rounded-full tw-p-2">
                          <PlayIcon className="tw-w-8 tw-h-8 tw-text-white" />
                        </div>
                      </div>
                      <img
                        src={getVideoThumbnail(video?.thumbnail_path)}
                        alt={video.title || t("developments.videoThumbnail")}
                        className="tw-w-full tw-h-full tw-object-cover"
                      />
                    </div>

                    {/* Title */}
                    <h3 className="tw-text-base tw-font-semibold tw-text-gray-900 tw-mt-2 tw-mb-4 tw-line-clamp-2">
                      {video.title}
                    </h3>

                    <div className="tw-flex tw-flex-col tw-flex-wrap tw-gap-2 tw-justify-between tw-items-start">
                      {/* Type */}
                      <span className="tw-bg-blue-50 tw-text-button tw-text-xs tw-capitalize tw-rounded-3xl tw-py-1 tw-px-4 tw-inline-block tw-break-words tw-max-w-full">
                        {t(`typeDropdown.${video?.type?.toLowerCase()}`) ||
                          t("developments.noType")}
                      </span>

                      {/* Category */}
                      <span className="tw-bg-blue-900 tw-text-white tw-text-xs tw-uppercase tw-rounded-3xl tw-py-1 tw-px-4 tw-inline-block tw-break-words tw-max-w-full">
                        {video.category?.name ||
                          t("developments.unCategorized")}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Pagination Controls */}
            <div className="tw-flex tw-items-center tw-justify-end tw-gap-6 tw-px-10 tw-py-6">
              <span className="tw-flex tw-items-center tw-gap-1 tw-text-sm tw-text-black">
                <span>{t("common.page")}</span>
                <span>
                  {page} {t("common.of")} {totalPages}
                </span>
              </span>
              <div className="tw-flex tw-items-center tw-gap-2">
                <button
                  onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                  disabled={page === 1 || loading}
                  className="tw-bg-[#F5F6F8] tw-text-gray-700 tw-rounded-xl tw-p-2 tw-text-sm tw-font-medium hover:tw-bg-gray-200 tw-transition-colors disabled:tw-opacity-30"
                >
                  <ChevronLeftIcon className="tw-w-4 tw-h-4" />
                </button>
                <button
                  onClick={() =>
                    setPage((prev) => (prev < totalPages ? prev + 1 : prev))
                  }
                  disabled={page === totalPages || loading}
                  className="tw-bg-[#F5F6F8] tw-text-gray-700 tw-rounded-xl tw-p-2 tw-text-sm tw-font-medium hover:tw-bg-gray-200 tw-transition-colors disabled:tw-opacity-30"
                >
                  <ChevronRightIcon className="tw-w-4 tw-h-4" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div
            className="tw-bg-white tw-rounded-2xl tw-font-inter tw-p-0 tw-w-full"
            style={{
              boxShadow:
                "0 2px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)",
            }}
          >
            <div className="tw-flex tw-flex-col tw-items-center tw-justify-center tw-gap-4 tw-p-10">
              <img
                src="/img/conversation_empty.svg"
                alt={t("developments.noVideosFound")}
                className="tw-w-[8.625rem] tw-h-auto"
              />
              <p className="tw-text-lg tw-font-normal tw-text-gray-700">
                {t("developments.noVideosFound")}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
