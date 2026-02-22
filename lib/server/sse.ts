// SSE (Server-Sent Events) helpers for streaming endpoints

const KEEPALIVE_INTERVAL_MS = 15_000;
const ENCODER = new TextEncoder();

type SSESubscribeFn = (send: SSESend, lastEventId: string | null) => (() => void);

export type SSESend = {
  /** Send a named SSE event with auto-incrementing ID */
  event: (name: string, data: unknown) => void;
  /** Send an SSE comment (keepalive) */
  comment: (text: string) => void;
};

let globalSeq = 0;

/**
 * Create an SSE response with automatic keepalive, event IDs, and cleanup.
 *
 * Supports `Last-Event-ID` header for reconnection resilience.
 *
 * Usage:
 * ```ts
 * return createSSEStream(request, (send, lastEventId) => {
 *   const unsub = bus.on("chat", (payload) => {
 *     send.event("chat", payload);
 *   });
 *   return unsub; // cleanup function
 * });
 * ```
 */
export function createSSEStream(
  request: Request,
  subscribe: SSESubscribeFn,
): Response {
  // Read Last-Event-ID for reconnection support
  const lastEventId = request.headers.get("Last-Event-ID");

  const stream = new ReadableStream({
    start(controller) {
      const send: SSESend = {
        event(name, data) {
          try {
            const id = ++globalSeq;
            const payload = `id: ${id}\nevent: ${name}\ndata: ${JSON.stringify(data)}\n\n`;
            controller.enqueue(ENCODER.encode(payload));
          } catch {
            // Controller may be closed
          }
        },
        comment(text) {
          try {
            controller.enqueue(ENCODER.encode(`: ${text}\n\n`));
          } catch {
            // Controller may be closed
          }
        },
      };

      // Send initial comment with retry hint
      send.comment("connected");
      try {
        controller.enqueue(ENCODER.encode("retry: 3000\n\n"));
      } catch {
        // Controller may be closed
      }

      // Subscribe to events (pass lastEventId for replay)
      const cleanup = subscribe(send, lastEventId);

      // Keepalive timer
      const keepalive = setInterval(() => {
        send.comment("keepalive");
      }, KEEPALIVE_INTERVAL_MS);

      // Cleanup on client disconnect
      request.signal.addEventListener("abort", () => {
        clearInterval(keepalive);
        cleanup();
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Content-Encoding": "none",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
