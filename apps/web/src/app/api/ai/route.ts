import { NextResponse } from "next/server";

import { getDashboardSnapshot } from "@/lib/server/dashboard";
import { getAiResponse } from "@/lib/server/ai";

export async function GET() {
  const snapshot = await getDashboardSnapshot();
  return NextResponse.json(getAiResponse(snapshot));
}
