import { CONVERSATION_STATUS } from "@/configs/constants";
import { getAuthHeaders } from "./getAuthHeaders";

export const getFullUrl = (relativePath: string): string => {
    const baseUrl = process.env.NEXT_PUBLIC_FTP_PUBLIC_URL;
    return `${baseUrl}/${relativePath}`.replace(/([^:]\/)\/+/g, "$1");
};

export function capitalizeMonthInFormattedDate(formatted: string, formatStr: string) {
  if (formatStr.startsWith("MMM")) {
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  } else if (formatStr.includes("MMM")) {
    return formatted.replace(
      /(\d+ )([a-zA-Z\u00C0-\u017F]+)/,
      (match, day, month) => `${day}${month.charAt(0).toUpperCase()}${month.slice(1)}`
    );
  }
  return formatted;
}

export function base64ToBlob(dataUrl: string) {
  const arr = dataUrl.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'video/mp4';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

export const getUserId = () => {
  try {
    const user = JSON.parse(localStorage.getItem("user_data") || "{}");
    return user.id || "unknown";
  } catch {
    return "unknown";
  }
};

export async function retryFileFTPUpload(formData: any) {
  try {
    const headers = getAuthHeaders({}, true);
    const formDataToSend = new FormData();
    if (formData?.blob) {
      const fileType = formData?.blob?.type || "video/mp4";
      const fileExt = fileType.split("/")[1] || "mp4";
      const file = new File([formData?.blob], `recording-${formData?.timestamp || Date.now()}.${fileExt}`, {
        type: fileType,
      });
      formDataToSend.append("file", file);
    }
    
    if (formData.duration) {
      formDataToSend.append("file_duration", formData.duration.toString());
    }

    if (formData.deviceId) {
      formDataToSend.append("deviceId", formData.deviceId);
    }

    if (formData.conversationId) {
      formDataToSend.append("conversationId", formData.conversationId);
    }


    const response = await fetch(`/api/conversations/${formData.conversationId}?type=RETRY_FILE_UPLOAD`, {
      method: "PUT",
      body: formDataToSend,
      headers: {
        ...headers,
      },
    }); 

    if (response.ok) {
      if (formData?.uniqueId) {
        let id = formData.uniqueId;
        const blobs = JSON.parse(localStorage.getItem("audio_blobs") || "[]");
        const idx = blobs.findIndex((b: any) => b.uniqueId === id);
        if (idx !== -1) {
          blobs[idx].uploadStatus = 'success';
          const filtered = blobs.filter((b: any) => b?.uniqueId !== id);
          localStorage.setItem("audio_blobs", JSON.stringify(filtered));
        }
      }
    }
    // Optionally update uploadStatus to 'retrying' or 'pending'
  } catch (err) {
    // Optionally handle error
  }
}

export async function retryTwinAiUpload(formData: any) {
  try {
    const headers = getAuthHeaders({}, true);
    const formDataToSend = new FormData();
    if (formData.title) formDataToSend.append("title", formData.title);
    if (formData.customer_name) formDataToSend.append("customer_name", formData.customer_name);
    if (formData.meeting_date) formDataToSend.append(
      "meeting_date",
      formData.meeting_date
    );

    if (formData.meeting_time_start) formDataToSend.append("meeting_time_start", formData.meeting_time_start);
    if (formData.meeting_time_end) formDataToSend.append("meeting_time_end", formData.meeting_time_end);

    if (formData?.blob) {
      const fileType = formData?.blob?.type || "video/mp4";
      const fileExt = fileType.split("/")[1] || "mp4";
      const file = new File([formData?.blob], `recording-${formData?.timestamp || Date.now()}.${fileExt}`, {
        type: fileType,
      });
      formDataToSend.append("file", file);
    }
    formDataToSend.append("notes", formData.notes);

    
    
    if (formData.duration) {
      formDataToSend.append("file_duration", formData.duration.toString());
    }

    if (formData.deviceId) {
      formDataToSend.append("deviceId", formData.deviceId);
    }
    if (formData.conversationId) {
      formDataToSend.append("conversationId", formData.conversationId);
    }

 
    const response = await fetch(`/api/conversations/${formData.conversationId}`, {
      method: "POST",
      body: formDataToSend,
      headers: {
        ...headers,
      },
    }); 

    if (response.ok) {
      if (formData?.uniqueId) {
        let id = formData.uniqueId;
        const blobs = JSON.parse(localStorage.getItem("audio_blobs") || "[]");
        const idx = blobs.findIndex((b: any) => b.uniqueId === id);
        if (idx !== -1) {
          blobs[idx].uploadStatus = 'twinAiSuccess';
          const filtered = blobs.filter((b: any) => b?.uniqueId !== id);
          localStorage.setItem("audio_blobs", JSON.stringify(filtered));
        }
      }
    }
    // Optionally update uploadStatus to 'retrying' or 'pending'
  } catch (err) {
    // Optionally handle error
  }
}

export const retryFailedBlobs = async (headers: any) => {
  const RETRY_INTERVAL = 30 * 60 * 1000; // 30 minutes
  const MAX_RETRIES = 3;
  const ONE_HOUR = 60 * 60 * 1000;
  const blobs = JSON.parse(localStorage.getItem("audio_blobs") || "[]");
  const now = Date.now();
  let updated = false;
  let userId = getUserId();
  const updatedBlobs = blobs.map((blobObj: any) => {
    if (
      blobObj.userId === userId &&
      (blobObj.uploadStatus === "twinAiFailed" ||
        blobObj.uploadStatus === "failed"
      ) &&
      (blobObj.retryCount === undefined || blobObj.retryCount < MAX_RETRIES)
    ) {
      const lastRetryAt = blobObj.lastRetryAt || 0;
      // Only retry if last retry was more than 30min ago and within 1 hour of first failure
      if (
        now - lastRetryAt > RETRY_INTERVAL &&
        (!blobObj.firstFailedAt || now - blobObj.firstFailedAt < ONE_HOUR)
      ) {
        // Mark first failure time if not set
        if (!blobObj.firstFailedAt) blobObj.firstFailedAt = now;
        // Try re-upload
        if (blobObj.uploadStatus === "twinAiFailed") {
          retryTwinAiUpload(blobObj);
        } else if (blobObj.uploadStatus === "failed") {
          retryFileFTPUpload(blobObj);
        }

        updated = true;
        return {
          ...blobObj,
          retryCount: (blobObj.retryCount || 0) + 1,
          lastRetryAt: now,
          firstFailedAt: blobObj.firstFailedAt,
        };
      }
    }
    return blobObj;
  });

  if (updated) {
    localStorage.setItem("audio_blobs", JSON.stringify(updatedBlobs));
    // setLocalBlobs(updatedBlobs);
  }
};

export const deleteBlobFromStorage = async (id: string, idToCheck: string) => {
  try {
    const { deleteByIdMatch } = await import('./audioStore');
    await deleteByIdMatch(id, (idToCheck as any) === 'conversationId' ? 'conversationId' : 'uniqueId');
  } catch {
    // Fallback: legacy localStorage cleanup
    try {
      const blobs = JSON.parse(localStorage.getItem("audio_blobs") || "[]");
      const filtered = blobs.filter((b: any) => b[idToCheck] !== id);
      localStorage.setItem("audio_blobs", JSON.stringify(filtered));
    } catch {}
  }
}

export const getDeviceInfo = () => {
  const ua = navigator.userAgent;
  const deviceType = getDeviceTypeFromId(ua);
  const deviceId = ua;
  return { deviceType, deviceId };
};

export const getFailedConversations = async ({
  setFailedBlobs, setLocalBlobs = (a: any) => { } }: any) => {
  const headers = getAuthHeaders();
  const response = await fetch(
    `/api/conversations?type=GET_ALL_CONVERSATIONS&getAll=true`,
    {
      method: "GET",
      headers
    }
  );

  const result = await response.json();
  if (!response.ok) {
    console.error("Error fetching conversations:", result.message);
    return;
  }
  let conversations = [];
  if (result.data) {
    conversations = result.data.records;
  }
  let userId = getUserId();
  const blobs = JSON.parse(localStorage.getItem("audio_blobs") || "[]");
  const userBlobs = blobs.filter((b: any) => b.userId === userId);
  setLocalBlobs(userBlobs);
  const failed = userBlobs.filter(
    b => b.uploadStatus === 'twinAiFailed' || b.uploadStatus === 'failed'
  );
  const failedConversations = conversations?.filter((conv: any) => conv.conversation_status === CONVERSATION_STATUS.TWIN_AI_UPLOAD_FAILED || conv.conversation_status === CONVERSATION_STATUS.FILE_UPLOAD_FAILED);
  // build conversation-based failed blobs
  const failedConvBlobs = failedConversations?.map((conv: any) => ({
    uniqueId: conv.id,
    title: conv.title,
    customerName: conv?.customer?.name,
    customerId: conv?.customer?.id,
    conversationId: conv.id,
    userId,
    uploadStatus: conv.conversation_status === CONVERSATION_STATUS.TWIN_AI_UPLOAD_FAILED ? 'twinAiFailed' : 'failed',
    retryCount: 0,
  }));
  // avoid duplicates: only include conv if not already in failed[]
  const merged = [
    ...failed,
    ...failedConvBlobs?.filter(
      (convBlob: any) =>
        !failed.some((f: any) => f.conversationId === convBlob.conversationId)
    ),
  ];
  setFailedBlobs(merged);
}

export const getDeviceTypeFromId = (deviceId: string | undefined) => {
  if (!deviceId) return null;

  const ua = deviceId.toLowerCase(); // Convert to lowercase for consistent matching

  // Helper function to detect OS
  const getOsType = (ua: string) => {
    if (/android/i.test(ua)) return "android";
    if (/ipad|iphone|ipod/i.test(ua)) return "ios";
    if (/macintosh|mac os x/i.test(ua)) return "mac";
    if (/ubuntu/i.test(ua)) return "ubuntu";
    if (/linux/i.test(ua)) return "linux";
    if (/win/i.test(ua)) return "windows";
    return "web"; // Fallback for unrecognized OS
  };

  // Helper function to detect browser
  const getBrowserType = (ua: string) => {
    if (/brave/i.test(ua)) return "brave"; // Brave browser
    if (/edg/i.test(ua)) return "edge"; // Microsoft Edge
    if (/firefox/i.test(ua)) return "firefox"; // Firefox
    if (/safari/i.test(ua) && !/chrome|chromium|crios/i.test(ua)) return "safari"; // Safari (exclude Chrome pretending to be Safari)
    if (/chrome|chromium|crios/i.test(ua)) return "chrome"; // Chrome or Chrome-based browsers
    if (/opera|opr/i.test(ua)) return "opera"; // Opera
    return ""; // Fallback for unrecognized browsers
  };

  const os = getOsType(ua);
  const browser = getBrowserType(ua);

  // Combine OS and browser, e.g., "windows chrome"
  return `${os} ${browser}`;
};
