import { TranslationType } from "@prisma/client";
import { prisma } from "../utils/prisma";

export class TitleTranslationModel {
  static async createTranslation(data: {
    lang_code: string;
    type: TranslationType;
    type_id: string;
    value: string;
  }) {
    return prisma.titleTranslation.create({
      data: {
        lang_code: data.lang_code,
        type: data.type,
        type_id: data.type_id,
        value: data.value,
      },
    });
  }

  static async getTranslations(params: {
    type?: TranslationType;
    type_id?: string;
    lang_code?: string;
    search?: string;
    page?: number;
    per_page?: number;
  }) {
    const {
      type,
      type_id,
      lang_code,
      search,
      page = 1,
      per_page = 20,
    } = params;

    const where: any = { deleted_at: null };
    if (type) where.type = type;
    if (type_id) where.type_id = type_id;
    if (lang_code) where.lang_code = lang_code;
    if (search) where.value = { contains: search, mode: "insensitive" };

    const skip = (page - 1) * per_page;

    const totalRecords = await prisma.titleTranslation.count({ where });
    const records = await prisma.titleTranslation.findMany({
      where,
      orderBy: { created_at: "desc" },
      skip,
      take: per_page,
    });

    return {
      records,
      pagination: {
        page,
        per_page,
        total_records: totalRecords,
        total_pages: Math.ceil(totalRecords / per_page),
      },
    };
  }

  static async getTranslationById(id: string) {
    return prisma.titleTranslation.findFirst({
      where: { id, deleted_at: null },
    });
  }

  static async updateTranslation(
    id: string,
    data: {
      lang_code?: string;
      type?: TranslationType;
      type_id?: string;
      value?: string;
    }
  ) {
    return prisma.titleTranslation.update({
      where: { id },
      data,
    });
  }

  static async deleteTranslation(id: string) {
    return prisma.titleTranslation.update({
      where: { id },
      data: { deleted_at: new Date() },
    });
  }

  static async AddOrUpdateTranslationByTypeAndTypeId(data: {
    type: TranslationType;
    type_id: string;
    lang_code: string;
    value: string;
    embedded_code?: string;
  }) {
    return prisma.titleTranslation.upsert({
      where: {
        type_type_id_lang_code: {
          type: data.type,
          type_id: data.type_id,
          lang_code: data.lang_code,
        },
      },
      create: {
        type: data.type,
        type_id: data.type_id,
        lang_code: data.lang_code,
        value: data.value,
        embedded_code: data?.embedded_code || "",
      },
      update: {
        value: data.value,
        embedded_code: data?.embedded_code || "",
      },
    });
  }
}
