import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const TaskSchema = z.object({
  time: z.string(),
  endTime: z.string(),
  title: z.string(),
  note: z.string().optional(),
});

const RoutineSchema = z.object({
  tasks: z.array(TaskSchema).max(10),
});

const SuggestionSchema = z.object({
  title: z.string(),
  time: z.string(),
  reason: z.string(),
});

const GenerateInput = z.object({
  prompt: z.string().min(1).max(2000),
  existingTasks: z
    .array(
      z.object({
        time: z.string(),
        endTime: z.string().optional(),
        title: z.string(),
      }),
    )
    .optional(),
});

const SuggestInput = z.object({
  now: z.string(), // "HH:MM"
  tasks: z.array(
    z.object({
      time: z.string(),
      endTime: z.string().optional(),
      title: z.string(),
      completed: z.boolean(),
    }),
  ),
});

function sanitizeTask(t: z.infer<typeof TaskSchema>) {
  const title = t.title?.trim();
  if (!title) return null;
  if (!TIME_RE.test(t.time)) return null;
  if (!TIME_RE.test(t.endTime)) return null;
  return {
    time: t.time,
    endTime: t.endTime,
    title: title.slice(0, 120),
    note: t.note?.trim().slice(0, 200) || undefined,
  };
}

export const generateRoutine = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => GenerateInput.parse(data))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI not configured");

    const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
    const gateway = createLovableAiGatewayProvider(key);

    const existing = data.existingTasks?.length
      ? `\n\nExisting tasks (avoid overlapping with these):\n${data.existingTasks
          .map((t) => `- ${t.time}${t.endTime ? `–${t.endTime}` : ""} ${t.title}`)
          .join("\n")}`
      : "";

    const shapeInstruction = `Return ONLY a JSON object in this EXACT shape (no arrays at the root, no extra keys, no prose, no code fences):
{
  "tasks": [
    { "time": "HH:MM", "endTime": "HH:MM", "title": "...", "note": "..." }
  ]
}`;

    const systemPrompt = `Create a clean daily routine based on the user's plan.

Rules:
- Use realistic time blocks (HH:MM 24h format)
- Avoid overlapping tasks
- Include short breaks if needed
- Keep tasks short and practical
- Max 10 tasks
- Each task must have time, endTime, title, optional note

${shapeInstruction}`;

    const userPrompt = `User's plan: ${data.prompt}${existing}`;

    const runOnce = async (system: string) => {
      const { experimental_output } = await generateText({
        model: gateway("google/gemini-3-flash-preview"),
        experimental_output: Output.object({ schema: RoutineSchema }),
        system,
        prompt: userPrompt,
      });
      return experimental_output;
    };

    const isNoObjectError = (err: unknown) => {
      const name = (err as { name?: string })?.name ?? "";
      const msg = (err as { message?: string })?.message ?? "";
      return (
        name === "AI_NoObjectGeneratedError" ||
        name === "NoObjectGeneratedError" ||
        /NoObjectGenerated|did not match schema|response_format/i.test(msg)
      );
    };

    try {
      let output;
      try {
        output = await runOnce(systemPrompt);
      } catch (err) {
        if (!isNoObjectError(err)) throw err;
        console.warn("generateRoutine: schema miss, retrying with stricter shape instruction");
        const stricter = `${systemPrompt}\n\nCRITICAL: Your previous reply was rejected. You MUST wrap the array under the "tasks" key. Do NOT return a bare array. Reply with the object literally starting with {"tasks":[ and ending with ]}.`;
        output = await runOnce(stricter);
      }

      const tasks = (output.tasks || [])
        .map(sanitizeTask)
        .filter((t): t is NonNullable<ReturnType<typeof sanitizeTask>> => t !== null);

      return { tasks };
    } catch (err) {
      console.error("generateRoutine error", err);
      throw new Error("AI request failed");
    }
  });

export const suggestNextTask = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => SuggestInput.parse(data))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI not configured");

    const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
    const gateway = createLovableAiGatewayProvider(key);

    const taskList = data.tasks.length
      ? data.tasks
          .map(
            (t) =>
              `- ${t.time}${t.endTime ? `–${t.endTime}` : ""} ${t.title} ${
                t.completed ? "(done)" : "(pending)"
              }`,
          )
          .join("\n")
      : "(no tasks yet)";

    const systemPrompt = `Based on current time and remaining tasks, suggest the best next action.
Keep it short and practical.
- Pick a task that fits the next free slot
- Suggest a realistic start time (HH:MM)
- Give a one-sentence reason
- Return ONLY structured JSON`;

    try {
      const { experimental_output } = await generateText({
        model: gateway("google/gemini-3-flash-preview"),
        experimental_output: Output.object({ schema: SuggestionSchema }),
        system: systemPrompt,
        prompt: `Current time: ${data.now}\n\nTasks today:\n${taskList}`,
      });

      const title = experimental_output.title?.trim();
      const time = experimental_output.time?.trim();
      const reason = experimental_output.reason?.trim();
      if (!title || !time || !TIME_RE.test(time) || !reason) {
        throw new Error("Empty suggestion");
      }

      return {
        title: title.slice(0, 120),
        time,
        reason: reason.slice(0, 200),
      };
    } catch (err) {
      console.error("suggestNextTask error", err);
      throw new Error("AI request failed");
    }
  });
