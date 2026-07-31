"use client";
import React from "react";
import authMiddleware from "@/middleware/authMiddleware";
import { USER_ROLE } from "@/configs/constants";
import CategoriesOrTagsListing from "@/components/development/categories/CategoriesOrTagsListing";

function TagsListingPage() {
  return (
    <>
      <CategoriesOrTagsListing entityType="tags" />
    </>
  );
}

export default authMiddleware(TagsListingPage, USER_ROLE.SUPER_ADMIN)