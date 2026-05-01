import { Prisma } from "@prisma/client";

const TRANSIENT_PRISMA_CODES = new Set([
  "P1001",
  "P1002",
  "P1008",
  "P1017",
  "P2024",
  "P2034",
]);

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isTransientDbError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return TRANSIENT_PRISMA_CODES.has(error.code);
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return true;
  }

  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return (
    message.includes("connection") ||
    message.includes("timeout") ||
    message.includes("temporarily unavailable")
  );
}

export async function withDbRetry<T>(
  operation: () => Promise<T>,
  options: {
    attempts?: number;
    baseDelayMs?: number;
    onRetry?: (error: unknown, attempt: number) => void;
  } = {},
) {
  const attempts = options.attempts ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 150;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (!isTransientDbError(error) || attempt === attempts) {
        throw error;
      }

      options.onRetry?.(error, attempt);
      const jitter = Math.floor(Math.random() * baseDelayMs);
      await delay(baseDelayMs * 2 ** (attempt - 1) + jitter);
    }
  }

  throw lastError;
}
