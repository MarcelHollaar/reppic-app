"use client";
import React from "react";
import authMiddleware from "@/middleware/authMiddleware";
import { USER_ROLE } from "@/configs/constants";
import CategoriesOrTagsListing from "@/components/development/categories/CategoriesOrTagsListing";

function CategoriesListingPage() {
  return (
    <>
      <CategoriesOrTagsListing entityType="categories" />
    </>
  );
}

export default authMiddleware(CategoriesListingPage, USER_ROLE.SUPER_ADMIN)