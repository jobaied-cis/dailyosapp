import { useMemo, useState } from "react";
import { Bot, Send, X, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { useTasks } from "@/lib/tasks-store";
import { useEvents } from "@/lib/events-store";
import { useMissions, missionProgress, isMissionEnded } from "@/lib/missions-store";
import { useExpenses, getDailyLimit } from "@/lib/expenses-store";
import { useTakaSymbol } from "@/lib/currency";
import { buildAIPrompt, hasAnyContext, type AIContext } from "@/lib/ai-context";

function startOfDay(ts: number) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function AIAssistantSheet({ onClose }: { onClose: () => void }) {
  const { userProfile } = useAuth();
  const tasks = useTasks();
  const events = useEvents();
  const missions = useMissions();
  const expenses = useExpenses();
  const sym = useTakaSymbol();

  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [reply, setReply] = useState<string | null>(null);

  const context: AIContext = useMemo(() => {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const todaysEvents = events
      .filter((e) => e.date === todayStr)
      .slice(0, 4)
      .map((e) => `${e.title} ${e.time}`);

    const activeMission = [...missions]
      .sort((a, b) => a.priority - b.priority)
      .find((m) => !isMissionEnded(m) && missionProgress(m).pct < 100);

    const tStart = startOfDay(Date.now());
    const tEnd = tStart + 86400000;
    const todayExpense = expenses
      .filter((e) => e.type === "expense" && e.createdAt >= tStart && e.createdAt < tEnd)
      .reduce((s, e) => s + e.amount, 0);

    return {
      name: userProfile?.name,
      priorities: userProfile?.priorities,
      pendingTasks: tasks.filter((t) => !t.completed).length,
      completedTasks: tasks.filter((t) => t.completed).length,
      todaysEvents,
      missionTitle: activeMission?.title,
      missionProgressPct: activeMission ? missionProgress(activeMission).pct : undefined,
      todayExpense,
      dailyLimit: getDailyLimit(),
      currencySymbol: sym,
    };
  }, [userProfile, tasks, events, missions, expenses, sym]);

  const handleAsk = async () => {
    const text = prompt.trim();
    if (!text) {
      toast.error("Type your question first");
      return;
    }
    if (!hasAnyContext(context)) {
      setReply("Start adding tasks and events to get personalized insights 🚀");
      return;
    }
    setLoading(true);
    setReply(null);
    try {
      const fullPrompt = buildAIPrompt(context, text);
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: fullPrompt }),
      });
      if (!res.ok) throw new Error("AI request failed");
      const data = (await res.json()) as { reply?: string };
      setReply(data.reply?.trim() || "AI is not available right now");
    } catch (err) {
      console.error(err);
      setReply("AI is not available right now");
    } finally {
      setLoading(false);
    }
  };

  const suggestions = [
    "What should I focus on now?",
    "Plan my next 2 hours",
    "How is my spending today?",
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 animate-fade-in" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-card rounded-t-3xl border-t border-border shadow-2xl p-5 space-y-4 animate-slide-up"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="size-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white">
              <Bot className="size-4" />
            </div>
            <div>
              <h2 className="text-[15px] font-bold leading-tight">AI Assistant</h2>
              <p className="text-[11px] text-muted-foreground leading-tight flex items-center gap-1">
                <Sparkles className="size-3 text-primary" />
                AI powered by your data 🤖
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="size-8 inline-flex items-center justify-center rounded-full hover:bg-secondary/60"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setPrompt(s)}
              className="text-[11px] px-2.5 py-1 rounded-full border border-border bg-background hover:bg-secondary/60 text-foreground"
            >
              {s}
            </button>
          ))}
        </div>

        <div className="flex items-end gap-2">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ask anything about your day…"
            rows={2}
            className="flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <button
            onClick={handleAsk}
            disabled={loading}
            className="size-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-50 active:scale-95 transition-all"
            aria-label="Send"
          >
            <Send className="size-4" />
          </button>
        </div>

        {loading && (
          <div className="rounded-xl border border-border/60 bg-background/60 p-3 text-[13px] text-muted-foreground animate-pulse">
            Thinking…
          </div>
        )}
        {reply && !loading && (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-[13px] text-foreground leading-[1.5] whitespace-pre-wrap animate-fade-in">
            {reply}
          </div>
        )}
      </div>
    </div>
  );
}
