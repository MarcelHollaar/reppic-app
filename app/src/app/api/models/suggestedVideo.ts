import { getFullUrl } from "../utils/urlHelper";
import { prisma } from "../utils/prisma";

export class SuggestedVideoModel {
  static async getSuggestedVideos(req: any, userId: string) {
    const searchParams = req.nextUrl.searchParams;

    const filters = {
      search: searchParams.get("search") || undefined,
    };

    const lang_code = searchParams.get("lang_code") || undefined;

    const page = parseInt(searchParams.get("page") || "1");
    const per_page = parseInt(searchParams.get("per_page") || "10");
    const skip = (page - 1) * per_page;

    let whereClause: any = {};
    if (filters.search) {
      whereClause.OR = [
        { user: { name: { contains: filters.search, mode: "insensitive" } } },
        { video: { title: { contains: filters.search, mode: "insensitive" } } },
      ];
    }

    const totalRecords = await prisma.suggestedVideo.count({
      where: whereClause,
    });

    const rawRecords = await prisma.suggestedVideo.findMany({
      where: {
        ...whereClause,
        user_id: userId,
        video: {
          status: "active",
          deleted_at: null,
        },
      },
      include: {
        video: {
          include: {
            uploaded_by_user: true,
            tags: { include: { tag: true } },
            category: true,
          },
        },
      },
      orderBy: { created_at: "desc" },
      skip: skip,
      take: per_page,
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

    const records = rawRecords.map((suggestedVideo) => {
      const video = suggestedVideo.video;
      return {
        ...suggestedVideo,
        video: video
          ? {
              ...video,
              title:
                lang_code && videoTranslations[video.id]
                  ? videoTranslations[video.id]
                  : video.title,
              embedded_code:
                lang_code && embeddedCodeTranslations[video.id]
                  ? embeddedCodeTranslations[video.id]
                  : video.embedded_code,
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
              thumbnail_path: video.thumbnail_path
                ? getFullUrl(video.thumbnail_path)
                : null,
            }
          : null,
        thumbnail_path: video?.thumbnail_path
          ? getFullUrl(video.thumbnail_path)
          : null,
      };
    });

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

  static async getSuggestedVideoById(id: string, langCode?: string) {
    const suggestedVideo = await prisma.suggestedVideo.findUnique({
      where: {
        id,
        video: {
          status: "active",
          deleted_at: null,
        },
      },
      include: {
        video: {
          include: {
            uploaded_by_user: true,
            tags: { include: { tag: true } },
            category: true,
          },
        },
      },
    });

    if (!suggestedVideo) return null;

    const video = suggestedVideo.video;

    if (langCode && video) {
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
        video.title = videoTranslation.value;
        video.embedded_code =
          videoTranslation.embedded_code || video.embedded_code;
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

    if (video?.thumbnail_path) {
      video.thumbnail_path = getFullUrl(video.thumbnail_path);
    }

    return suggestedVideo;
  }
}
