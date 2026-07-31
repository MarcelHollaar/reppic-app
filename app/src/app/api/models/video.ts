import { prisma } from "../utils/prisma";
import {
  saveFileToFtp,
  deleteFile,
  generateVideoUploadPath,
} from "../utils/fileStorage";
import { getFullUrl } from "../utils/urlHelper";

export class VideoModel {
  static async getVideos(req: any) {
    const searchParams = req.nextUrl.searchParams;

    const filters = {
      search: searchParams.get("search") || undefined,
      category_id: searchParams.get("category_id") || undefined,
      tag_id: searchParams.get("tag_id") || undefined,
      type: searchParams.get("video_type") || undefined,
    };

    const lang_code = searchParams.get("lang_code") || undefined;

    const page = parseInt(searchParams.get("page") || "1");
    const per_page = parseInt(searchParams.get("per_page") || "10");
    const skip = (page - 1) * per_page;

    let whereClause: any = { status: "active", deleted_at: null };
    if (filters.search) {
      whereClause.OR = [
        { title: { contains: filters.search, mode: "insensitive" } },
        { description: { contains: filters.search, mode: "insensitive" } },
      ];
    }
    if (filters.category_id) {
      whereClause.category_id = filters.category_id;
    }
    if (filters.type) {
      whereClause.type = filters.type;
    }
    // Add tag filter using relation
    if (filters.tag_id) {
      whereClause.tags = {
        some: {
          tag_id: filters.tag_id,
        },
      };
    }

    const totalRecords = await prisma.video.count({ where: whereClause });

    const rawRecords = await prisma.video.findMany({
      where: whereClause,
      orderBy: { created_at: "desc" },
      skip: skip,
      take: per_page,
      include: {
        tags: { include: { tag: true } },
        category: true,
        uploaded_by_user: true,
      },
    });

    let videoTranslations: Record<string, string> = {};
    let categoryTranslations: Record<string, string> = {};
    let tagTranslations: Record<string, string> = {};
    let embeddedCodeTranslations: Record<string, string> = {};

    if (lang_code) {
      const translations = await prisma.titleTranslation.findMany({
        where: {
          lang_code,
          deleted_at: null,
        },
      });
      videoTranslations = translations
        .filter((t) => t.type === "video")
        .reduce((acc, t) => {
          acc[t.type_id] = t.value;
          return acc;
        }, {} as Record<string, string>);
      categoryTranslations = translations
        .filter((t) => t.type === "category")
        .reduce((acc, t) => {
          acc[t.type_id] = t.value;
          return acc;
        }, {} as Record<string, string>);
      tagTranslations = translations
        .filter((t) => t.type === "tag")
        .reduce((acc, t) => {
          acc[t.type_id] = t.value;
          return acc;
        }, {} as Record<string, string>);
      embeddedCodeTranslations = translations
        .filter((t) => t.type === "video")
        .reduce((acc, t) => {
          acc[t.type_id] = t.embedded_code;
          return acc;
        }, {} as Record<string, string>);
    }

    const records = rawRecords.map((video) => ({
      ...video,
      title:
        lang_code && videoTranslations[video.id]
          ? videoTranslations[video.id]
          : video.title,
      embedded_code:
        lang_code && embeddedCodeTranslations[video.id]
          ? embeddedCodeTranslations[video.id]
          : video.embedded_code,
      thumbnail_path: video.thumbnail_path
        ? getFullUrl(video.thumbnail_path)
        : null,
      category: video.category
        ? {
            ...video.category,
            name:
              lang_code && categoryTranslations[video.category.id]
                ? categoryTranslations[video.category.id]
                : video.category.name,
          }
        : null,
      tags: video.tags.map((tagObj) => ({
        ...tagObj,
        tag: tagObj.tag
          ? {
              ...tagObj.tag,
              name:
                lang_code && tagTranslations[tagObj.tag.id]
                  ? tagTranslations[tagObj.tag.id]
                  : tagObj.tag.name,
            }
          : null,
      })),
    }));

    return {
      records: records,
      pagination: {
        page,
        per_page,
        total_records: totalRecords,
        total_pages: Math.ceil(totalRecords / per_page),
      },
    };
  }

