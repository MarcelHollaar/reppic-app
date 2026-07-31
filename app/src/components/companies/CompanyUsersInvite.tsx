import {
	Dialog,
	DialogHeader,
	DialogBody,
	DialogFooter,
	Typography,
	Spinner,
} from "@material-tailwind/react";
import { useState } from "react";
import { toast } from "react-toastify";
import { getAuthHeaders } from "@/utils/getAuthHeaders";
import { USER_ROLE } from "@/configs/constants";
import { useTranslation } from "react-i18next";
import RoleDropdown from "../RoleDropdown";

interface CompanyUsersInviteProps {
	companyId?: string;
	open: boolean;
	onClose: () => void;
	onSuccess?: (user?: any) => void;
	adminInvite?: boolean;
	localOnly?: boolean; // <-- add this prop
}

export default function CompanyUsersInvite({
	companyId,
	open,
	onClose,
	onSuccess,
	adminInvite = false,
	localOnly = false, // <-- default false
}: CompanyUsersInviteProps) {
	const [form, setForm] = useState({
		first_name: "",
		last_name: "",
		email: "",
		role: USER_ROLE.USER,
	});

	const [loading, setLoading] = useState(false);
	const [errors, setErrors] = useState<{ [key: string]: string }>({});
	const headers = getAuthHeaders();
	const { t } = useTranslation('common');
	const handleChange = (
		e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
	) => {
		const { name, value } = e.target;
		setForm((prev) => ({ ...prev, [name]: value }));
		setErrors((prev) => ({ ...prev, [name]: "" }));
	};

	const handleRoleChange = (value: string) => {
		let name = "role";
		setForm((prev) => ({ ...prev, [name]: value }));
		setErrors((prev) => ({ ...prev, [name]: "" }));
	}

	const validateForm = () => {
		const newErrors: { [key: string]: string } = {};
		if (!form.first_name) newErrors.first_name = t("errorMessages.firstNameRequired");
		if (!form.last_name) newErrors.last_name = t("errorMessages.lastNameRequired");
		if (!form.email) newErrors.email = t("errorMessages.emailRequired");
		else if (!/\S+@\S+\.\S+/.test(form.email))
			newErrors.email = t("errorMessages.invalidEmailFormat");
		setErrors(newErrors);
		return Object.keys(newErrors).length === 0;
	};

	const handleInvite = async () => {
		if (!validateForm()) return;

		if (localOnly) {
			// Just call onSuccess with form data, no API call
			onSuccess?.({
				first_name: form.first_name,
				last_name: form.last_name,
				email: form.email,
				role: form.role,
			});
			setForm({
				first_name: "",
				last_name: "",
				email: "",
				role: USER_ROLE.USER,
			});
			setErrors({});
			onClose();
			return;
		}

		setLoading(true);
		try {
			const formData = new FormData();
			formData.append("name", `${form.first_name} ${form.last_name}`);
			formData.append("email", form.email?.trim());

			if (!adminInvite) {
				formData.append("company_id", companyId ?? "");
				formData.append("role", form.role);
			} else {
				formData.append("admin_invite", "true");
			}

			if (headers && headers["Content-Type"]) {
				delete headers["Content-Type"];
			}

			const res = await fetch("/api/user", {
				method: "POST",
				headers,
				body: formData,
			});

			if (!res.ok) {
				const error = await res.json();
				if (error.message === "Email already taken.") {
					setErrors((prev) => ({ ...prev, email: t("errorMessages.emailAlreadyTaken") }));
				} else {
					let message = error.message?.[0]?.message || error?.message;
					throw new Error(message || t("errorMessages.failedToInviteUser"));
				}
			}

			if (res.ok) {
				// Only close the dialog and call onSuccess if the invite is successful
				toast.success(t("successMessages.userInvited"));
				setForm({
					first_name: "",
					last_name: "",
					email: "",
					role: USER_ROLE.USER,
				});
				setErrors((prev) => ({ ...prev, common: "" }));
				// Now call onClose and onSuccess after resetting the form
				onClose();
				onSuccess?.();
			}
		} catch (err: any) {
			// toast.error(err.message);
			setErrors((prev) => ({ ...prev, common: err.message }));
		} finally {
			setLoading(false);
		}
	};


	return (
		<Dialog open={open} handler={onClose} size="md" className="!tw-min-22 tw-p-4">
			<DialogHeader>{t('common.invite')} {adminInvite ? t("common.admin") : t("common.user")}</DialogHeader>
			<DialogBody className="!tw-p-4 tw-space-y-4">
				{/* First Name and Last Name */}
				<div className="tw-flex tw-flex-col md:tw-flex-row tw-gap-4">
					{/* First Name */}
					<div className="tw-w-full tw-mb-4">
						<Typography variant="h6"
							className="!tw-font-semibold !tw-text-black tw-mb-2 tw-font-[system-ui]">
							{t('form.firstName')}
						</Typography>
						<input name="first_name" placeholder={t("form.enterFirstName")} value={form.first_name}
							onChange={handleChange}
							className="tw-w-full tw-px-4 tw-py-2 tw-rounded-3xl tw-bg-white tw-border tw-border-gray-400 focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-500 tw-font-normal tw-text-black tw-placeholder-gray-500" />
						{errors.first_name && (
							<p className="tw-text-red-500 tw-text-sm tw-mt-1">{errors.first_name}</p>
						)}
					</div>

					{/* Last Name */}
					<div className="tw-w-full tw-mb-4">
						<Typography variant="h6"
							className="!tw-font-semibold !tw-text-black tw-mb-2 tw-font-[system-ui]">
							{t('form.lastName')}
						</Typography>
						<input name="last_name" placeholder={t("form.enterLastName")} value={form.last_name}
							onChange={handleChange}
							className="tw-w-full tw-px-4 tw-py-2 tw-rounded-3xl tw-bg-white tw-border tw-border-gray-400 focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-500 tw-font-normal tw-text-black tw-placeholder-gray-500" />
						{errors.last_name && (
							<p className="tw-text-red-500 tw-text-sm tw-mt-1">{errors.last_name}</p>
						)}
					</div>
				</div>

				{/* Email and (optional) Role */}
				<div className="tw-flex tw-flex-col md:tw-flex-row tw-gap-4">
					{/* Email */}
					<div className="tw-w-full tw-mb-4">
						<Typography variant="h6"
							className="!tw-font-semibold !tw-text-black tw-mb-2 tw-font-[system-ui]">
							{t('form.email')}
						</Typography>
						<input name="email" placeholder={t("addCompany.enterEmail")} value={form.email} onChange={handleChange}
							className="tw-w-full tw-px-4 tw-py-2 tw-rounded-3xl tw-bg-white tw-border tw-border-gray-400 focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-500 tw-font-normal tw-text-black tw-placeholder-gray-500" />
						{errors.email && (
							<p className="tw-text-red-500 tw-text-sm tw-mt-1">{errors.email}</p>
						)}
					</div>

					{/* Role - only if not adminInvite */}
					{!adminInvite && (
						<div className="tw-w-full tw-mb-4">
							<Typography variant="h6"
								className="!tw-font-semibold !tw-text-black tw-mb-2 tw-font-[system-ui]">
								{t('common.role')}
							</Typography>
							{/* <select name="role" value={form.role} onChange={handleChange}
								className="tw-w-full tw-px-4 tw-py-2 tw-rounded-3xl tw-bg-white tw-border tw-border-gray-400 focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-500">
								<option value={USER_ROLE.USER}>{t('common.user')}</option>
								<option value={USER_ROLE.MANAGER}>{t('dashboard.manager')}</option>
							</select> */}
							<RoleDropdown value={form.role} onChange={handleRoleChange} />
							{errors.role && (
								<p className="tw-text-red-500 tw-text-sm tw-mt-1">{errors.role}</p>
							)}
						</div>
					)}
				</div>

				{errors.common && (
					<p className="tw-text-red-500 tw-text-sm tw-mt-1">{errors.common}</p>
				)}
				
			</DialogBody>

			<DialogFooter className="tw-flex tw-justify-center tw-gap-4">
				<button type="button" onClick={onClose}
					className="tw-border tw-border-[#D0D5DD] tw-text-[#344054] tw-text-sm tw-font-medium tw-py-2 tw-px-4 tw-rounded-3xl">
					{t('passwordReset.cancel')}
				</button>
				<button onClick={handleInvite} disabled={loading} className={`tw-px-6 tw-py-2 tw-bg-blue-800
                    tw-text-white tw-rounded-3xl ${loading ? "tw-opacity-50 tw-cursor-not-allowed"
						: "hover:tw-bg-blue-900"}`}>
					{loading ?
						<Spinner className="tw-mx-2" /> : t("common.invite")}
				</button>
			</DialogFooter>
		</Dialog>
	);
}
