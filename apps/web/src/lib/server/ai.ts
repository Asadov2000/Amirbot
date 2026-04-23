import { getInsights } from "../mock-data";
import type { DashboardSnapshot } from "../types";

export function getAiResponse(snapshot: DashboardSnapshot) {
  return {
    generatedAt: new Date().toISOString(),
    insights: getInsights(snapshot),
    answer: snapshot.events.find((event) => event.kind === "FEEDING")
      ? `Последнее кормление было ${snapshot.overview.lastFeeding.toLowerCase()}.`
      : "Последнее кормление пока не зарегистрировано.",
  };
}
