"use client";
import React from "react";
import authMiddleware from "@/middleware/authMiddleware";

function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <div className="tw-min-h-full">{children}</div>;
}

export default authMiddleware(DashboardLayout, "manager");
