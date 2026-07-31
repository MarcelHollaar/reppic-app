import { useState, useEffect } from "react";

export const useUserRole = (): string | null => {
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const userData = JSON.parse(localStorage.getItem("user_data") || "{}");
      const role = userData?.role?.name || "";
      setUserRole(role);
    }
  }, []);

  return userRole;
};

export const loggedInUser = (): Object | null => {
  if (typeof window !== "undefined") {
    const userData = JSON.parse(localStorage.getItem("user_data") || "{}");
    return userData;
  }
  return null;
}