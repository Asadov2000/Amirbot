import { NextResponse } from "next/server";

import { getDashboardSnapshot } from "@/lib/server/dashboard";

export async function GET() {
  return NextResponse.json(await getDashboardSnapshot());
}
