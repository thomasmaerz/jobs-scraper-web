import { NextResponse } from "next/server";

import { getLinkedInDiscoveryStatus } from "@/lib/config/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const status = await getLinkedInDiscoveryStatus();
    return NextResponse.json({ data: status }, {
      headers: { "Cache-Control": "no-store, private" },
    });
  } catch (error) {
    console.error("LinkedIn discovery status API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load LinkedIn discovery status" },
      { status: 500, headers: { "Cache-Control": "no-store, private" } },
    );
  }
}
