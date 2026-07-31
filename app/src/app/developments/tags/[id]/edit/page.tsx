"use client";
import React from "react";
import authMiddleware from "@/middleware/authMiddleware";
import { USER_ROLE } from "@/configs/constants";
import CategoryOrTagsAddEdit from "@/components/development/categories/CategoryOrTagsAddEdit";
import { useParams } from "next/navigation";

function CategoriesEditPage() {
    const params = useParams();
    const tagId = params?.id;
  return (
    <>
      <CategoryOrTagsAddEdit entityId={tagId} entityType="tags" />
    </>
  );
}

export default authMiddleware(CategoriesEditPage, USER_ROLE.SUPER_ADMIN)