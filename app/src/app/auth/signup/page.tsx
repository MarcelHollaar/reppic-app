/* eslint-disable @next/next/no-img-element */
"use client";
import { useState, ChangeEvent, FormEvent, useEffect } from "react";
import Link from "next/link";
import { EnvelopeIcon } from "@heroicons/react/24/outline";
import { Typography } from "@/components/MaterialTailwind";
import Carousel from "@/components/signComponents/caraousel";

// Define the type for the form data
export default function BasicSignupSelectionPage() {
  const [client, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, [])

  if (!client) return null;

  return (
    <section className="tw-flex tw-items-center tw-justify-center tw-min-h-screen tw-bg-indigo-50 tw-px-4 sm:tw-px-12 lg:tw-px-20">
      <div className="tw-w-full tw-max-w-lg tw-bg-white tw-shadow-md tw-rounded-lg tw-p-6 sm:tw-p-10">
        {/* Logo (Centered) */}
         <div 
            className="tw-rounded-3xl tw-p-2 tw-h-[8rem] tw-bg-cover tw-bg-left tw-bg-no-repeat"
            style={{ backgroundImage: "url('/img/reppic_transparant.svg')" }}
          >
          </div>

        {/* Heading */}
        <Typography variant="h2" className="tw-font-inter tw-mt-4 tw-text-center">
          Sign up
        </Typography>
        <Typography className="tw-font-inter tw-font-light tw-text-blue-gray-400 tw-text-center tw-mb-6">
          Get started - it's free. No credit card needed.
        </Typography>

        {/* Signup Options */}
        <div className="tw-space-y-4">
          <button className="tw-w-full tw-bg-white tw-h-12 tw-flex tw-items-center tw-gap-2 tw-justify-center tw-font-medium tw-rounded-3xl tw-border tw-border-gray-400">
            <svg width="30" height="26" viewBox="0 0 17 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <g clipPath="url(#clip0_1156_824)">
                <path d="M16.3442 8.18429C16.3442 7.64047 16.3001 7.09371 16.206 6.55872H8.66016V9.63937H12.9813C12.802 10.6329 12.2258 11.5119 11.3822 12.0704V14.0693H13.9602C15.4741 12.6759 16.3442 10.6182 16.3442 8.18429Z" fill="#4285F4" />
              </g>
            </svg>
            Sign up with Google
          </button>
          <button className="tw-w-full tw-bg-white tw-h-12 tw-flex tw-items-center tw-gap-2 tw-justify-center tw-font-medium tw-rounded-3xl tw-border tw-border-gray-400">
            <img src="/img/microsoft.png" alt="Microsoft logo" className="tw-w-6" />
            Sign up with Microsoft
          </button>
        </div>

        {/* Separator */}
        <div className="tw-flex tw-items-center tw-my-6">
          <div className="tw-flex-grow tw-border-t tw-border-gray-400"></div>
          <span className="tw-px-3">or</span>
          <div className="tw-flex-grow tw-border-t tw-border-gray-400"></div>
        </div>

        {/* Email Signup */}
        <button className="tw-border tw-border-gray-400 tw-font-inter tw-flex tw-items-center tw-justify-center tw-w-full tw-font-medium tw-bg-white tw-rounded-3xl tw-h-12 tw-space-x-2">
          <EnvelopeIcon className="tw-text-black tw-w-6" />
          <a href="/auth/signup/basic-signup">Sign up with Work Email</a>
        </button>

        {/* Continue Button */}
        <button className="tw-w-full tw-mt-4 tw-bg-button tw-text-white tw-rounded-3xl tw-h-12 tw-font-normal tw-text-lg">
          <a href="/auth/signup/basic-signup">Continue</a>
        </button>

        {/* Already have an account */}
        <div className="tw-mt-4 tw-flex tw-justify-center">
          <p className="tw-text-sm !tw-text-blue-gray-500">
            Already have an account?
            <Link href="/auth/signin/basic" className="tw-font-medium tw-text-blue-800 hover:tw-text-blue-800">
              &nbsp; Log in
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}