import type { QuickItemKind } from "./types";

export function normalizeQuickItemLabel(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function buildQuickItemKey(kind: QuickItemKind, label: string): string {
  const normalized = normalizeQuickItemLabel(label)
    .toLowerCase()
    .replace(/[^a-zа-яё0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "");

  return `${kind}:${normalized || "item"}`;
}
