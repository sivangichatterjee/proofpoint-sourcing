import { NextRequest } from "next/server";
import { db } from "@/lib/db";

export async function GET(_req: NextRequest) {
  const [latestScan, recentCompanyCount] = await Promise.all([
    db.scanRun.findFirst({ orderBy: { createdAt: "desc" } }),
    db.company.count({
      where: {
        createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) },
      },
    }),
  ]);

  return Response.json({ latestScan, recentCompanyCount });
}
