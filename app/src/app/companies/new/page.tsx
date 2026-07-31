"use client"
import AddEditCompany from "@/components/companies/AddEditCompany"
import React, { useEffect } from "react";
import authMiddleware from "@/middleware/authMiddleware";
import { USER_ROLE } from "@/configs/constants";
import { useBreadcrumb } from "@/context/BreadcrumbContext";

function CompanyCreateEditPage() {
  const { setBreadcrumbs } = useBreadcrumb();
  useEffect(() => {
    setBreadcrumbs([
      { label: "Companies", href: "/companies"},
      { label: "Create new company", href: "#"}
    ])
  }, [])
  return (
    <>
      <AddEditCompany />
    </>
  );
}

export default authMiddleware(CompanyCreateEditPage, USER_ROLE.SUPER_ADMIN)