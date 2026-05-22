import { runScan, ScanProgressEvent } from "@/lib/agent";

// Allow up to 180s — agentic loop with multiple LLM + search calls
export const maxDuration = 180;

export async function POST(req: Request) {
  let query: string;
  try {
    const body = await req.json();
    query = typeof body?.query === "string" ? body.query.trim() : "";
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!query) {
    return new Response(JSON.stringify({ error: "Query is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();

  const reqSignal = req instanceof Request ? req.signal : undefined;

  const stream = new ReadableStream({
    async start(controller) {
      function emit(event: ScanProgressEvent) {
        if (reqSignal?.aborted) return;
        try {
          const data = `data: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(data));
        } catch {
          // stream already closed
        }
      }

      try {
        await runScan({
          query,
          goal: 5,
          maxIterations: 5,
          onProgress: emit,
          signal: reqSignal,
        });
      } catch (err) {
        if (!reqSignal?.aborted) {
          emit({
            type: "error",
            message: err instanceof Error ? err.message : "Scan failed",
          });
        }
      } finally {
        try { controller.close(); } catch { /* already closed */ }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
