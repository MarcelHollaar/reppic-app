"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DashboardsIndex() {
  const router = useRouter();
  useEffect(() => { router.replace("/dashboards/strategic"); }, [router]);
  return null;
}
