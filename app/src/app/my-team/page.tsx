"use client"
import React from "react";
import TeamMembersListing from "@/components/myTeam/TeamMembersListing";
import authMiddleware from "@/middleware/authMiddleware";
import { USER_ROLE } from "@/configs/constants";

function DashBoardPage() {
  return (
    <>
      <TeamMembersListing />
    </>
  );
}

export default authMiddleware(DashBoardPage, USER_ROLE.MANAGER)