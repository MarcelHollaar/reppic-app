"use client";
import React, { useEffect } from "react";
import authMiddleware from "@/middleware/authMiddleware";
import { USER_ROLE } from "@/configs/constants";
import { useRouter } from "next/navigation";

const DEFAULT_PROMPT_ID = "0594d4fb-5c14-4f95-9fa8-4c84a8dddd36";

function PromptCreatePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace(`/developments/prompts/${DEFAULT_PROMPT_ID}/edit`);
  }, [router]);

  return null;
}

export default authMiddleware(PromptCreatePage, USER_ROLE.SUPER_ADMIN);
