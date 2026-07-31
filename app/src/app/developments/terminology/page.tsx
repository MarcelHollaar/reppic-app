"use client";
import React from "react";
import authMiddleware from "@/middleware/authMiddleware";
import { USER_ROLE } from "@/configs/constants";
import TerminologyManager from "@/components/development/terminology/TerminologyManager";

function TerminologyPage() {
  return <TerminologyManager />;
}

export default authMiddleware(TerminologyPage, USER_ROLE.SUPER_ADMIN);
