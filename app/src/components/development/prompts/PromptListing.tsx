"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { getAuthHeaders } from "@/utils/getAuthHeaders";
import { useUserRole } from "@/hooks/useUserRole";
import { useRouter } from "next/navigation";
import { toast, ToastContainer } from "react-toastify";
import { EllipsisVerticalIcon, PencilIcon, TrashIcon, PlusIcon } from "@heroicons/react/24/outline";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";

type PromptMeta =
  | { type: "excel"; fileName?: string; uploadedAt?: string; fileSize?: number }
  | { type: "text"; text: string };

export default function PromptListing() {
  const { t } = useTranslation("common");
  const router = useRouter();
  const userRole = useUserRole();
  const [records, setRecords] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const headers = getAuthHeaders() || { 'Content-Type': 'application/json' } as any;

  useEffect(() => {
    if (userRole) fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userRole, page, perPage]);

  const fetchData = async () => {
    const url = `/api/prompts?type=GET_PROMPTS&page=${page}&per_page=${perPage}&search=${encodeURIComponent(search)}`;
    const res = await fetch(url, { headers });
    if (res.ok) {
      const json = await res.json();
      setRecords(json.data.records || []);
      setTotalPages(json.data.pagination?.total_pages || 1);
    }
  };

  const enhancedRecords = useMemo(() => records.map((record) => ({
    ...record,
    meta: parsePromptMeta(record?.prompt),
  })), [records]);

  const handleNew = () => router.push("/developments/prompts/new");
  const handleEdit = (id: string) => router.push(`/developments/prompts/${id}/edit`);
  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/prompts/${id}`, { method: 'DELETE', headers });
    if (res.ok) { toast.success(t('successMessages.elementDeletedSuccessfully', { element: 'Prompt' })); fetchData(); }
    else toast.error(t('errorMessages.somethingWentWrong'));
  };

  return (
    <div className="tw-mt-4">
      <ToastContainer />
      <div className="tw-flex tw-justify-between tw-items-center tw-mb-4">
        <h2 className="tw-text-2xl tw-font-medium">Prompts</h2>
        <button onClick={handleNew} className="tw-flex tw-items-center tw-gap-2 btn-bg-blue tw-text-white tw-rounded-full tw-h-10 tw-px-5 tw-font-medium tw-text-[0.875rem] hover:tw-bg-blue-700">
          <PlusIcon className="tw-w-5 tw-h-5" /> {t('common.newElement', { element: 'Prompt' })}
        </button>
      </div>

      <div className="tw-bg-white tw-rounded-2xl tw-border tw-border-blue-gray-100 tw-overflow-hidden">
        <table className="tw-w-full tw-text-left">
          <thead className="tw-bg-gray-50">
            <tr>
              <th className="tw-p-3">Lang</th>
              <th className="tw-p-3">Prompt</th>
              <th className="tw-p-3">Updated</th>
              <th className="tw-p-3">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {enhancedRecords.map((r) => (
              <tr key={r.id} className="tw-border-t">
                <td className="tw-p-3">{r.lang_code}</td>
                <td className="tw-p-3 tw-max-w-[500px]">
                  {r.meta?.type === 'excel' ? (
                    <div className="tw-flex tw-flex-col tw-text-sm">
                      <span className="tw-font-medium">{r.meta.fileName || 'Excel document'}</span>
                      {r.meta.fileSize && <span className="tw-text-xs tw-text-gray-500">{formatBytes(r.meta.fileSize)}</span>}
                    </div>
                  ) : (
                    <span className="tw-text-sm tw-text-gray-700 tw-line-clamp-2" title={r.meta?.text || ''}>{r.meta?.text || '—'}</span>
                  )}
                </td>
                <td className="tw-p-3">
                  {r.meta?.type === 'excel' && r.meta.uploadedAt
                    ? new Date(r.meta.uploadedAt).toLocaleString()
                    : new Date(r.updated_at).toLocaleString()}
                </td>
                <td className="tw-p-3">
                  <Menu as="span" className="tw-relative">
                    <MenuButton className="tw-p-1 tw-rounded-full hover:tw-bg-gray-100 focus:tw-outline-none">
                      <EllipsisVerticalIcon className="tw-w-5 tw-h-5 tw-text-gray-600" />
                    </MenuButton>
                    <MenuItems anchor="bottom" className="tw-absolute tw-right-0 tw-z-10 tw-mt-2 tw-w-32 tw-origin-top-right tw-rounded-md tw-bg-white tw-shadow-lg tw-ring-1 tw-ring-black tw-ring-opacity-5 tw-focus:outline-none">
                      <div className="tw-py-1">
                        <MenuItem>
                          {({ active }) => (
                            <button onClick={() => handleEdit(r.id)} className={`tw-flex tw-items-center tw-w-full tw-px-4 tw-py-2 tw-text-sm tw-text-left ${active ? 'tw-bg-gray-100' : ''}`}>
                              <PencilIcon className="tw-w-4 tw-h-4 tw-mr-2 tw-text-blue-500 tw-flex-shrink-0" /> <span>{t('form.edit')}</span>
                            </button>
                          )}
                        </MenuItem>
                        <MenuItem>
                          {({ active }) => (
                            <button onClick={() => handleDelete(r.id)} className={`tw-flex tw-items-center tw-w-full tw-px-4 tw-py-2 tw-text-sm tw-text-left ${active ? 'tw-bg-gray-100' : ''}`}>
                              <TrashIcon className="tw-w-4 tw-h-4 tw-mr-2 tw-text-red-500 tw-flex-shrink-0" /> <span>{t('form.delete')}</span>
                            </button>
                          )}
                        </MenuItem>
                      </div>
                    </MenuItems>
                  </Menu>
                </td>
              </tr>
            ))}
            {enhancedRecords.length === 0 && (
              <tr>
                <td className="tw-p-4" colSpan={5}>{t('common.noElementsFound', { element: 'prompts' })}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function parsePromptMeta(value?: string | null): PromptMeta | null {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  if (raw.startsWith('{')) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.filePath || parsed?.type === 'excel') {
        return {
          type: 'excel',
          fileName: parsed?.fileName,
          uploadedAt: parsed?.uploadedAt,
          fileSize: parsed?.fileSize,
        };
      }
    } catch (error) {
      console.warn('Failed to parse prompt record', error);
    }
  }
  return { type: 'text', text: raw };
}

function formatBytes(value?: number) {
  if (!value) return '';
  if (value < 1024) return `${value} B`;
  const units = ['KB', 'MB', 'GB'];
  let size = value / 1024;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(1)} ${units[unit]}`;
}