  static async createVideo(
    data: any,
    fileBuffer: ArrayBuffer | null,
    fileName: string
  ) {
    try {
      if (!data || !data.tags || !Array.isArray(data.tags)) {
        throw new TypeError("Invalid data: 'tags' must be a non-empty array.");
      }

      // Use English title for the main videos table
      const enTitle =
        data.titles?.find?.((t: any) => t.lang_code === "en")?.value || "";

      const videoData = {
        title: data.title,
        phase: data.phase,
        number: data.number,
        embedded_code: data.embedded_code,
        type: data.type,
        status: data.status,
        uploaded_by_user: { connect: { id: data.uploaded_by } },
        category: {
          connect: { id: data.category_id },
        },
        tags: {
          create: data.tags.map((tagId: string) => ({
            tag: { connect: { id: tagId } },
          })),
        },
      };

      const video = await prisma.video.create({
        data: videoData,
      });

      // If a file is uploaded, save it and set the filePath
      if (fileBuffer) {
        let thumbailUrl = "";
        const path = generateVideoUploadPath(video.id);
        thumbailUrl = await saveFileToFtp(fileBuffer, fileName, path); // Save file buffer

        if (video?.thumbnail_path) {
          await deleteFile(video.thumbnail_path);
        }

        await prisma.video.update({
          where: { id: video.id },
          data: {
            thumbnail_path: thumbailUrl,
          },
        });
      }
      return video;
    } catch (error) {
      console.log("Error while creating video with prisma ", error);
      throw error;
    }
  }

  static async getVideoById(videoId: string, langCode?: string) {
    const video = await prisma.video.findFirst({
      where: { id: videoId, status: "active", deleted_at: null },
      include: {
        tags: { include: { tag: true } },
        category: true,
        uploaded_by_user: true,
      },
    });

    if (!video) return null;

    if (video?.thumbnail_path) {
      video.thumbnail_path = getFullUrl(video.thumbnail_path);
    }

    // Fetch all title translations for this video
    const titles = await prisma.titleTranslation.findMany({
      where: {
        type: "video",
        type_id: video.id,
        deleted_at: null,
      },
      select: {
        lang_code: true,
        value: true,
        embedded_code: true,
      },
    });

    if (langCode) {
      const translations = await prisma.titleTranslation.findMany({
        where: {
          lang_code: langCode,
          deleted_at: null,
          OR: [
            { type: "video", type_id: video.id },
            { type: "category", type_id: video.category?.id },
            ...video.tags.map((tagObj: any) => ({
              type: "tag",
              type_id: tagObj.tag?.id,
            })),
          ],
        },
      });

      const videoTranslation = translations.find(
        (t) => t.type === "video" && t.type_id === video.id
      );
      if (videoTranslation) {
        (video.title = videoTranslation.value
          ? videoTranslation.value
          : video.title),
          (video.embedded_code =
            videoTranslation.embedded_code || video.embedded_code);
      }

      if (video.category) {
        const categoryTranslation = translations.find(
          (t) => t.type === "category" && t.type_id === video.category.id
        );
        if (categoryTranslation)
          video.category.name = categoryTranslation.value;
      }

      if (video.tags && Array.isArray(video.tags)) {
        video.tags = video.tags.map((tagObj) => {
          if (tagObj.tag) {
            const tagTranslation = translations.find(
              (t) => t.type === "tag" && t.type_id === tagObj.tag.id
            );
            if (tagTranslation) tagObj.tag.name = tagTranslation.value;
          }
          return tagObj;
        });
      }
    }

    // Attach all titles to the response
    video.titles = titles;

    return video;
  }

  static async updateVideo(
    videoId: string,
    data: any,
    fileBuffer: ArrayBuffer | null,
    fileName: string
  ) {
    const updateData: any = {
      ...data,
    };

    if (data.tags) {
      updateData.tags = {
        deleteMany: {}, // Remove existing tags
        create: data.tags.map((tagId: string) => ({
          tag: { connect: { id: tagId } },
        })),
      };
    }

    let video = await prisma.video.update({
      where: { id: videoId },
      data: updateData,
    });

    // If a file is uploaded, save it and set the filePath
    if (fileBuffer) {
      let thumbailUrl = "";
      const path = generateVideoUploadPath(video.id);
      thumbailUrl = await saveFileToFtp(fileBuffer, fileName, path); // Save file buffer

      if (video?.thumbnail_path) {
        await deleteFile(video.thumbnail_path);
      }

      await prisma.video.update({
        where: { id: video.id },
        data: {
          thumbnail_path: thumbailUrl,
        },
      });
    }
    return video;
  }

  static async deleteVideo(videoId: string) {
    return prisma.video.update({
      where: { id: videoId },
      data: { deleted_at: new Date() },
    });
  }
}
