"use client"
import React from "react";
import { ArrowLeftIcon, ArrowRightIcon, EllipsisVerticalIcon } from "@heroicons/react/24/solid";
import { HeartIcon, PlusIcon } from "@heroicons/react/24/outline";
export default function PropositionPage() {
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
      id: 2,
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
      id: 3,
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
      id: 4,
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
      id: 5,
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
      id: 6,
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
      id: 7,
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
      id: 8,
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
      id: 9,
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
      id: 10,
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
  return (
    <>
      <div className="">
        <div className="tw-flex tw-flex-row tw-justify-between ">
          <h3 className="tw-ml-4 tw-text-xl tw-font-semibold tw-mb-5 ">Proposition</h3>
        </div>
      </div>
      <div className="cateogories">
        <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 md:tw-grid-cols-3 lg:tw-grid-cols-4 tw-gap-6 tw-ml-4">
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
    </>


  );
}
