"use client";
import React from "react";
import { ArrowLeftIcon } from "@heroicons/react/24/solid";
import { useRouter } from "next/navigation";
import { useUserRole } from "@/hooks/useUserRole";
import { USER_ROLE } from "@/configs/constants";
import { useTranslation } from "react-i18next";

interface VideoPlayerContainerProps {
  title?: string;
  category?: string;
  children: React.ReactNode;
  showBackButton?: boolean;
  showNavigation?: boolean;
  onPrevious?: () => void;
  onNext?: () => void;
  canGoPrevious?: boolean;
  canGoNext?: boolean;
}

export default function VideoPlayerContainer({
  title,
  category,
  children,
  showBackButton = true,
  showNavigation = false,
  onPrevious,
  onNext,
  canGoPrevious = false,
  canGoNext = false,
}: VideoPlayerContainerProps) {
  const router = useRouter();
  const userRole = useUserRole();
  const { t } = useTranslation("common");

  return (
    <>
      {showBackButton && (
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
      )}
      
      <div className="tw-mt-4">
        <div className="tw-flex tw-flex-row tw-justify-between ">
          <h2 className="tw-ml-0 tw-text-3xl tw-font-medium tw-mb-5 ">
            {category || t('developments.development')}
          </h2>
        </div>
      </div>
      
      <div className="cateogories">
        <div className="tw-relative tw-w-full tw-h-[auto] tw-max-w-[1150px] tw-aspect-video tw-overflow-hidden tw-shadow-lg tw-rounded-3xl">
          {children}
        </div>

        {title && (
          <div className="channel tw-mb-3">
            <div className="channel-details tw-flex tw-flex-row tw-justify-between tw-mt-6">
              <h3 className="tw-ml-0 tw-text-xl tw-font-bold tw-mb-1 ">
                {title}
              </h3>
            </div>
            
            {showNavigation && (
              <div className="tw-flex tw-items-center tw-gap-2 tw-m-2 tw-ml-0">
                <div className="tw-flex tw-justify-between tw-w-full tw-items-center">
                  <div className="tw-flex tw-gap-2">
                    {canGoPrevious && (
                      <button
                        className="tw-border tw-border-gray-400 tw-w-8 tw-h-8 tw-rounded-full tw-flex tw-items-center tw-justify-center hover:tw-bg-gray-300"
                        onClick={onPrevious}
                      >
                        <svg className="tw-w-5 tw-h-5 tw-text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                    )}
                    {canGoNext && (
                      <button
                        className="tw-border tw-border-gray-400 tw-w-8 tw-h-8 tw-rounded-full tw-flex tw-items-center tw-justify-center hover:tw-bg-gray-300"
                        onClick={onNext}
                      >
                        <svg className="tw-w-5 tw-h-5 tw-text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
