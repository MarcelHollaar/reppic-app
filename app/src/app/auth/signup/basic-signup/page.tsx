/* eslint-disable @next/next/no-img-element */
"use client";
import { useState, ChangeEvent, FormEvent, useEffect } from "react";
import Link from "next/link";
import { ToastContainer, toast } from 'react-toastify';
import { Spinner, Typography } from "@/components/MaterialTailwind";
import Carousel from "@/components/signComponents/caraousel";
import { useRouter } from "next/navigation";
import { types } from "@/app/api/utils/type-constants";
import { PASSWORD_SPECIAL_CHAR_REGEX } from "@/utils/passwordRules";

// Define the type for the form data
interface FormData {
  name: string;
  email: string;
  password: string;
  phone_number: string;
}

// Define the type for the error messages
interface FormErrors {
  name?: string;
  email?: string;
  password?: string;
  phone_number?: string;
}

export default function BasicSignupPage() {
  const router = useRouter();
  const [formData, setFormData] = useState<FormData>({
    name: "",
    email: "",
    password: "",
    phone_number: "",
  });
  const [loading, setLoading] = useState(false);



  const [errors, setErrors] = useState<FormErrors>({
    name: "",
    email: "",
    password: "",
    phone_number: "",
  });
  const [client, setClient] = useState(false);
  useEffect(() => {
    setClient(true)
  }, [])

  if (!client) {
    return null;
  }

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prevState) => ({
      ...prevState,
      [name]: value,
    }));
  };

  const validateForm = (): boolean => {
    let isValid = true;
    let validationErrors: FormErrors = {}; // Using FormErrors type

    // Name validation
    if (!formData.name) {
      validationErrors.name = "Name is required";
      isValid = false;
    } else if (formData.name.length > 100) {
      validationErrors.name = "Name cannot exceed 100 characters";
      isValid = false;
    }

    // Email validation
    if (!formData.email) {
      validationErrors.email = "Email is required";
      isValid = false;
    } else if (!/^\S+@\S+\.\S+$/.test(formData.email)) {
      validationErrors.email = "Invalid email format";
      isValid = false;
    }

    // Password validation
    if (!formData.password) {
      validationErrors.password = "Password is required";
      isValid = false;
    } else {
      if (formData.password.length < 8) {
        validationErrors.password = "Password must be at least 8 characters long";
        isValid = false;
      }
      if (!/[A-Z]/.test(formData.password)) {
        validationErrors.password = "Password must contain at least one uppercase letter";
        isValid = false;
      }
      if (!/[a-z]/.test(formData.password)) {
        validationErrors.password = "Password must contain at least one lowercase letter";
        isValid = false;
      }
      if (!/[0-9]/.test(formData.password)) {
        validationErrors.password = "Password must contain at least one number";
        isValid = false;
      }
      if (!PASSWORD_SPECIAL_CHAR_REGEX.test(formData.password)) {
        validationErrors.password =
          "Password must contain at least one special character.";
        isValid = false;
      }
    }

    // Phone number validation (if provided)
    if (formData.phone_number) {
      if (formData.phone_number.length < 10) {
        validationErrors.phone_number = "Phone number must be at least 10 digits long";
        isValid = false;
      } else if (formData.phone_number.length > 15) {
        validationErrors.phone_number = "Phone number cannot exceed 15 digits";
        isValid = false;
      } else if (!/^\+?[1-9]\d{9,14}$/.test(formData.phone_number)) {
        validationErrors.phone_number = "Invalid phone number format";
        isValid = false;
      }
    }

    setErrors(validationErrors);
    return isValid;
  };


  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    if (validateForm()) {
      setErrors({});

      try {
        const response = await fetch("/api/auth", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type: types.REGISTER,
            userData: {
              name: formData.name,
              email: formData.email,
              password: formData.password,
              phone_number: formData.phone_number,
            },
          }),
        });

        const result = await response.json();

        if (response.ok) {
          localStorage.setItem("user_data",JSON.stringify(result.data || ""));
          toast.success(result.message);
          router.push("/auth/email-landing");
        } else {
          toast.error(result.message);
        }
      } catch (error) {
        console.error("Error submitting form:", error);
      }
    }
    setLoading(false);
  };

  return (
    <>
      <ToastContainer />
      <section className="tw-flex tw-items-center tw-justify-center tw-min-h-screen tw-bg-indigo-50 tw-px-4 sm:tw-px-12 lg:tw-px-20 tw-p-4">
        <div className="tw-w-full tw-max-w-lg tw-bg-white tw-shadow-md tw-rounded-lg tw-p-6 sm:tw-p-10">
          {/* Logo */}
          <div className="tw-flex tw-justify-start tw-mb-6">
            <img src="/img/Logo.svg" alt="Logo" className="tw-w-24 sm:tw-w-32 tw-h-auto" />
          </div>

          {/* Title & Description */}
          <Typography variant="h3" className="!tw-font-bold tw-text-center tw-mb-2">
            Sign Up
          </Typography>
          <Typography className="tw-text-center tw-text-blue-gray-300 tw-mb-6 tw-tracking-wide">
            Start your 30-day free trial.
          </Typography>

          {/* Form */}
          <form className="tw-space-y-4" onSubmit={handleSubmit}>
            {/* Name Field */}
            <div>
              <Typography variant="small" className="!tw-font-medium tw-mb-2 tw-font-[system-ui] ">
                Name *
              </Typography>
              <input
                type="text"
                className="tw-w-full tw-px-4 tw-py-2 tw-rounded-3xl tw-bg-white tw-border tw-border-gray-400 focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-500 tw-placeholder-gray-600"
                placeholder="Enter your name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
              />
              {errors.name && <p className="tw-text-red-500 tw-text-xs">{errors.name}</p>}
            </div>

            {/* Email Field */}
            <div>
              <Typography variant="small" className="!tw-font-medium tw-mb-2 tw-font-[system-ui]">
                Organization Email *
              </Typography>
              <input
                type="email"
                className="tw-w-full tw-px-4 tw-py-2 tw-rounded-3xl tw-bg-white tw-border tw-border-gray-400 focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-500 tw-placeholder-gray-600"
                placeholder="Enter your email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
              />
              {errors.email && <p className="tw-text-red-500 tw-text-xs">{errors.email}</p>}
            </div>

            {/* Password Field */}
            <div>
              <Typography variant="small" className="!tw-font-medium tw-mb-2 tw-font-[system-ui]">
                Password *
              </Typography>
              <input
                type="password"
                className="tw-w-full tw-px-4 tw-py-2 tw-rounded-3xl tw-bg-white tw-border tw-border-gray-400 focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-500 tw-placeholder-gray-600"
                placeholder="Create a password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
              />
              {errors.password && <p className="tw-text-red-500 tw-text-xs">{errors.password}</p>}
              <Typography className="tw-text-sm tw-font-light !tw-text-blue-gray-500">
                Must be at least 8 characters
              </Typography>
            </div>

            {/* Phone Number Field */}
            <div>
              <Typography variant="small" className="!tw-font-medium tw-mb-2 tw-font-[system-ui]">
                Phone Number
              </Typography>
              <input
                type="text"
                className="tw-w-full tw-px-4 tw-py-2 tw-rounded-3xl tw-bg-white tw-border tw-border-gray-400 focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-500 tw-placeholder-gray-600"
                placeholder="Enter your phone number"
                name="phone_number"
                value={formData.phone_number}
                onChange={handleInputChange}
              />
              {errors.phone_number && <p className="tw-text-red-500 tw-text-xs">{errors.phone_number}</p>}
            </div>

            {/* Register Button */}
            <button
              className={`tw-font-inter tw-w-full tw-mt-4 tw-bg-button tw-text-white tw-rounded-3xl tw-h-12 tw-tracking-wide tw-font-normal tw-flex tw-items-center tw-justify-center
                ${loading ? "tw-opacity-50 tw-cursor-not-allowed" : ""}`}
              type="submit"
            >
              {loading ? <Spinner /> : "Create Account"}
            </button>
          </form>

          {/* Login Link */}
          <div className="tw-mt-4 tw-text-center">
            <p className="tw-text-sm tw-text-gray-500">
              Already have an account?
              <Link href="/auth/signin/basic" className="tw-text-indigo-600 hover:tw-text-indigo-800 tw-font-semibold">
                &nbsp; Log in
              </Link>
            </p>
          </div>
        </div>
      </section>
    </>
  );
}