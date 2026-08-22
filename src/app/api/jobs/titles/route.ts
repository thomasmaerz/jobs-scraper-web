import { NextResponse } from "next/server";
import { getDistinctJobTitles } from "@/lib/supabase/queries";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const query = (searchParams.get("q") ?? "").trim();

  if (query.length > 100) {
    return NextResponse.json(
      { error: "Query must be 100 characters or fewer" },
      { status: 400 },
    );
  }

  const rawLimit = searchParams.get("limit");
  const parsedLimit = rawLimit === null ? 5000 : Number(rawLimit);
  if (rawLimit !== null && (rawLimit.trim() === "" || !Number.isInteger(parsedLimit))) {
    return NextResponse.json(
      { error: "Limit must be an integer" },
      { status: 400 },
    );
  }
  const limit = Math.min(Math.max(parsedLimit, 1), 5000);

  try {
    const data = await getDistinctJobTitles(query, limit);
    return NextResponse.json({ data });
  } catch (error) {
    console.error("Failed to load title suggestions:", error);
    return NextResponse.json(
      { error: "Failed to load suggestions" },
      { status: 500 },
    );
  }
}
