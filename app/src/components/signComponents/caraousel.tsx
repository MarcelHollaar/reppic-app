/* eslint-disable @next/next/no-img-element */
"use client";
import { useState } from "react";
import { Typography } from "@/components/MaterialTailwind";

export default function Carousel() {
  const [activeSlide, setActiveSlide] = useState(0);

  const slides = [
    {
      type: "custom",
      content: (
        <div className="tw-relative">
          <img src="/img/dashboard.svg" alt="Slide" className="tw-w-full tw-max-w-md tw-h-auto tw-mb-48" />
          <img
            src="/img/active-user.svg"
            alt="Active Icon"
            className="tw-absolute tw-bottom-4 tw-right-4 tw-left-72 tw-top-28 tw-w-44 tw-h-44 tw-rounded-xl tw-bg-white"
          />
          <div className="tw-text-white tw-absolute tw-top-80 tw-left-24">
            <Typography className="tw-font-medium tw-text-lg tw-tracking-wider !tw-text-white tw-mb-2">
              Welcome to your new dashboard
            </Typography>
            <Typography className="tw-text-sm tw-font-normal tw-tracking-wider !tw-text-blue-100">
              Sign in to explore changes we{`'`}ve made
            </Typography>
          </div>
        </div>
      ),
    },
    
  ];

  return (
    <div className="tw-hidden xl:tw-flex tw-relative tw-min-h-screen tw-bg-indigo-500 tw-items-center tw-justify-center">
      <img src="/img/upper-dots.svg" alt="Upper Dot" className="tw-absolute tw-top-0 tw-left-[23rem] tw-w-60" />

      {/* Carousel Container */}
      <div className="tw-relative tw-w-full tw-max-w-md tw-text-center">
        {slides[activeSlide].content}
      </div>

      {/* Carousel Dots and Arrows */}
      <div className="tw-absolute tw-bottom-44 tw-flex tw-items-center tw-space-x-6">
        {/* Left Arrow */}
        <button
          className="tw-text-white tw-p-2 tw-rounded-full"
          onClick={() => setActiveSlide((prev) => (prev === 0 ? slides.length - 1 : prev - 1))}
        >
          <img src="/img/left-arrow.svg" alt="Left Arrow" className="tw-w-8 tw-h-8" />
        </button>

        {/* Dots */}
        <div className="tw-flex tw-space-x-6">
          {slides.map((_, index) => (
            <button
              key={index}
              className={`tw-w-3 tw-h-3 tw-rounded-full ${activeSlide === index ? "tw-bg-white" : "tw-bg-blue-400"}`}
              onClick={() => setActiveSlide(index)}
            />
          ))}
        </div>

        {/* Right Arrow */}
        <button
          className="tw-text-white tw-p-2 tw-rounded-full"
          onClick={() => setActiveSlide((prev) => (prev === slides.length - 1 ? 0 : prev + 1))}
        >
          <img src="/img/right-arrow.svg" alt="Right Arrow" className="tw-w-8 tw-h-8" />
        </button>
      </div>

      <img src="/img/lower-dots.svg" alt="Lower Dot" className="tw-absolute tw-bottom-0 tw-right-96 tw-w-60" />
    </div>
  );
}