"use client";
import React from "react";
import VideoForm from "@/components/development/VideoForm";
import authMiddleware from "@/middleware/authMiddleware";
import { USER_ROLE } from "@/configs/constants";
const EditVideoPage: React.FC<{}> = () => {
  
return (
  <VideoForm />
);
};

export default authMiddleware(EditVideoPage, USER_ROLE.SUPER_ADMIN)
