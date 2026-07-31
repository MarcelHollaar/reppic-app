export const getAuthHeaders = (customHeaders: Record<string, string> = {}, isFormData: boolean = false): Record<string, string> | null => {
  if (typeof window === "undefined") {
    return null;
  }  
  const token = localStorage.getItem("token");
  
    if (!token) {
      return null;
    }

  return {
    ...(isFormData ? {} : { "Content-Type": "application/json" }), // Exclude Content-Type for FormData
    Authorization: `Bearer ${token}`,
    ...customHeaders,
  };
};
