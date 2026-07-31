"use client";
import React from "react";
import authMiddleware from "@/middleware/authMiddleware";
import { USER_ROLE } from "@/configs/constants";
import CategoryOrTagsAddEdit from "@/components/development/categories/CategoryOrTagsAddEdit";

function CategoriesCreatePage() {
  return (
    <>
      <CategoryOrTagsAddEdit entityType="categories" />
    </>
  );
}

export default authMiddleware(CategoriesCreatePage, USER_ROLE.SUPER_ADMIN)