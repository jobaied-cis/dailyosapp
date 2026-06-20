import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { addMission, addTask, uniqueMissionTitle } from "@/lib/missions-store";
import {
  generatePlan,
  type Difficulty,
  type PlannedDay,
} from "@/lib/ai-mission-planner";
import {
  ChevronDown,
  ChevronUp,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  RefreshCw,
  ArrowLeft,
  Check,
} from "lucide-react";

const MAX_REGEN = 3;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AIMissionPlannerSheet({ open, onOpenChange }: Props) {
  const [step, setStep] = useState<"input" | "preview">("input");
  const [goal, setGoal] = useState("");
  const [days, setDays] = useState(7);
  const [difficulty, setDifficulty] = useState<Difficulty>("Beginner");
  const [priority, setPriority] = useState(2);
  const [plan, setPlan] = useState<PlannedDay[]>([]);
  const [regenCount, setRegenCount] = useState(0);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [editingTitle, setEditingTitle] = useState<number | null>(null);
  const [editingTask, setEditingTask] = useState<{ d: number; i: number } | null>(null);
  const [draft, setDraft] = useState("");
  const [addingFor, setAddingFor] = useState<number | null>(null);
  const [newTask, setNewTask] = useState("");
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const reset = () => {
    setStep("input");
    setGoal("");
    setDays(7);
    setDifficulty("Beginner");
    setPriority(2);
    setPlan([]);
    setRegenCount(0);
    setExpanded({});
    setEditingTitle(null);
    setEditingTask(null);
    setDraft("");
    setAddingFor(null);
    setNewTask("");
    setConfirmDiscard(false);
  };

  const handleClose = (next: boolean) => {
    if (!next && step === "preview" && plan.length > 0) {
      setConfirmDiscard(true);
      return;
    }
    if (!next) reset();
    onOpenChange(next);
  };

  const handleGenerate = (e?: FormEvent) => {
    e?.preventDefault();
    const g = goal.trim();
    const d = Math.max(1, Math.min(60, Math.floor(days) || 1));
    if (!g || d < 1) return;
    const result = generatePlan({ goal: g, days: d, difficulty });
    setPlan(result.days);
    setExpanded({ 1: true });
    setRegenCount(0);
    setStep("preview");
  };

  const handleRegenerate = () => {
    if (regenCount >= MAX_REGEN) return;
    const result = generatePlan({ goal: goal.trim(), days, difficulty });
    setPlan(result.days);
    setRegenCount((c) => c + 1);
  };

  const handleConfirm = () => {
    const g = goal.trim();
    if (!g || plan.length === 0) return;
    const finalTitle = uniqueMissionTitle(g);
    const id = addMission(finalTitle, priority, days);
    for (const d of plan) {
      for (const t of d.tasks) {
        const title = t.trim();
        if (title) addTask(id, title, d.day);
      }
    }
    toast.success(finalTitle !== g ? `Mission created as "${finalTitle}"` : "Mission created");
    reset();
    onOpenChange(false);
  };


  const updateDayTitle = (day: number, title: string) => {
    setPlan((p) => p.map((d) => (d.day === day ? { ...d, title } : d)));
  };
  const updateTask = (day: number, idx: number, value: string) => {
    setPlan((p) =>
      p.map((d) =>
        d.day === day
          ? { ...d, tasks: d.tasks.map((t, i) => (i === idx ? value : t)) }
          : d,
      ),
    );
  };
  const deleteTaskAt = (day: number, idx: number) => {
    setPlan((p) =>
      p.map((d) =>
        d.day === day ? { ...d, tasks: d.tasks.filter((_, i) => i !== idx) } : d,
      ),
    );
  };
  const addTaskTo = (day: number, value: string) => {
    const v = value.trim();
    if (!v) return;
    setPlan((p) =>
      p.map((d) => {
        if (d.day !== day) return d;
        if (d.tasks.length >= 3) return d;
        return { ...d, tasks: [...d.tasks, v] };
      }),
    );
  };

  const canGenerate = goal.trim().length > 0 && days >= 1;

  return (
    <>
      <Sheet open={open} onOpenChange={handleClose}>
        <SheetContent
          side="bottom"
          className="h-[92vh] w-full max-w-full sm:max-w-2xl mx-auto rounded-t-2xl p-0 flex flex-col"
        >
          <SheetHeader className="px-5 pt-5 pb-3 border-b border-border/60 text-left">
            <SheetTitle className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              {step === "input" ? "Plan with AI" : "Preview plan"}
            </SheetTitle>
            <SheetDescription>
              {step === "input"
                ? "Describe your goal — we'll suggest a day-by-day plan."
                : "Generated based on your goal and duration. Edit anything, then create."}
            </SheetDescription>
          </SheetHeader>

          {step === "input" ? (
            <form
              onSubmit={handleGenerate}
              className="flex-1 overflow-y-auto px-5 py-5 space-y-4"
            >
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Goal
                </label>
                <input
                  autoFocus
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  placeholder="e.g. Learn Python in 7 days"
                  className="w-full bg-secondary rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/30 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Days
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={days}
                    onChange={(e) =>
                      setDays(Math.max(1, Math.min(60, Number(e.target.value) || 1)))
                    }
                    className="w-full bg-secondary rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/30 text-sm tabular-nums"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Priority
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(Number(e.target.value))}
                    className="w-full bg-secondary rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/30 text-sm"
                  >
                    <option value={1}>High</option>
                    <option value={2}>Medium</option>
                    <option value={3}>Low</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Difficulty
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(["Beginner", "Intermediate"] as Difficulty[]).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDifficulty(d)}
                      className={
                        "press-spring rounded-lg px-3 py-2.5 text-sm font-medium border transition " +
                        (difficulty === d
                          ? "bg-primary/10 border-primary/40 text-primary"
                          : "bg-secondary border-transparent text-foreground")
                      }
                    >
                      {d}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Beginner = 2 tasks/day · Intermediate = 3 tasks/day
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={!canGenerate}
                  className="press-spring w-full inline-flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold text-white shadow-[0_8px_20px_-8px_rgba(55,138,221,0.6)] disabled:opacity-50"
                  style={{
                    background:
                      "linear-gradient(135deg, #378ADD 0%, #5B9EE8 100%)",
                  }}
                >
                  <Sparkles className="w-4 h-4" />
                  Generate plan
                </button>
              </div>
            </form>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                <p className="text-xs text-muted-foreground">
                  Generated based on your goal and duration.
                </p>

                {plan.map((d) => {
                  const isOpen = expanded[d.day] ?? false;
                  return (
                    <div
                      key={d.day}
                      className="bg-card border border-border/60 rounded-xl overflow-hidden animate-fade-in"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setExpanded((e) => ({ ...e, [d.day]: !isOpen }))
                        }
                        className="w-full flex items-center gap-3 px-4 py-3 text-left"
                      >
                        <span className="inline-flex items-center justify-center size-7 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                          {d.day}
                        </span>
                        {editingTitle === d.day ? (
                          <input
                            autoFocus
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            onBlur={() => {
                              const v = draft.trim();
                              if (v) updateDayTitle(d.day, v);
                              setEditingTitle(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                const v = draft.trim();
                                if (v) updateDayTitle(d.day, v);
                                setEditingTitle(null);
                              }
                              if (e.key === "Escape") setEditingTitle(null);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="flex-1 bg-secondary rounded-md px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                          />
                        ) : (
                          <span className="flex-1 text-sm font-semibold text-foreground truncate">
                            {d.title}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {d.tasks.length}/3
                        </span>
                        <span
                          role="button"
                          tabIndex={-1}
                          onClick={(e) => {
                            e.stopPropagation();
                            setDraft(d.title);
                            setEditingTitle(d.day);
                          }}
                          className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition"
                          aria-label="Rename day"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </span>
                        {isOpen ? (
                          <ChevronUp className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        )}
                      </button>

                      {isOpen && (
                        <div className="px-4 pb-3 space-y-1.5">
                          {d.tasks.map((t, i) => {
                            const isEditing =
                              editingTask?.d === d.day && editingTask.i === i;
                            return (
                              <div
                                key={i}
                                className="flex items-center gap-2 bg-secondary/60 rounded-md px-2 py-1.5"
                              >
                                {isEditing ? (
                                  <input
                                    autoFocus
                                    value={draft}
                                    onChange={(e) => setDraft(e.target.value)}
                                    onBlur={() => {
                                      const v = draft.trim();
                                      if (v) updateTask(d.day, i, v);
                                      setEditingTask(null);
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        const v = draft.trim();
                                        if (v) updateTask(d.day, i, v);
                                        setEditingTask(null);
                                      }
                                      if (e.key === "Escape") setEditingTask(null);
                                    }}
                                    className="flex-1 bg-background rounded px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                                  />
                                ) : (
                                  <span className="flex-1 text-sm text-foreground">
                                    {t}
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDraft(t);
                                    setEditingTask({ d: d.day, i });
                                  }}
                                  className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
                                  aria-label="Edit task"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteTaskAt(d.day, i)}
                                  className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                                  aria-label="Delete task"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            );
                          })}

                          {d.tasks.length < 3 &&
                            (addingFor === d.day ? (
                              <div className="flex items-center gap-2">
                                <input
                                  autoFocus
                                  value={newTask}
                                  onChange={(e) => setNewTask(e.target.value)}
                                  placeholder="Add a task…"
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      addTaskTo(d.day, newTask);
                                      setNewTask("");
                                      setAddingFor(null);
                                    }
                                    if (e.key === "Escape") {
                                      setNewTask("");
                                      setAddingFor(null);
                                    }
                                  }}
                                  onBlur={() => {
                                    if (newTask.trim()) addTaskTo(d.day, newTask);
                                    setNewTask("");
                                    setAddingFor(null);
                                  }}
                                  className="flex-1 bg-background rounded px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                                />
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setAddingFor(d.day)}
                                className="press-spring inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                Add task
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="border-t border-border/60 px-5 py-3 space-y-2 bg-background">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    Regenerate {regenCount}/{MAX_REGEN}
                  </span>
                  {regenCount >= MAX_REGEN && (
                    <span className="text-amber-500 font-medium">
                      Limit reached, edit manually
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setStep("input")}
                    className="press-spring inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-medium bg-secondary text-foreground"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleRegenerate}
                    disabled={regenCount >= MAX_REGEN}
                    className="press-spring inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-medium bg-secondary text-foreground disabled:opacity-50"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Regenerate
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirm}
                    className="press-spring flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_-8px_rgba(55,138,221,0.6)]"
                    style={{
                      background:
                        "linear-gradient(135deg, #378ADD 0%, #5B9EE8 100%)",
                    }}
                  >
                    <Check className="w-4 h-4" />
                    Create mission
                  </button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {confirmDiscard && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-background border border-border rounded-xl p-6 max-w-sm w-full space-y-4">
            <h3 className="font-semibold text-foreground">Discard this plan?</h3>
            <p className="text-sm text-muted-foreground">
              Your generated plan will be lost. The mission will not be created.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmDiscard(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-accent transition"
              >
                Keep editing
              </button>
              <button
                onClick={() => {
                  setConfirmDiscard(false);
                  reset();
                  onOpenChange(false);
                }}
                className="press px-4 py-2 rounded-lg text-sm font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
