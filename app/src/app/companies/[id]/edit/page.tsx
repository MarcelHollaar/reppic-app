"use client"
import EditCompany from "@/components/companies/EditCompany"
import React from "react";
import authMiddleware from "@/middleware/authMiddleware";
import { USER_ROLE } from "@/configs/constants";
import { useParams, useRouter } from "next/navigation";

function CompanyCreateEditPage() {
    const router = useRouter();
    const params = useParams();
    const companyId = params?.id;
  return (
    <>
      <EditCompany companyId={companyId} />
    </>
  );
}

export default authMiddleware(CompanyCreateEditPage, USER_ROLE.SUPER_ADMIN, true);
