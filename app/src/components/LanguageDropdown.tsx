import React, { useRef, useState, useEffect } from "react";
import { ChevronDownIcon } from "@heroicons/react/24/solid";
import { useTranslation } from "react-i18next";
import { supportedLanguages } from "@/configs/constants";

interface LanguageDropdownProps {
	value: string;
	onChange: (code: string) => void;
}

const LanguageDropdown: React.FC<LanguageDropdownProps> = ({ value, onChange }) => {
	const [isOpen, setIsOpen] = useState(false);
	const dropdownRef = useRef<HTMLDivElement>(null);
	const {t} = useTranslation('common');
	useEffect(() => {
		const handleClickOutside = (event: any) => {
			if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
				setIsOpen(false);
			}
		};
		document.addEventListener("mousedown", handleClickOutside);
		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
		};
	}, []);

	return (
		<div className="tw-relative" ref={dropdownRef}>
			<div
				className="tw-flex tw-items-center tw-relative tw-cursor-pointer"
				onClick={() => setIsOpen((open) => !open)}
			>
				<input
					type="text"
					className="tw-w-28 tw-px-4 tw-py-2 tw-rounded-3xl tw-bg-white tw-border tw-border-gray-400 focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-500 tw-font-normal tw-text-black tw-placeholder-gray-500 tw-cursor-pointer"
					value={supportedLanguages.find((l) => l.code === value)?.label || value.toUpperCase()}
					readOnly
					style={{ border: "1px solid #D0D5DD" }}
				/>
				<ChevronDownIcon className="tw-w-5 tw-h-5 tw-absolute tw-right-2 tw-text-gray-500 tw-cursor-pointer" />
			</div>
			{isOpen && (
				<div
					className="tw-absolute !tw-z-50 tw-w-36 tw-mt-1 tw-bg-white tw-rounded-3xl tw-shadow-lg tw-border tw-border-gray-200 tw-max-h-60 tw-custom-scrollbar tw-overflow-y-auto"
					style={{ borderRadius: "5px" }}
				>
					<div className="tw-p-3 tw-m-2 tw-font-medium tw-rounded-xl tw-bg-blue-50 tw-text-black">
						{t('common.selectLanguage')}
					</div>
					{supportedLanguages.map((lang) => (
						<div
							key={lang.code}
							className={`tw-p-3 tw-cursor-pointer hover:tw-bg-gray-100 tw-text-black ${
								value === lang.code ? "tw-bg-blue-100" : ""
							}`}
							onClick={() => {
								onChange(lang.code);
								setIsOpen(false);
							}}
						>
							{lang.label}
						</div>
					))}
				</div>
			)}
		</div>
	);
};

export default LanguageDropdown;
