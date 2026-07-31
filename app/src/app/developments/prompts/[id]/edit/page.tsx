"use client";
import React from "react";
import authMiddleware from "@/middleware/authMiddleware";
import { USER_ROLE } from "@/configs/constants";
import PromptAddEdit from "@/components/development/prompts/PromptAddEdit";
import { useParams } from "next/navigation";

function PromptEditPage() {
  const params = useParams();
  const id = (params?.id as string) || '';
  return <PromptAddEdit />;
}

export default authMiddleware(PromptEditPage, USER_ROLE.SUPER_ADMIN);

