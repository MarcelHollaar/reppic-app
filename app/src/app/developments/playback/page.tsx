"use client";
import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon } from "@heroicons/react/24/solid";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  EllipsisVerticalIcon,
  PlayIcon,
} from "@heroicons/react/24/outline";
import { getAuthHeaders } from "@/utils/getAuthHeaders";
import { extractSafeEmbedUrl } from "@/utils/safeHtml";
import { useUserRole } from "@/hooks/useUserRole";
import { USER_ROLE } from "@/configs/constants";
import { useBreadcrumb } from "@/context/BreadcrumbContext";
import { useTranslation } from "react-i18next";

const PlaybackPage: React.FC<{}> = () => {
  const router = useRouter();
  const { setBreadcrumbs } = useBreadcrumb();
  const [videoId, setVideoId] = useState<string | null>(null);
  const [videoData, setVideoData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const headers = getAuthHeaders() || { "Content-Type": "application/json" };
  const [suggestedVideos, setSuggestedVideos] = useState<any[]>([]);
  const userRole = useUserRole();
  const { t } = useTranslation("common");
  const { i18n } = useTranslation();
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setVideoId(params.get("id")); // Get the id from the URL
  }, []);

  useEffect(() => {
    if (videoId) {
      fetchVideoById(videoId);
      fetchSuggestedVideos(videoId);
    }
  }, [videoId, i18n.language]);

  // set custom breadcrumbs for the page
  useEffect(() => {
    if (userRole) {
      let breadCrumbs = [
        {
          label: "Developments",
          href:
            userRole === USER_ROLE.SUPER_ADMIN
              ? "/developments/library"
              : "/developments",
        }
      ]
      if (userRole === USER_ROLE.SUPER_ADMIN) {
        breadCrumbs.push({
          label: "Library",
          href: "/developments/library"
        })
      }
      breadCrumbs.push({
        label: videoData?.title || "",
        href: "#"
      })
      setBreadcrumbs(breadCrumbs);
    }
  }, [userRole, videoData]);

  // Geen ruwe HTML-injectie meer: we halen alleen een vertrouwde iframe-URL
  // (Synthesia/HeyGen/…) uit de embed-code en renderen zelf een schone iframe.
  // Sluit de stored-XSS-route via embedded_code af (zelfde aanpak als de
  // LMS-modulespeler).
  const memoizedEmbeddedVideo = useMemo(() => {
    const url = extractSafeEmbedUrl(videoData?.embedded_code);
    if (!url) return null;
    return (
      <div className="tw-w-full tw-h-full tw-aspect-video">
        <iframe
          src={url}
          className="tw-w-full tw-h-full"
          allow="encrypted-media; fullscreen; picture-in-picture"
          allowFullScreen
          title={videoData?.title || "video"}
        />
      </div>
    );
  }, [videoData?.embedded_code, videoData?.title, videoId]);

  const fetchVideoById = async (id: string) => {
    try {
      const response = await fetch(`/api/videos?id=${id}&type=GET_VIDEO&lang_code=${i18n.language}`, {
        method: "GET",
        headers,
      });

      if (response.ok) {
        const result = await response.json();
        setVideoData(result.data);
      } else {
        console.error("Failed to fetch video details.");
      }
    } catch (error) {
      console.error("Error fetching video details:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSuggestedVideos = async (currentVideoId: string) => {
    try {
      const response = await fetch(
        `/api/suggested-videos?type=GET_SUGGESTED_VIDEOS&lang_code=${i18n.language}`,
        {
          method: "GET",
          headers,
        }
      );

      if (response.ok) {
        const result = await response.json();
        const filteredVideos = result.data.records.filter(
          (video: any) => video.video.id !== currentVideoId
        );
        setSuggestedVideos(filteredVideos.slice(0, 4)); // Limit to 4 videos
      } else {
        console.error("Failed to fetch suggested videos.");
      }
    } catch (error) {
      console.error("Error fetching suggested videos:", error);
    }
  };

  const handleNextVideo = async () => {
    const currentIndex = suggestedVideos.findIndex(
      (video) => video.video.id === videoData.id
    );

    if (currentIndex === -1) {
      // If the current video is the initial video, move to the first suggested video
      setVideoData(suggestedVideos[0]?.video);
    } else {
      const nextVideo = suggestedVideos[currentIndex + 1]?.video;
      if (nextVideo) {
        setVideoData(nextVideo); // Update video
      }
    }
  };

  const handlePreviousVideo = async () => {
    const currentIndex = suggestedVideos.findIndex(
      (video) => video.video.id === videoData.id
    );

    if (currentIndex === 0) {
      // If the current video is the first suggested video, go back to the initial video
      fetchVideoById(videoId!);
    } else if (currentIndex > 0) {
      const previousVideo = suggestedVideos[currentIndex - 1]?.video;
      if (previousVideo) {
        setVideoData(previousVideo); // Update video
      }
    }
  };

  // Function to get video thumbnail URL
  const getVideoThumbnail = (thumbnailPath: string) => {
    return thumbnailPath ?? "/img/reppic_transparant.svg";
  };

  if (loading) {
    return (
      <div className="tw-flex tw-justify-center tw-items-center tw-h-screen">
        <div className="tw-animate-spin tw-rounded-full tw-h-10 tw-w-10 tw-border-t-2 tw-border-b-2 tw-border-blue-500"></div>
      </div>
    );
  }

  if (!videoData) {
    return <div>{t('playback.videoNotFound')}</div>;
  }

  return (
    <>
      <button
        className="tw-flex tw-mt-2 tw-items-center tw-gap-2 tw-ml-0 !tw-bg-blue-100 tw-text-blue-900 tw-rounded-full tw-h-10 tw-px-5 tw-font-medium tw-text-[0.875rem] hover:tw-bg-blue-200"
        onClick={() =>
          userRole === USER_ROLE.SUPER_ADMIN
            ? router.push("/developments/library")
            : router.push("/developments")
        }
      >
        <ArrowLeftIcon className="tw-w-4 tw-h-4 tw-text-button" />
        {t('developments.development')}
      </button>
      <div className="tw-mt-4">
        <div className="tw-flex tw-flex-row tw-justify-between ">
          <h2 className="tw-ml-0 tw-text-3xl tw-font-medium tw-mb-5 ">
            {videoData?.category?.name}
          </h2>
        </div>
      </div>
      <div className="cateogories">
        <div className="tw-relative tw-w-full tw-h-[auto] tw-max-w-[1150px] tw-aspect-video tw-overflow-hidden tw-shadow-lg tw-rounded-3xl">
          {memoizedEmbeddedVideo}
        </div>

        <div className="channel tw-mb-3">
          <div className="channel-details tw-flex tw-flex-row tw-justify-between tw-mt-6">
            <h3 className="tw-ml-0 tw-text-xl tw-font-bold tw-mb-1 ">
              {videoData.title}{" "}
            </h3>
          </div>
          <div className="tw-flex tw-items-center tw-gap-2 tw-m-2 tw-ml-0">
            <div className="tw-flex tw-justify-between tw-w-full tw-items-center">
              <div className="tw-flex tw-gap-2">
                {(videoData.id !== videoId ||
                  suggestedVideos.findIndex(
                    (video) => video.video.id === videoData.id
                  ) > 0) && (
                  <button
                    className="tw-border tw-border-gray-400 tw-w-8 tw-h-8 tw-rounded-full tw-flex tw-items-center tw-justify-center hover:tw-bg-gray-300"
                    onClick={handlePreviousVideo}
                  >
                    <ChevronLeftIcon className="tw-w-5 tw-h-5 tw-text-gray-700" />
                  </button>
                )}
                {suggestedVideos.findIndex(
                  (video) => video.video.id === videoData.id
                ) <
                  suggestedVideos.length - 1 && (
                  <button
                    className="tw-border tw-border-gray-400 tw-w-8 tw-h-8 tw-rounded-full tw-flex tw-items-center tw-justify-center hover:tw-bg-gray-300"
                    onClick={handleNextVideo}
                  >
                    <ChevronRightIcon className="tw-w-5 tw-h-5 tw-text-gray-700" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="up-next">
          {suggestedVideos.length > 0 && (
            <>
              <div className="channel-details tw-flex tw-flex-row tw-justify-between tw-mt-10">
                <h3 className="tw-ml-0 tw-text-xl tw-font-semibold tw-mb-2 ">
                  {t('playback.upNext')}{" "}
                </h3>
              </div>
              <div className="tw-grid md:tw-grid-cols-3 lg:tw-grid-cols-4 tw-gap-6 tw-ml-0">
                {suggestedVideos.map((suggestedVideo, index) => (
                  <div
                    key={index}
                    className="tw-rounded-2xl tw-shadow-md tw-border tw-border-gray-200 tw-overflow-hidden tw-cursor-pointer"
                     onClick={() =>
                    (window.location.href = `/developments/playback?id=${suggestedVideo?.video?.id}`)
                  }
                  >
                    <div className="tw-relative">
                      <a
                        href={`/developments/playback?id=${suggestedVideo?.video?.id}`}
                      >
                        <div className="tw-relative tw-aspect-video tw-overflow-hidden tw-cursor-pointer">
                          {/* Play button overlay */}
                          <div className="tw-absolute tw-inset-0 tw-flex tw-items-center tw-justify-center tw-bg-black/20 tw-z-10">
                            <div className="tw-bg-black/50 tw-rounded-full tw-p-2">
                              <PlayIcon className="tw-w-6 tw-h-6 tw-text-white" />
                            </div>
                          </div>

                          {/* Thumbnail image */}
                          <img
                            src={getVideoThumbnail(
                              suggestedVideo?.thumbnail_path
                            )}
                            alt={
                              suggestedVideo?.video?.title || "Video thumbnail"
                            }
                            className="tw-w-full tw-h-full tw-object-cover"
                          />
                        </div>
                      </a>
                    </div>

                    <div className="tw-px-3 tw-py-2">
                      <div className="tw-flex tw-items-center tw-justify-between">
                        <div className="tw-flex tw-items-center tw-gap-2">
                          <h3 className="tw-text-xs tw-font-medium tw-text-gray-900 tw-truncate tw-text-wrap">
                            {suggestedVideo?.video?.title}
                          </h3>
                        </div>
                        {/* <EllipsisVerticalIcon className="tw-w-7 tw-h-7" /> */}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default PlaybackPage;
