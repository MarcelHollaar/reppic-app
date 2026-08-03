"use client";
import React, { useState } from "react";
import DropdownCloseIcon from "../DropdownCloseIcon";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";

interface InviteMemberDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
  maxSubscriptionsLimit?: number | null;
  totalPresentSubscriptions?: number;
}

const InviteMemberDialog: React.FC<InviteMemberDialogProps> = ({
  isOpen,
  onClose,
  onSuccess,
  maxSubscriptionsLimit = 0,
  totalPresentSubscriptions = 0
}) => {
  const [emails, setEmails] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [inviteRole, setInviteRole] = useState<"user" | "manager">("user");
  // Leer-as (LMS-integratie): onafhankelijk van de sales-rol toe te kennen.
  const [inviteLearningRole, setInviteLearningRole] = useState<
    "learner" | "learning_admin" | "none"
  >("learner");
  const { t } = useTranslation('common');
  if (!isOpen) return null;

  // Validate emails
  const validateEmails = (emailString: string) => {
    setError(""); // Reset errors

    // Remove unwanted spaces and split by commas
    const emailArray = emailString
      .split(",")
      .map((email) => email.trim()) // Remove spaces from start and end
      .filter((email) => email !== ""); // Remove empty values

    // Email validation regex
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

    // Check for invalid emails
    const invalidEmails = emailArray.filter((email) => !emailRegex.test(email));

    if (invalidEmails.length > 0) {
      setError(`${t('errorMessages.invalidEmails')}: ${invalidEmails.join(", ")}`);
      return false;
    }

    // Check for duplicate emails
    const uniqueEmails = new Set(emailArray);
    if (uniqueEmails.size !== emailArray.length) {
      setError(`${t('errorMessages.duplicateEmails')}`);
      return false;
    }

    if (emailArray.length === 0) {
      setError(t('errorMessages.atLeastOneEmail'));
      return false;
    }

    return emailArray; // Return valid email array
  };

  const handleSendInvites = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      setError(t("errorMessages.noAuthToken"));
      return;
    }
    
    let totalMembers = emails.split(",").length + totalPresentSubscriptions;
    const remainingSlots = maxSubscriptionsLimit - totalPresentSubscriptions;

    if (totalMembers > maxSubscriptionsLimit) {
      toast.error(t("errorMessages.canNotInviteMoreMembersWithLimit", { allowed: Math.max(remainingSlots, 0) }));
      return;
    } 

    const validEmails = validateEmails(emails);
    if (!validEmails) {
      onSuccess(t('successMessages.teamMembersInvited'));
      onClose();
      return
    }; // Stop if invalid emails
    setLoading(true);
    try {
      const response = await fetch("/api/user/invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          emails: validEmails,
          role: inviteRole,
          learning_role: inviteLearningRole,
        }),
      });

      const result = await response.json();
      if (response.ok) {
        let allMailsInvited = true;
        if (Array.isArray(result.data)) {
          result.data.forEach(entry => {
            if (entry.status === "Already Registered") {
              toast.error(t('errorMessages.emailElementAlreadyRegistered', { email: entry.email}));
              allMailsInvited = false;
            } else if (entry.status === "Failed") {
              toast.error(t('errorMessages.failedToInviteEmail', { email: entry.email}));
              allMailsInvited = false;
            }
          });
        }
        if (allMailsInvited) {
          onSuccess(t("successMessages.teamMembersInvited"));
        } else{
          onSuccess(t('successMessages.otherTeamMembersInvited'))
        }
        setEmails("");
        setError("")
        onClose();
      } else {
        setError(`Error: ${result.message}`);
      }
    } catch (error) {
      setError(t('errorMessages.unexpectedError'));
    }
    setLoading(false);
  };

  return (
    <>
      <div className="tw-fixed tw-inset-0 tw-z-50 tw-overflow-y-auto">
      <div className="tw-flex tw-items-center tw-justify-center tw-min-h-screen tw-px-4">
        {/* Backdrop */}
        <div
          className="tw-fixed tw-inset-0 tw-bg-black tw-bg-opacity-30 tw-transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />

        {/* Dialog */}
        <div className="tw-relative tw-bg-white tw-rounded-lg tw-shadow-xl tw-max-w-3xl tw-w-full tw-mx-auto tw-p-8">
          {/* Close Button */}
          <DropdownCloseIcon className="tw-top-4 tw-right-4" onClick={onClose} />

          {/* Title */}
          <h2 className="tw-text-xl tw-font-bold tw-text-gray-900 tw-mb-2">
            {t('inviteMember.referATeamMember')}
          </h2>
          <div className="tw-border-b tw-border-gray-200 tw-mb-6"></div>

          {/* Invite by Email Section */}
          <div className="tw-mb-6">
            <h3 className="tw-text-base tw-font-semibold tw-text-gray-900 tw-mb-3">
              {t('inviteMember.inviteMemberThroughEmail')}
            </h3>

            {/* Role selector: invite as salesperson or co-manager */}
            <div className="tw-mb-3">
              <p className="tw-text-[10px] tw-font-semibold tw-text-gray-400 tw-uppercase tw-tracking-widest tw-mb-1.5" suppressHydrationWarning>
                {t('inviteMember.inviteAs')}
              </p>
              <div className="tw-inline-flex tw-gap-1 tw-rounded-xl tw-p-1" style={{ backgroundColor: "#EBEBEB" }}>
                {(["user", "manager"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setInviteRole(r)}
                    className={`tw-px-3 tw-py-1.5 tw-text-sm tw-rounded-lg tw-transition-all ${
                      inviteRole === r
                        ? "tw-bg-white tw-text-gray-900 tw-font-semibold"
                        : "tw-text-gray-500 hover:tw-text-gray-700"
                    }`}
                    style={inviteRole === r ? { boxShadow: "0 1px 4px rgba(0,0,0,0.10)" } : {}}
                    suppressHydrationWarning
                  >
                    {r === "user" ? t('inviteMember.roleSalesperson') : t('inviteMember.roleManager')}
                  </button>
                ))}
              </div>
              {inviteRole === "manager" && (
                <p className="tw-text-xs tw-text-gray-500 tw-mt-1.5" suppressHydrationWarning>
                  {t('inviteMember.roleManagerHint')}
                </p>
              )}
            </div>

            {/* Leer-rol (leer-as, onafhankelijk van de sales-rol) */}
            <div className="tw-mb-3">
              <p className="tw-text-[10px] tw-font-semibold tw-text-gray-400 tw-uppercase tw-tracking-widest tw-mb-1.5" suppressHydrationWarning>
                {t('learning.learningRole')}
              </p>
              <div className="tw-inline-flex tw-gap-1 tw-rounded-xl tw-p-1" style={{ backgroundColor: "#EBEBEB" }}>
                {(["learner", "learning_admin", "none"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setInviteLearningRole(r)}
                    className={`tw-px-3 tw-py-1.5 tw-text-sm tw-rounded-lg tw-transition-all ${
                      inviteLearningRole === r
                        ? "tw-bg-white tw-text-gray-900 tw-font-semibold"
                        : "tw-text-gray-500 hover:tw-text-gray-700"
                    }`}
                    style={inviteLearningRole === r ? { boxShadow: "0 1px 4px rgba(0,0,0,0.10)" } : {}}
                    suppressHydrationWarning
                  >
                    {t(`learning.learningRole_${r}`)}
                  </button>
                ))}
              </div>
            </div>

            <div className="tw-flex tw-mb-2">
              <input
                type="text"
                placeholder={t("form.addEmailAddress")}
                value={emails}
                onChange={(e) => {
                  setEmails(e.target.value);
                  if (!e.target.value.trim()) setError("");
                }}
                className="tw-flex-1 tw-border tw-border-gray-300 tw-rounded-l-md tw-px-3 tw-py-2 focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-500 tw-border-r-0"
              />
            <button
              className={`tw-bg-[#5971F6] tw-text-white tw-rounded-r-md tw-px-4 tw-py-2 
                hover:tw-bg-blue-700 tw-border tw-border-gray-300 tw-border-l-0 
                ${!emails.trim() || loading ? "tw-opacity-50 tw-cursor-not-allowed" : ""}`}
              onClick={handleSendInvites}
              disabled={!emails.trim()}
            >
              {loading ? <svg className="tw-animate-spin tw-h-4 tw-w-4 tw-text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="tw-opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="tw-opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> : t("form.send")}
            </button>
            </div>

            {error && (
              <p className="tw-text-sm tw-text-red-500 tw-mt-2">
                {error}
              </p>
            )}

            <p className="tw-text-sm tw-text-[#616161]">
              {t('inviteMember.separateEmailsWithCommas')}
            </p>
          </div>
        </div>
      </div>
    </div>
    </>

  );
};

export default InviteMemberDialog;
