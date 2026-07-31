"use client";
import React from "react";
import authMiddleware from "@/middleware/authMiddleware";
import { useUserRole } from "@/hooks/useUserRole";

import ConversationListing from "./conversations-listing";
import { USER_ROLE } from "@/configs/constants";
import SuperAdminConversationListing from "@/components/conversation/SuperAdminConversationListing";

function DataTablesPage() {
  const userRole = useUserRole();
  const [roleLoaded, setRoleLoaded] = React.useState(false);
  React.useEffect(() => {
    if (userRole !== undefined && userRole !== null) {
      setRoleLoaded(true);
    }
  }, [userRole]);
  return (
    <>
      {roleLoaded && userRole === USER_ROLE.SUPER_ADMIN && (
        <SuperAdminConversationListing />
      )}
      {roleLoaded && userRole !== USER_ROLE.SUPER_ADMIN && (
        <ConversationListing />
      )}
    </>
  );  
}

export default authMiddleware(DataTablesPage);