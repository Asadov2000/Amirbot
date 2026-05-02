import { getDashboardSyncState } from "@/lib/server/dashboard";
import { safeApiError } from "@/lib/server/api-security";
import { assertRateLimit } from "@/lib/server/rate-limit";
import { resolveRequestActor } from "@/lib/server/telegram-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STREAM_CHECK_INTERVAL_MS = 1_000;
const STREAM_HEARTBEAT_INTERVAL_MS = 15_000;
const STREAM_TTL_MS = 55_000;

const encoder = new TextEncoder();

function encodeServerEvent(event: string, payload: unknown) {
  return encoder.encode(
    `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`,
  );
}

function encodeServerComment(comment: string) {
  return encoder.encode(`: ${comment}\n\n`);
}

export async function GET(request: Request) {
  try {
    const actor = resolveRequestActor(request);
    assertRateLimit(
      `sync:stream:${actor.telegramUserId ?? actor.actor}`,
      40,
      60_000,
    );

    let checkIntervalId: ReturnType<typeof setInterval> | undefined;
    let closeTimeoutId: ReturnType<typeof setTimeout> | undefined;
    let lastHeartbeatAt = 0;
    let lastSyncVersion = "";
    let checking = false;
    let closed = false;

    const closeTimers = () => {
      if (checkIntervalId) {
        clearInterval(checkIntervalId);
      }
      if (closeTimeoutId) {
        clearTimeout(closeTimeoutId);
      }
    };

    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: string, payload: unknown) => {
          if (!closed) {
            controller.enqueue(encodeServerEvent(event, payload));
          }
        };

        const close = () => {
          if (closed) {
            return;
          }

          closed = true;
          closeTimers();
          try {
            controller.close();
          } catch {
            // The browser may already have closed the connection.
          }
        };

        const checkState = async () => {
          if (closed || checking) {
            return;
          }

          checking = true;
          try {
            const state = await getDashboardSyncState();
            if (state.syncVersion !== lastSyncVersion) {
              lastSyncVersion = state.syncVersion;
              send("sync", state);
              return;
            }

            const now = Date.now();
            if (now - lastHeartbeatAt >= STREAM_HEARTBEAT_INTERVAL_MS) {
              lastHeartbeatAt = now;
              controller.enqueue(encodeServerComment(`heartbeat ${now}`));
            }
          } catch {
            send("sync-error", {
              ok: false,
              generatedAt: new Date().toISOString(),
            });
          } finally {
            checking = false;
          }
        };

        request.signal.addEventListener("abort", close);

        await checkState();
        checkIntervalId = setInterval(
          () => void checkState(),
          STREAM_CHECK_INTERVAL_MS,
        );
        closeTimeoutId = setTimeout(() => {
          send("stream-close", {
            ok: true,
            generatedAt: new Date().toISOString(),
          });
          close();
        }, STREAM_TTL_MS);
      },
      cancel() {
        closed = true;
        closeTimers();
      },
    });

    return new Response(stream, {
      headers: {
        "Cache-Control": "no-store, no-transform",
        Connection: "keep-alive",
        "Content-Type": "text/event-stream; charset=utf-8",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    return safeApiError(error, "Не удалось открыть синхронизацию.");
  }
}
