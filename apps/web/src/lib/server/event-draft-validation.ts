import { ApiError } from "./api-security";
import type { EventDraft } from "../types";

const EVENT_KINDS = new Set([
  "FEEDING",
  "SOLID_FOOD",
  "SLEEP",
  "DIAPER",
  "TEMPERATURE",
  "MEDICATION",
  "GROWTH",
  "NOTE",
]);
const STATUSES = new Set(["LOGGED", "STARTED", "COMPLETED"]);
const MAX_SUMMARY_LENGTH = 500;
const MAX_PAYLOAD_STRING_LENGTH = 500;
const MAX_CLIENT_REQUEST_ID_LENGTH = 128;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function validatePayload(
  payload: unknown,
): asserts payload is EventDraft["payload"] {
  if (!isRecord(payload)) {
    throw new ApiError(
      "Event payload must be an object",
      400,
      "Некорректные данные события.",
    );
  }

  for (const [key, value] of Object.entries(payload)) {
    if (key.length > 64) {
      throw new ApiError(
        "Event payload key is too long",
        400,
        "Некорректные данные события.",
      );
    }

    if (typeof value === "string" && value.length > MAX_PAYLOAD_STRING_LENGTH) {
      throw new ApiError(
        "Event payload string is too long",
        400,
        "Слишком длинный текст.",
      );
    }

    if (typeof value === "number" && !Number.isFinite(value)) {
      throw new ApiError(
        "Event payload number is not finite",
        400,
        "Некорректное число.",
      );
    }

    if (
      value !== null &&
      !["string", "number", "boolean"].includes(typeof value)
    ) {
      throw new ApiError(
        "Event payload contains unsupported value",
        400,
        "Некорректные данные события.",
      );
    }
  }
}

function payloadNumber(payload: EventDraft["payload"], key: string) {
  const value = payload[key];
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function validateSemanticPayload(kind: string, payload: EventDraft["payload"]) {
  if (kind === "FEEDING") {
    if (payload.mode === "BREAST") {
      const durationMinutes = payloadNumber(payload, "durationMinutes");
      if (!durationMinutes || durationMinutes < 1 || durationMinutes > 180) {
        throw new ApiError(
          "Breastfeeding duration is invalid",
          400,
          "Некорректная длительность кормления.",
        );
      }
      return;
    }

    if (payload.mode === "BOTTLE") {
      const volumeMl = payloadNumber(payload, "volumeMl");
      if (!volumeMl || volumeMl < 1 || volumeMl > 500) {
        throw new ApiError(
          "Bottle volume is invalid",
          400,
          "Некорректный объём бутылочки.",
        );
      }
      return;
    }

    throw new ApiError(
      "Feeding mode is invalid",
      400,
      "Некорректный тип кормления.",
    );
  }

  if (
    kind === "DIAPER" &&
    payload.type !== "WET" &&
    payload.type !== "DIRTY" &&
    payload.type !== "MIXED"
  ) {
    throw new ApiError(
      "Diaper type is invalid",
      400,
      "Некорректный тип подгузника.",
    );
  }

  if (
    kind === "SLEEP" &&
    payload.phase !== "START" &&
    payload.phase !== "END"
  ) {
    throw new ApiError(
      "Sleep phase is invalid",
      400,
      "Некорректная запись сна.",
    );
  }

  if (kind === "TEMPERATURE") {
    const temperatureC = payloadNumber(payload, "temperatureC");
    if (!temperatureC || temperatureC < 32 || temperatureC > 43) {
      throw new ApiError(
        "Temperature is invalid",
        400,
        "Некорректная температура.",
      );
    }
  }

  if (kind === "GROWTH") {
    const weightKg = payloadNumber(payload, "weightKg");
    const heightCm = payloadNumber(payload, "heightCm");
    if (
      (weightKg !== null && (weightKg <= 0 || weightKg > 30)) ||
      (heightCm !== null && (heightCm <= 0 || heightCm > 120)) ||
      (weightKg === null && heightCm === null)
    ) {
      throw new ApiError(
        "Growth payload is invalid",
        400,
        "Укажите корректный вес или рост.",
      );
    }
  }
}

function validateOccurredAt(value: unknown): asserts value is string {
  if (typeof value !== "string") {
    throw new ApiError(
      "Event occurredAt must be a string",
      400,
      "Некорректное время события.",
    );
  }

  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) {
    throw new ApiError(
      "Event occurredAt is invalid",
      400,
      "Некорректное время события.",
    );
  }

  if (timestamp > Date.now() + 5 * 60_000) {
    throw new ApiError(
      "Event occurredAt is too far in the future",
      400,
      "Время события не может быть в будущем.",
    );
  }
}

export function validateEventDraft(value: unknown): EventDraft {
  if (!isRecord(value)) {
    throw new ApiError(
      "Event draft must be an object",
      400,
      "Некорректные данные события.",
    );
  }

  if (value.actor !== "mom" && value.actor !== "dad") {
    throw new ApiError("Event actor is invalid", 400, "Некорректный родитель.");
  }

  if (typeof value.kind !== "string" || !EVENT_KINDS.has(value.kind)) {
    throw new ApiError(
      "Event kind is invalid",
      400,
      "Некорректный тип события.",
    );
  }

  if (
    typeof value.summary !== "string" ||
    value.summary.trim().length === 0 ||
    value.summary.length > MAX_SUMMARY_LENGTH
  ) {
    throw new ApiError(
      "Event summary is invalid",
      400,
      "Некорректное описание события.",
    );
  }

  if (
    value.status !== undefined &&
    (typeof value.status !== "string" || !STATUSES.has(value.status))
  ) {
    throw new ApiError(
      "Event status is invalid",
      400,
      "Некорректный статус события.",
    );
  }

  if (
    value.clientRequestId !== undefined &&
    (typeof value.clientRequestId !== "string" ||
      value.clientRequestId.trim().length === 0 ||
      value.clientRequestId.length > MAX_CLIENT_REQUEST_ID_LENGTH)
  ) {
    throw new ApiError(
      "Event clientRequestId is invalid",
      400,
      "Некорректный ключ синхронизации.",
    );
  }

  const expectedRevision = value.expectedRevision;
  if (
    expectedRevision !== undefined &&
    (typeof expectedRevision !== "number" ||
      !Number.isInteger(expectedRevision) ||
      expectedRevision < 1)
  ) {
    throw new ApiError(
      "Event expectedRevision is invalid",
      400,
      "Некорректная версия записи.",
    );
  }

  validateOccurredAt(value.occurredAt);
  validatePayload(value.payload);
  validateSemanticPayload(value.kind, value.payload);

  return {
    kind: value.kind as EventDraft["kind"],
    actor: value.actor,
    occurredAt: value.occurredAt,
    summary: value.summary.trim(),
    payload: value.payload,
    status: value.status as EventDraft["status"],
    clientRequestId: value.clientRequestId?.trim(),
    expectedRevision,
  };
}
