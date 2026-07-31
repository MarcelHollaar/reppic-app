"use client"
import React, { useRef, useState } from "react";
import { ArrowLeftIcon, ArrowRightIcon, ArrowsPointingOutIcon, EllipsisVerticalIcon, PlayIcon } from "@heroicons/react/24/solid";
import { ChevronLeftIcon, ChevronRightIcon, HeartIcon, PlusIcon } from "@heroicons/react/24/outline";
export default function PropositionDevelopmentPage() {
  const courses = [
    {
      id: 1,
      thumbnail: "/img/pic.png", // Replace with actual image URL
      tag: "PROPOSITION",
      title: "Beginner’s Guide To Becoming A Professional Frontend Developer",
      author: {
        name: "Ali Mughal",
        role: "UX Designer",
        avatar: "/img/ali.png", // Replace with actual avatar URL
      },
      progress: 50, // Progress percentage
    },
    {
      id: 1,
      thumbnail: "/img/pic.png", // Replace with actual image URL
      tag: "PROPOSITION",
      title: "Beginner’s Guide To Becoming A Professional Frontend Developer",
      author: {
        name: "Ali Mughal",
        role: "UX Designer",
        avatar: "/img/ali.png", // Replace with actual avatar URL
      },
      progress: 50, // Progress percentage
    },
    {
      id: 1,
      thumbnail: "/img/pic.png", // Replace with actual image URL
      tag: "PROPOSITION",
      title: "Beginner’s Guide To Becoming A Professional Frontend Developer",
      author: {
        name: "Ali Mughal",
        role: "UX Designer",
        avatar: "/img/ali.png", // Replace with actual avatar URL
      },
      progress: 50, // Progress percentage
    },
    {
      id: 1,
      thumbnail: "/img/pic.png", // Replace with actual image URL
      tag: "PROPOSITION",
      title: "Beginner’s Guide To Becoming A Professional Frontend Developer",
      author: {
        name: "Ali Mughal",
        role: "UX Designer",
        avatar: "/img/ali.png", // Replace with actual avatar URL
      },
      progress: 50, // Progress percentage
    },
    {
      id: 1,
      thumbnail: "/img/pic.png", // Replace with actual image URL
      tag: "PROPOSITION",
      title: "Beginner’s Guide To Becoming A Professional Frontend Developer",
      author: {
        name: "Ali Mughal",
        role: "UX Designer",
        avatar: "/img/ali.png", // Replace with actual avatar URL
      },
      progress: 50, // Progress percentage
    },
    {
      id: 1,
      thumbnail: "/img/pic.png", // Replace with actual image URL
      tag: "PROPOSITION",
      title: "Beginner’s Guide To Becoming A Professional Frontend Developer",
      author: {
        name: "Ali Mughal",
        role: "UX Designer",
        avatar: "/img/ali.png", // Replace with actual avatar URL
      },
      progress: 50, // Progress percentage
    },
    {
      id: 1,
      thumbnail: "/img/pic.png", // Replace with actual image URL
      tag: "PROPOSITION",
      title: "Beginner’s Guide To Becoming A Professional Frontend Developer",
      author: {
        name: "Ali Mughal",
        role: "UX Designer",
        avatar: "/img/ali.png", // Replace with actual avatar URL
      },
      progress: 50, // Progress percentage
    },
    {
      id: 1,
      thumbnail: "/img/pic.png", // Replace with actual image URL
      tag: "PROPOSITION",
      title: "Beginner’s Guide To Becoming A Professional Frontend Developer",
      author: {
        name: "Ali Mughal",
        role: "UX Designer",
        avatar: "/img/ali.png", // Replace with actual avatar URL
      },
      progress: 50, // Progress percentage
    },
    {
      id: 1,
      thumbnail: "/img/pic.png", // Replace with actual image URL
      tag: "PROPOSITION",
      title: "Beginner’s Guide To Becoming A Professional Frontend Developer",
      author: {
        name: "Ali Mughal",
        role: "UX Designer",
        avatar: "/img/ali.png", // Replace with actual avatar URL
      },
      progress: 50, // Progress percentage
    },
    {
      id: 1,
      thumbnail: "/img/pic.png", // Replace with actual image URL
      tag: "PROPOSITION",
      title: "Beginner’s Guide To Becoming A Professional Frontend Developer",
      author: {
        name: "Ali Mughal",
        role: "UX Designer",
        avatar: "/img/ali.png", // Replace with actual avatar URL
      },
      progress: 50, // Progress percentage
    },
  ];

  const videos = [];
  const videoRef: any = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  const togglePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleProgress = () => {
    if (videoRef.current) {
      const percent = (videoRef.current.currentTime / videoRef.current.duration) * 100;
      setProgress(percent);
    }
  };

  const handleFullscreen = () => {
    if (videoRef.current.requestFullscreen) {
      videoRef.current.requestFullscreen();
    }
  };
  return (
    <>
      <div className="tw-mt-10">
        <div className="tw-flex tw-flex-row tw-justify-between ">
          <h2 className="tw-ml-4 tw-text-xl tw-font-semibold tw-mb-5 ">Proposition</h2>
        </div>
      </div>
      <div className="cateogories">
        <div className="tw-relative tw-w-[1150px] tw-h-[420px] tw-overflow-hidden tw-shadow-lg tw-rounded-3xl">
          {/* Video Element */}
          <video
            ref={videoRef}
            src="/videos/video.mkv"
            className="tw-w-full tw-h-full tw-bg-black tw-rounded-3xl"
            onTimeUpdate={handleProgress}
            onClick={togglePlayPause}
          />

          {/* Play/Pause Button */}
          {!isPlaying && (
            <button
              className="tw-absolute tw-inset-0 tw-flex tw-items-center tw-justify-center tw-bg-black/40 tw-opacity-0 hover:tw-opacity-100 tw-transition-opacity"
              onClick={togglePlayPause}
            >
              <PlayIcon className="tw-w-12 tw-h-12 tw-text-white" />
            </button>
          )}

          {/* Fullscreen Button */}
          <button
            className="tw-absolute tw-bottom-3 tw-right-3 tw-bg-black/50 tw-rounded-full tw-p-2 hover:tw-bg-black/70 tw-transition"
            onClick={handleFullscreen}
          >
            <ArrowsPointingOutIcon className="tw-w-5 tw-h-5 tw-text-white" />
          </button>

          {/* Progress Bar */}
          <div className="tw-absolute tw-bottom-0 tw-left-0 tw-w-full tw-h-1">
            <div className="tw-bg-white tw-h-full tw-rounded-full" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="channel tw-mb-5">
          <div className="channel-details tw-flex tw-flex-row tw-justify-between tw-mt-11">
            <h3 className="tw-ml-4 tw-text-xl tw-font-semibold tw-mb-2 ">Proposition Tutorial: Device Frames and Scrolling </h3>
          </div>
          <div className="tw-flex tw-items-center tw-gap-2 tw-m-2 tw-ml-5">
            <img
              src={"/img/ali.png"}
              alt={"ali"}
              width={32}
              height={32}
              className="tw-w-10 tw-h-10 tw-rounded-full"
            />
            <div className="tw-flex tw-justify-between tw-w-full">
              <p className="tw-text-sm tw-font-semibold tw-text-gray-900">
                The Sales Studios
              </p>
              <div className="tw-flex tw-gap-2">
                <button
                  className="tw-bg-gray-200 tw-border tw-border-gray-400 tw-w-8 tw-h-8 tw-rounded-full tw-flex tw-items-center tw-justify-center hover:tw-bg-gray-300"
                >
                  <ChevronLeftIcon className="tw-w-5 tw-h-5 tw-text-gray-700" />
                </button>
                <button
                  className="tw-bg-gray-200 tw-border tw-border-gray-400 tw-w-8 tw-h-8 tw-rounded-full tw-flex tw-items-center tw-justify-center hover:tw-bg-gray-300"
                >
                  <ChevronRightIcon className="tw-w-5 tw-h-5 tw-text-gray-700" />
                </button>
              </div>
            </div>

          </div>
        </div>
        <div className="up-next">
          <div className="channel-details tw-flex tw-flex-row tw-justify-between tw-mt-11">
            <h3 className="tw-ml-4 tw-text-xl tw-font-semibold tw-mb-2 ">Up Next </h3>
          </div>
          <div className="tw-grid tw-grid-cols-2 md:tw-grid-cols-4 tw-gap-4 tw-p-4">
            {courses.map((course, index) => (
              <div key={index} className="tw-rounded-2xl tw-shadow-md tw-border tw-border-gray-200 tw-overflow-hidden tw-w-64">
                {/* Thumbnail */}
                <div className="tw-relative">
                  <img
                    src={course.thumbnail}
                    alt={course.title}
                    className="tw-w-full tw-h-auto"
                  />
                  {/* Video Duration */}
                  <div className="tw-absolute tw-bottom-2 tw-right-2 tw-bg-black tw-text-white tw-text-[10px] tw-font-medium tw-px-1.5 tw-py-0.5 tw-rounded-md">
                    7:11
                  </div>
                  {/* Progress Bar */}
                  <div className="tw-absolute tw-bottom-0 tw-left-0 tw-w-full tw-h-1 tw-bg-gray-200">
                    <div
                      className="tw-h-full tw-p-1 tw-bg-red-500 tw-rounded-full"
                      style={{ width: `${course.progress}%` }}
                    ></div>
                  </div>
                </div>

                {/* Course Info */}
                <div className="tw-px-3 tw-py-2">
                  <div className="tw-flex tw-items-center tw-justify-between">
                    <div className="tw-flex tw-items-center tw-gap-2">
                      <img
                        src={course.author.avatar}
                        alt={course.author.name}
                        className="tw-w-6 tw-h-6 tw-rounded-full"
                      />
                      <h3 className="tw-text-xs tw-font-medium tw-text-gray-900 tw-truncate tw-text-wrap">
                        {course.title}
                      </h3>
                    </div>
                    <EllipsisVerticalIcon className="tw-w-7 tw-h-7" />
                  </div>
                  <p className="tw-text-[10px] tw-text-gray-500 tw-mt-1 tw-ml-8">
                    {course.author.name}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
