import { prisma } from "../utils/prisma";
import { NextRequest } from "next/server";

export class CompanyModel {
  /**
   * Fetches all companies, with pagination.
   * @param req The NextRequest object, for reading search parameters.
   * @returns A JSON response containing the list of companies if successful,
   *          or an error message if unauthorized or an error occurs.
   */
  static async getComapanies(req: NextRequest) {
    let whereClause: any = {};

    const searchParams = req.nextUrl.searchParams;

    const filters = {
      start_date: searchParams.get("start_date") || undefined,
      end_date: searchParams.get("end_date") || undefined,
      search: searchParams.get("search") || undefined,
      sort_col: searchParams.get("sort_col") || "created_at",
      sort_dir: searchParams.get("sort_dir") === "desc" ? "desc" : "asc",
    };

    const page = parseInt(searchParams.get("page") || "1");
    const per_page = parseInt(searchParams.get("per_page") || "10");
    const skip = (page - 1) * per_page;

    if (filters.search) {
      whereClause.OR = [
        { title: { contains: filters.search, mode: "insensitive" } },
        { contact_person: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    if (filters.start_date || filters.end_date) {
      whereClause.created_at = {};
      if (filters.start_date) {
        const startDate = new Date(filters.start_date + "T00:00:00.000Z");
        if (!isNaN(startDate.getTime())) {
          whereClause.created_at.gte = startDate;
        }
      }
      if (filters.end_date) {
        const endDate = new Date(filters.end_date + "T23:59:59.999Z");
        if (!isNaN(endDate.getTime())) {
          whereClause.created_at.lte = endDate;
        }
      }
    }

    // Validate and apply sorting only if allowed columns
    const validSortColumns = ["title", "contact_person", "created_at"];
    const sortBy: any = validSortColumns.includes(filters.sort_col)
      ? { [filters.sort_col]: filters.sort_dir }
      : { created_at: "desc" };

    const totalRecords = await prisma.company.count({ where: whereClause });

    // First get the basic user records
    const records = await prisma.company.findMany({
      where: whereClause,
      select: {
        id: true,
        title: true,
        contact_person: true,
        email: true,
        notes: true,
        phone: true,
        created_at: true,
        users: {
          select: { id: true },
        },
      },
      orderBy: sortBy,
      skip: skip,
      take: per_page,
    });

    return {
      records: records.map(({ users, ...company }) => ({
        ...company,
        total_users: users.length,
      })),
      pagination: {
        page,
        per_page,
        total_records: totalRecords,
        total_pages: Math.ceil(totalRecords / per_page),
      },
    };
  }
}
