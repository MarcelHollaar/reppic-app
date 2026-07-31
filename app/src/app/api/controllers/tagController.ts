import { NextRequest, NextResponse } from "next/server";
import { TagService } from "../services/tagService";
import { prisma } from "../utils/prisma";
import { initializeI18n } from "../helpers/userHelper";

export class TagController {
  static async getAllTags(req: NextRequest) {
    try {
      const user = (req as any).user;
      if (!user) {
        return NextResponse.json(
          { message: "Unauthorized User." },
          { status: 401 }
        );
      }
      const tags = await TagService.getAllTags(req);
      return NextResponse.json(
        { message: "Tags fetched", data: tags },
        { status: 200 }
      );
    } catch (error) {
      console.log("Error while getting all tags", error);
      return NextResponse.json({ message: error }, { status: 500 });
    }
  }

  static async createTag(req: NextRequest, data: any) {
    try {
      const user = (req as any).user;
      if (!user) {
        return NextResponse.json(
          { message: "Unauthorized User." },
          { status: 401 }
        );
      }
      const result = await TagService.createTag(data);
      if (!result) {
        return NextResponse.json(
          { message: "Couldn't create tag." },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { message: "Tag creation successful" },
        { status: 200 }
      );
    } catch (error) {
      console.log("Error while creating tag", error);
      return NextResponse.json({ message: error }, { status: 500 });
    }
  }

  static async updateTag(req: NextRequest, data: any, tagId: string) {
    try {
      const user = (req as any).user;
      if (!user) {
        return NextResponse.json(
          { message: "Unauthorized User." },
          { status: 401 }
        );
      }
      const result = await TagService.updateTag(tagId, data);
      if (!result) {
        return NextResponse.json(
          { message: "Couldn't update tag." },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { message: "Tag update successful" },
        { status: 200 }
      );
    } catch (error) {
      console.log("Error while updating tag", error);
      return NextResponse.json({ message: error }, { status: 500 });
    }
  }

  static async deleteTag(req: NextRequest, tagId: string, langCode?: string) {
    const i18n = await initializeI18n();
    if (langCode) {
      await i18n.changeLanguage(langCode);
    }
    const t = i18n.t;
    try {
      const user = (req as any).user;
      if (!user) {
        return NextResponse.json(
          { message: "Unauthorized User." },
          { status: 401 }
        );
      }

      const tag = await prisma.tag.findUnique({
        where: { id: tagId },
        include: {
          videos: {
            where: {
              video: {
                deleted_at: null, // Filter videos where deleted_at is null
              },
            },
          },
        },
      });

      if (!tag) {
        return { success: false, message: "Tag not found." };
      }

      if (tag.videos.length > 0) {
        return NextResponse.json(
          { message: t("errorMessages.tagAssigned") },
          { status: 400 }
        );
      }
      const result = await TagService.deleteTag(tagId);

      if (!result) {
        return NextResponse.json(
          { message: t("errorMessages.couldNotDeleteTag") },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { message: "Tag deletion successful" },
        { status: 200 }
      );
    } catch (error) {
      console.log("Error while deleting tag", error);
      return NextResponse.json({ message: error }, { status: 500 });
    }
  }

  static async getTagById(req: NextRequest, tagId: string, langCode?: string) {
    try {
      const user = (req as any).user;
      if (!user) {
        return NextResponse.json(
          { message: "Unauthorized User." },
          { status: 401 }
        );
      }
      const tag = await TagService.getTagById(tagId, langCode);
      if (!tag) {
        return NextResponse.json(
          { message: "Tag not found." },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { message: "Tag fetched", data: tag },
        { status: 200 }
      );
    } catch (error) {
      console.log("Error while getting tag by ID", error);
      return NextResponse.json({ message: error }, { status: 500 });
    }
  }
}
