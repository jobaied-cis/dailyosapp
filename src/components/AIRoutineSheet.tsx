import { useState } from "react";
import { Sparkles, X, Check, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { addTask, useTasks } from "@/lib/tasks-store";
import { generateRoutine } from "@/lib/ai-routine.functions";

const QUICK_CHIPS = [
  "Plan my study day",
  "Light day",
  "Exam prep",
  "Morning routine",
];

type Suggestion = {
  time: string;
  endTime: string;
  title: string;
  note?: string;
};

export function AIRoutineSheet({ onClose }: { onClose: () => void }) {
  const existing = useTasks();
  const [prompt, setPrompt] = useState("");
  const [phase, setPhase] = useState<"input" | "loading" | "result">("input");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const handleGenerate = async () => {
    const text = prompt.trim();
    if (!text) {
      toast.error("Describe your day first");
      return;
    }
    setPhase("loading");
    try {
      const result = await generateRoutine({
        data: {
          prompt: text,
          existingTasks: existing.map((t) => ({
            time: t.time,
            endTime: t.endTime,
            title: t.title,
          })),
        },
      });
      if (!result.tasks.length) {
        toast.error("AI returned no tasks — try rephrasing");
        setPhase("input");
        return;
      }
      setSuggestions(result.tasks);
      setSelected(new Set(result.tasks.map((_, i) => i)));
      setPhase("result");
    } catch (err) {
      console.error(err);
      toast.error("AI not available");
      setPhase("input");
    }
  };

  const handleChip = (text: string) => {
    setPrompt((p) => (p ? `${p} · ${text}` : text));
  };

  const toggleRow = (idx: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const handleAdd = () => {
    let added = 0;
    suggestions.forEach((s, i) => {
      if (selected.has(i) && s.title.trim()) {
        addTask({ time: s.time, endTime: s.endTime, title: s.title, note: s.note });
        added++;
      }
    });
    if (added > 0) toast.success(`Added ${added} task${added > 1 ? "s" : ""} to your routine`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/25 backdrop-blur-md">
      <div className="w-full max-w-md bg-card rounded-t-[1.75rem] p-6 shadow-[0_-8px_40px_-8px_rgba(15,23,42,0.15)] animate-in slide-in-from-bottom duration-300 max-h-[88vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between mb-4 shrink-0">
          <div className="flex items-start gap-3">
            <div className="size-9 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/20 flex items-center justify-center shrink-0">
              <Sparkles className="size-4 text-primary" strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground tracking-tight leading-tight">
                AI Routine Assistant
              </h3>
              <p className="text-[13px] text-muted-foreground mt-0.5 leading-snug">
                Describe your day. I&apos;ll draft a routine.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="press text-muted-foreground hover:text-foreground p-1.5 rounded-full hover:bg-secondary transition-colors shrink-0"
          >
            <X className="size-5" />
          </button>
        </div>

        {phase !== "result" ? (
          <div className="space-y-4 overflow-y-auto">
            {/* Quick chips */}
            <div className="flex flex-wrap gap-2">
              {QUICK_CHIPS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => handleChip(c)}
                  className="press text-xs font-medium px-3 py-1.5 rounded-full bg-secondary hover:bg-secondary/70 text-foreground/80 border border-border/60 transition-colors"
                >
                  {c}
                </button>
              ))}
            </div>

            {/* Textarea */}
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              placeholder="I have 2 classes at 10 and 2, want to study 3h and hit the gym in the evening…"
              className="w-full bg-secondary rounded-2xl px-4 py-3.5 text-foreground text-[15px] outline-none focus:ring-2 focus:ring-primary/40 focus:bg-card focus:shadow-[0_0_0_4px_rgba(37,99,235,0.08)] transition-all resize-none placeholder:text-muted-foreground/70 leading-relaxed"
            />

            {/* Generate button */}
            <button
              onClick={handleGenerate}
              disabled={phase === "loading"}
              className="press w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-primary to-primary/85 text-primary-foreground font-semibold py-3.5 rounded-2xl text-[15px] shadow-[0_8px_24px_-8px_rgba(37,99,235,0.5)] hover:shadow-[0_12px_28px_-8px_rgba(37,99,235,0.6)] disabled:opacity-70 disabled:cursor-wait transition-all"
            >
              <Sparkles className="size-4" strokeWidth={2.5} />
              {phase === "loading" ? "Thinking…" : "Generate routine"}
            </button>

            <p className="text-[11px] text-muted-foreground/70 text-center pt-1">
              AI suggestions are previewed — nothing is added until you confirm.
            </p>
          </div>
        ) : (
          <>
            {/* Preview list */}
            <div className="flex items-center justify-between mb-3 shrink-0">
              <p className="text-[13px] font-semibold text-foreground">
                {selected.size} of {suggestions.length} selected
              </p>
              <button
                onClick={() => setPhase("input")}
                className="press inline-flex items-center gap-1 text-[12px] font-medium text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="size-3.5" /> Try again
              </button>
            </div>
            <ul className="space-y-2 overflow-y-auto flex-1 pr-1">
              {suggestions.map((s, i) => {
                const isSel = selected.has(i);
                return (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => toggleRow(i)}
                      className={`press w-full flex items-start gap-3 text-left p-3 rounded-2xl border transition-all ${
                        isSel
                          ? "border-primary/40 bg-primary/[0.04]"
                          : "border-dashed border-border/70 bg-card opacity-60"
                      }`}
                    >
                      <div
                        className={`mt-0.5 size-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                          isSel
                            ? "bg-primary border-primary text-primary-foreground"
                            : "border-muted-foreground/40 bg-transparent"
                        }`}
                      >
                        {isSel && <Check className="size-3.5" strokeWidth={3} />}
                      </div>
                      <div className="w-16 shrink-0 flex flex-col">
                        <span className="text-[12px] font-mono font-semibold text-foreground/80 leading-tight">
                          {s.time}
                        </span>
                        <span className="text-[10px] font-mono text-muted-foreground/70 leading-tight">
                          {s.endTime}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-semibold text-foreground leading-snug">
                          {s.title}
                        </p>
                        {s.note && (
                          <p className="text-[12px] text-muted-foreground/80 mt-0.5 leading-snug">
                            {s.note}
                          </p>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>

            {/* Actions */}
            <div className="pt-4 mt-2 border-t border-border/50 shrink-0 flex gap-2">
              <button
                onClick={() => setPhase("input")}
                className="press flex-1 py-3 rounded-2xl text-[14px] font-semibold text-foreground bg-secondary hover:bg-secondary/70 transition-colors"
              >
                Try again
              </button>
              <button
                onClick={handleAdd}
                disabled={selected.size === 0}
                className="press flex-[1.5] inline-flex items-center justify-center gap-2 bg-gradient-to-r from-primary to-primary/85 text-primary-foreground font-semibold py-3 rounded-2xl text-[14px] shadow-[0_8px_24px_-8px_rgba(37,99,235,0.5)] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <Sparkles className="size-4" strokeWidth={2.5} />
                Add to routine
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
