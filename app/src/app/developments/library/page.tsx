"use client";
import React, { useEffect, useState, useRef, memo } from "react";
import {
  PencilIcon,
  PlusIcon,
  TrashIcon,
  EllipsisVerticalIcon,
} from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";
import CategoryDropdown from "@/components/CategoryDropdown";
import TagDropdown from "@/components/TagDropdown";
import { getAuthHeaders } from "@/utils/getAuthHeaders";
import DeleteConfirmDialog from "@/components/DeleteConfirmDialog";
import { toast, ToastContainer } from "react-toastify";
import authMiddleware from "@/middleware/authMiddleware";
import { USER_ROLE } from "@/configs/constants";
import TypeDropdown from "@/components/TypeDropdown";

import { PlayIcon } from "@heroicons/react/24/solid";
import { useBreadcrumb } from "@/context/BreadcrumbContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useTranslation } from "react-i18next";

import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/solid";

function LibraryPage() {
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>(""); // State for search query
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<any>(null);
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [videoToDelete, setVideoToDelete] = useState<any>(null);
  const router = useRouter();
  const scrollRef: any = useRef(null);
  const dropdownRef = useRef<HTMLDivElement>(null); // Ref for the dropdown
  const headers = getAuthHeaders() || { "Content-Type": "application/json" };
  const [categoryInputValue, setCategoryInputValue] = useState<string>(""); // State for inputValue from CategoryDropdown
  const [tagInputValue, setTagInputValue] = useState<string>(""); // State for inputValue from TagDropdown
  const [selectedType, setSelectedType] = useState<string>(""); // State for selected type
  const { setBreadcrumbs } = useBreadcrumb();
  const userRole = useUserRole();
  const { t } = useTranslation('common');
  const { i18n } = useTranslation();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [totalPages, setTotalPages] = useState(1);
  // set custom breadcrumbs for the page
  useEffect(() => {
    if (userRole) {
      setBreadcrumbs([
        {
          label: "Developments",
          href: "#",
        },
        {
          label: "Library",
          href: "#",
        },
      ]);
    }
  }, [userRole]);

  useEffect(() => {
    fetchVideos();
  }, [selectedCategory, selectedTag, searchQuery, selectedType, i18n.language, page]);

  // Click outside handler to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownVisible(false);
        setSelectedVideo(null);
      }
    };

    if (dropdownVisible) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownVisible]);

  const fetchVideos = async () => {
    setLoading(true);
    try {
      const searchParams = new URLSearchParams();
      searchParams.append("type", "GET_VIDEOS");
      if (selectedCategory)
        searchParams.append("category_id", selectedCategory);
      if (selectedTag) searchParams.append("tag_id", selectedTag);
      if (selectedType) searchParams.append("video_type", selectedType);
      if (searchQuery.trim()) searchParams.append("search", searchQuery.trim());
      searchParams.append("lang_code", i18n.language || "en"); // Use current language
      searchParams.append("page", String(page));
      searchParams.append("per_page", String(pageSize));

      const response = await fetch(`/api/videos?${searchParams.toString()}`, {
        method: "GET",
        headers,
      });

      if (response.ok) {
        const result = await response.json();
        const filteredVideos = result.data.records.filter((video: any) => {
          const matchesCategory = selectedCategory
            ? video.category_id === selectedCategory
            : true;
          const matchesTag = selectedTag
            ? video.tags.some((tag: any) => tag.tag_id === selectedTag)
            : true;

          return matchesCategory && matchesTag; // Ensure both conditions are met

        });
        setVideos(filteredVideos);
        setTotalPages(result.data.pagination?.total_pages || 1);
      } else {
        console.error("Failed to fetch videos.");
      }
    } catch (error) {
      console.error("Error fetching videos:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryChange = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setPage(1);
  };

  const handleTypeChange = (type: string) => {
    setSelectedType(type);
    setPage(1);
  };

  const handleTagChange = (tagIds: string[]) => {
    setSelectedTag(tagIds.length > 0 ? tagIds[0] : null); // Single-select for tags
    setPage(1);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setPage(1);
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

  const handleNewVideoBtnClick = () => {
    router.push("/developments/videos/add");
  };

  const handleEllipsisClick = (video: any) => {
    if (selectedVideo?.id === video.id) {
      setDropdownVisible((prev) => !prev);
    } else {
      setSelectedVideo(video);
      setDropdownVisible(true);
    }
  };

  const handleDropdownClose = () => {
    setDropdownVisible(false);
    setSelectedVideo(null);
  };

  const handleEdit = (e: any) => {
    if (selectedVideo) {
      router.push(`/developments/videos/edit?id=${selectedVideo.id}`);
    }
    handleDropdownClose();
  };

  const handleDelete = async () => {
    if (videoToDelete) {
      try {
        const response = await fetch(`/api/videos/${videoToDelete.id}`, {
          method: "DELETE",
          headers,
        });

        if (response.ok) {
          setVideos((prev) =>
            prev.filter((video) => video.id !== videoToDelete.id)
          );
          toast.success(t("successMessages.videoDeleted"));
        } else {
          console.error("Failed to delete video.");
          toast.error(t("errorMessages.failedToDeleteVideo"));
        }
      } catch (error) {
        console.error("Error deleting video:", error);
      } finally {
        setIsDialogOpen(false);
        setVideoToDelete(null);
      }
    }
  };

  const openDeleteDialog = (video: any) => {
    setVideoToDelete(video);
    setIsDialogOpen(true);
  };

  const closeDeleteDialog = () => {
    setIsDialogOpen(false);
    setVideoToDelete(null);
  };

  const memoizedVideos = React.useMemo(
    () =>
      videos.map((video) => ({
        ...video,
        memoizedEmbeddedCode: video.embedded_code,
      })),
    [videos]
  );

  const handleCategoryInputChange = (inputValue: string) => {
    setCategoryInputValue(inputValue); // Update inputValue from CategoryDropdown
  };

  const handleTagInputChange = (inputValue: string) => {
    setTagInputValue(inputValue); // Update inputValue from TagDropdown
  };

  const getVideoThumbnail = (thumbnail_path: string) => {
    return thumbnail_path ?? "/img/reppic_transparant.svg";
  };

  const handleResetFilter = (e: React.MouseEvent<HTMLSpanElement>) => {
    e.preventDefault();
    setSelectedType("");
    setSelectedCategory(null);
    setCategoryInputValue("");
    setSelectedTag(null);
    setTagInputValue("");
    setSearchQuery("");
    setPage(1);
  }
  return (
    <>
      <div className="tw-mb-4 tw-mt-3">
        <div className="tw-flex tw-flex-col md:tw-flex-row tw-items-center tw-justify-center md:tw-justify-between tw-mb-4 tw-gap-3 text-center">
          <h1 className="tw-text-xl tw-font-medium tw-text-gray-900">
            {t('developments.development')}
          </h1>
          <button
            onClick={handleNewVideoBtnClick}
            className="tw-flex tw-items-center tw-gap-2 btn-bg-blue tw-text-white tw-rounded-full tw-h-10 tw-px-5 tw-font-medium tw-text-[0.875rem] hover:tw-bg-blue-700"
          >
            <PlusIcon className="tw-w-5 tw-h-5" />
            {t('library.newVideo')}
          </button>
        </div>
      </div>
      <div className="tw-flex tw-flex-col lg:tw-flex-row lg:tw-items-center tw-justify-between tw-py-2 tw-mb-5 tw-gap-2">
        {/* Search Bar */}
        <div className="tw-w-full md:tw-w-[250px] tw-relative tw-flex tw-justify-center md:tw-justify-end">
          {/* Search Icon */}
          <img
            className="tw-absolute tw-left-3 tw-top-1/2 -tw-translate-y-1/2 tw-text-gray-500"
            src="/img/search_icon.svg"
            alt="search icon"
          />
          {/* Input Field */}
          <input
            type="text"
            className="tw-w-full md:tw-w-[250px] tw-pl-10 tw-pr-4 tw-py-2 tw-rounded-3xl tw-bg-white tw-border tw-border-gray-400 focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-500 tw-placeholder-gray-500"
            placeholder={t("library.searchForVideos")}
            value={searchQuery}
            onChange={handleSearchChange}
          />
        </div>

        {/* Dropdowns */}
        <div className="tw-flex tw-flex-row tw-flex-wrap tw-items-center sm:tw-flex-row sm:tw-items-center tw-gap-4">
          {/* Reset Filter Link - Large screens only */}
          <span
            className="tw-text-blue-600 tw-text-md tw-cursor-pointer hover:tw-underline tw-mb-2 sm:tw-mb-0 tw-hidden md:tw-inline"
            onClick={e => {
              handleResetFilter(e);
            }}
          >
            {t("library.resetFilter")}
          </span>
          {/* Type Dropdown */}
          <div
            style={{
              width: `${Math.max(
                (selectedType?.length || 0) * 10 + 40,
                134
              )}px`, // Adjust width dynamically with base offset
              height: "44px",
            }}
          >
            <TypeDropdown
              value={selectedType || ""}
              onChange={handleTypeChange}
            />
          </div>
          <div
            style={{
              width: `${Math.max(
                (categoryInputValue?.length || 0) * 10 + 40,
                i18n.language === 'nl' ? 144 : 134
              )}px`, // Adjust width dynamically with base offset
              height: "44px",
            }}
          >
            <CategoryDropdown
              value={selectedCategory || ""}
              onChange={handleCategoryChange}
              onInputChange={handleCategoryInputChange} // Pass callback to update inputValue
              forListing={true}
              isDropdown={true}
            />
          </div>

          {/* Tags Dropdown */}
          <div
            style={{
              width: `${Math.max(
                (tagInputValue?.length || 0) * 10 + 40,
                134
              )}px`, // Adjust width dynamically with base offset
              height: "44px",
            }}
          >
            <TagDropdown
              value={selectedTag ? [selectedTag] : []}
              onChange={handleTagChange}
              onInputChange={handleTagInputChange} // Pass callback to update inputValue
              forLibrary={true}
              isDropdown={true}
            />
          </div>
          {/* Reset Filter Link - Small screens only */}
          <span
            className="tw-text-blue-600 tw-text-md tw-cursor-pointer hover:tw-underline tw-mb-2 sm:tw-mb-0 md:tw-hidden"
            onClick={e => {
              handleResetFilter(e);
            }}
          >
            {t("library.resetFilter")}
          </span>
        </div>
      </div>

      {/* Videos Section */}
      <div className="tw-mb-10 tw-mt-5 tw-w-full tw-max-w-full tw-overflow-x-hidden">
        {loading ? (
          <div className="tw-flex tw-justify-center tw-items-center tw-h-screen">
            <div className="tw-animate-spin tw-rounded-full tw-h-10 tw-w-10 tw-border-t-2 tw-border-b-2 tw-border-blue-500"></div>
          </div>
        ) : memoizedVideos.length > 0 ? (
          <>
            <div className="tw-grid md:tw-grid-cols-3 lg:tw-grid-cols-4 tw-gap-4 tw-w-full">
              {memoizedVideos.map((video) => {
                return (
                  <div
                    key={video.id}
                    className="tw-relative tw-bg-white tw-rounded-3xl tw-p-3 tw-w-full tw-cursor-pointer"
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
                      {/* Ellipsis Button - Inside Thumbnail */}
                      <div
                        className="tw-absolute tw-top-2 tw-right-2 tw-rounded-full tw-p-1.5 tw-bg-gray-500 tw-shadow tw-cursor-pointer tw-z-20"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleEllipsisClick(video);
                        }}
                      >
                        <EllipsisVerticalIcon className="tw-w-4 tw-h-4 tw-text-white" />
                      </div>

                      {/* Play Icon Overlay */}
                      <div className="tw-absolute tw-inset-0 tw-flex tw-items-center tw-justify-center tw-bg-black/20 tw-z-10">
                        <div className="tw-bg-black/50 tw-rounded-full tw-p-2">
                          <PlayIcon className="tw-w-8 tw-h-8 tw-text-white" />
                        </div>
                      </div>

                      <img
                        src={getVideoThumbnail(video?.thumbnail_path)}
                        alt={video.title || "Video thumbnail"}
                        className="tw-w-full tw-h-full tw-object-cover"
                      />
                    </div>

                    {/* Dropdown */}
                    {dropdownVisible && selectedVideo?.id === video.id && (
                      <div
                        ref={dropdownRef}
                        className="tw-absolute tw-right-5 tw-top-16 tw-bg-white tw-rounded-lg tw-shadow-lg tw-z-30 tw-w-32"
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            handleEdit(e);
                            handleDropdownClose();
                          }}
                          className="tw-w-full tw-flex tw-items-center tw-gap-2 tw-text-left tw-px-4 tw-py-2 tw-text-sm tw-text-gray-700 hover:tw-bg-gray-100"
                        >
                          <PencilIcon className="tw-w-4 tw-h-4 tw-text-blue-500" />
                          {t('form.edit')}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            openDeleteDialog(video);
                            handleDropdownClose();
                          }}
                          className={`tw-w-full tw-flex tw-items-center tw-gap-2 tw-text-left ${i18n.language === 'nl' ? "tw-px-2" : "tw-px-4"} tw-py-2 tw-text-sm tw-text-gray-700 hover:tw-bg-gray-100`}
                        >
                          <TrashIcon className="tw-w-4 tw-h-4 tw-text-red-500" />
                          {t('form.delete')}
                        </button>
                      </div>
                    )}

                    {/* Title */}
                    <h3 className="tw-text-base tw-font-semibold tw-text-gray-900 tw-my-2 tw-mb-4 tw-line-clamp-2">
                      {video.title}
                    </h3>

                    {/* Category */}
                    <div className="tw-flex tw-flex-col tw-flex-wrap tw-gap-2 tw-justify-between tw-items-start">
                      {/* Type */}
                      <a
                        href="#"
                        className="tw-bg-blue-50 tw-text-button tw-text-xs tw-capitalize tw-rounded-3xl tw-py-1 tw-px-4 tw-inline-block tw-break-words tw-max-w-full"
                      >
                        {t(`typeDropdown.${video?.type?.toLowerCase()}`) || t("developments.noType")}
                      </a>

                      {/* Category */}
                      <a
                        href="#"
                        className="tw-bg-blue-900 tw-text-white tw-text-xs tw-uppercase tw-rounded-3xl tw-py-1 tw-px-4 tw-inline-block tw-break-words tw-max-w-full"
                      >
                        {video?.category?.name || t("developments.unCategorized")}
                      </a>
                    </div>

                  </div>
                );
              })}
            </div>
            {/* Pagination Controls */}
            <div className="tw-flex tw-items-center tw-justify-end tw-gap-6 tw-px-10 tw-py-6">
              <span className="tw-flex tw-items-center tw-gap-1 tw-text-sm tw-text-black">
                <span>{t('common.page')}</span>
                <span>{page} {t('common.of')} {totalPages}</span>
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
          <div className="tw-bg-white tw-rounded-2xl tw-font-inter tw-p-0 tw-w-full" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)" }}>
            <div className="tw-flex tw-flex-col tw-items-center tw-justify-center tw-gap-4 tw-p-10">
              <img
                src="/img/conversation_empty.svg"
                alt="No Conversations"
                className="tw-w-[8.625rem] tw-h-auto"
              />
              <p className="tw-text-lg tw-font-normal tw-text-gray-700">
                {t('developments.noVideosFound')}
              </p>
            </div>
          </div>
        )}
      </div>

      <DeleteConfirmDialog
        isOpen={isDialogOpen}
        onClose={closeDeleteDialog}
        onConfirm={handleDelete}
        entityName={t("addVideo.video")}
      />
      <ToastContainer />
    </>
  );
}

export default authMiddleware(LibraryPage, USER_ROLE.SUPER_ADMIN);
