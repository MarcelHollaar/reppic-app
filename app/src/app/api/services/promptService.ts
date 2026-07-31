import { NextRequest } from "next/server";
import { PromptModel } from "../models/prompt";

export const PromptService = {
  async list(req: NextRequest) {
    return PromptModel.list(req as any);
  },

  async getById(id: string) {
    return PromptModel.getById(id);
  },

  async upsertMany(payload: { promptsByLang: Record<string, string> }) {
    return PromptModel.upsertManyByLang(payload);
  },

  async update(id: string, data: any) {
    return PromptModel.update(id, data);
  },

  async delete(id: string) {
    return PromptModel.delete(id);
  },

  async getLatestForLang(lang: string) {
    return PromptModel.getLatestForLang(lang);
  },
};
