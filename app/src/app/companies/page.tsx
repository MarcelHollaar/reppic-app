"use client";
import React from "react";
import authMiddleware from "@/middleware/authMiddleware";

import CompaniesListing from "@/components/company/CompaniesListing";
import { USER_ROLE } from "@/configs/constants";
function CompaniesListingPage() {
  return (
    <>
      <CompaniesListing />
    </>
  );
}

export default authMiddleware(CompaniesListingPage, USER_ROLE.SUPER_ADMIN)