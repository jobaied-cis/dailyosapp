import { createFileRoute } from "@tanstack/react-router";
import { generateText } from "ai";

/**
 * /api/ai — context-aware AI assistant endpoint.
 *
 * Body: { prompt: string }  (prompt is already personalized on the client)
 * Reply: { reply: string }
 *
 * Uses Lovable AI Gateway (LOVABLE_API_KEY) — no external key required.
 */
export const Route = createFileRoute("/api/ai")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as { prompt?: unknown };
          const prompt =
            typeof body?.prompt === "string" ? body.prompt.trim() : "";
          if (!prompt) {
            return Response.json({ error: "Missing prompt" }, { status: 400 });
          }
          // Hard cap to keep request small.
          const safePrompt = prompt.slice(0, 4000);

          const key = process.env.LOVABLE_API_KEY;
          if (!key) {
            return Response.json(
              { error: "AI is not available right now" },
              { status: 503 },
            );
          }

          const { createLovableAiGatewayProvider } = await import(
            "@/lib/ai-gateway.server"
          );
          const gateway = createLovableAiGatewayProvider(key);

          const { text } = await generateText({
            model: gateway("google/gemini-3-flash-preview"),
            system:
              "You are DailyOS, a friendly productivity assistant. Reply in 2–3 short lines, personalized and actionable. No fluff.",
            prompt: safePrompt,
          });

          return Response.json({ reply: (text ?? "").trim() });
        } catch (err) {
          console.error("/api/ai error", err);
          return Response.json(
            { error: "AI is not available right now" },
            { status: 500 },
          );
        }
      },
    },
  },
});
