import { NextResponse } from "next/server";

import { AuthenticationError, requireAdmin } from "@/lib/auth/admin";
import { getScraperConfiguration, replaceScraperConfiguration } from "@/lib/config/repository";
import { ConfigurationValidationError, validateConfiguration } from "@/lib/config/validation";
import { ConfigurationConflictError } from "@/lib/config/conflict";

export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  if (error instanceof AuthenticationError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status, headers: { "Cache-Control": "no-store, private" } },
    );
  }
  if (error instanceof ConfigurationValidationError) {
    return NextResponse.json({ error: "Invalid configuration", issues: error.issues }, { status: 400 });
  }
  if (error instanceof ConfigurationConflictError) {
    return NextResponse.json(
      { error: error.message, code: error.code, action: "reload" },
      { status: 409, headers: { "Cache-Control": "no-store, private" } },
    );
  }
  console.error("Configuration API error:", error);
  return NextResponse.json(
    { error: error instanceof Error ? error.message : "Configuration request failed" },
    { status: 500 },
  );
}

export async function GET() {
  try {
    await requireAdmin();
    const configuration = await getScraperConfiguration();
    return NextResponse.json({ data: configuration }, {
      headers: { "Cache-Control": "no-store, private" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const actor = await requireAdmin();
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("application/json")) {
      return NextResponse.json({ error: "Content-Type must be application/json" }, { status: 415 });
    }
    const raw: unknown = await request.json();
    const configuration = validateConfiguration(raw);
    const saved = await replaceScraperConfiguration(configuration, actor);
    return NextResponse.json({ data: saved });
  } catch (error) {
    return errorResponse(error);
  }
}
