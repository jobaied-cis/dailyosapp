import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  useExpenses,
  addExpense,
  addIncome,
  updateExpense,
  deleteExpense,
  getDailyLimit,
  setDailyLimit,
  type Expense,
  type ExpenseCategory,
} from "@/lib/expenses-store";
import { useTakaSymbol, formatTaka } from "@/lib/currency";
import { CurrencyTrigger } from "@/components/CurrencySheet";
import { Plus, Trash2, Wallet, X, Pencil, ArrowDownCircle, ArrowUpCircle, ChevronDown, ChevronLeft, ChevronRight, History as HistoryIcon, ArrowLeft, AlertTriangle, Settings2, Lightbulb, TrendingUp, TrendingDown, Sparkles, Shield, Target as TargetIcon, PiggyBank, Repeat, CalendarRange } from "lucide-react";
import { SwipeableRow } from "@/components/SwipeableRow";

function dayKey(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function monthKey(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function formatMonthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}
function shiftMonth(key: string, delta: number) {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function formatDayLabel(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date();
  const yest = new Date();
  yest.setDate(today.getDate() - 1);
  if (dayKey(today.getTime()) === key) return "Today";
  if (dayKey(yest.getTime()) === key) return "Yesterday";
  return date.toLocaleDateString(undefined, { month: "long", day: "numeric" });
}

const CATEGORY_EMOJI: Record<ExpenseCategory, string> = {
  Food: "🍚",
  Transport: "🚌",
  Study: "📚",
  Others: "📦",
};

const CATEGORY_COLOR: Record<ExpenseCategory, string> = {
  Food: "#22C55E",
  Transport: "#3B82F6",
  Study: "#F59E0B",
  Others: "#6B7280",
};

const CATEGORIES: ExpenseCategory[] = ["Food", "Transport", "Study", "Others"];

type FilterScope = "month" | "today" | "week";
type Filter = { scope: FilterScope; category: ExpenseCategory | null };

function getLimitTone(pct: number) {
  if (pct < 80) {
    return {
      barClass: "bg-primary",
      textClass: "text-primary",
      chipClass: "bg-primary/10 text-primary",
      cardClass: "border-border/60",
      dot: "🟢",
    };
  }
  if (pct <= 100) {
    return {
      barClass: "bg-amber-500",
      textClass: "text-amber-600",
      chipClass: "bg-amber-500/15 text-amber-700",
      cardClass: "border-amber-500/30",
      dot: "🟡",
    };
  }
  return {
    barClass: "bg-red-500/80",
    textClass: "text-red-600",
    chipClass: "bg-red-500/15 text-red-600",
    cardClass: "border-red-500/30",
    dot: "🔴",
  };
}

function startOfWeekMonday() {
  const now = new Date();
  const dayIdx = (now.getDay() + 6) % 7;
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayIdx);
  return d.getTime();
}

function getNoSpendStreak(entries: Expense[]): number {
  const monday = startOfWeekMonday();
  const today = new Date();
  const daysSoFar = Math.floor((today.getTime() - monday) / 86400000) + 1;
  let count = 0;
  for (let i = 0; i < daysSoFar; i++) {
    const d = new Date(monday + i * 86400000);
    const k = dayKey(d.getTime());
    const total = entries
      .filter((e) => e.type === "expense" && dayKey(e.createdAt) === k)
      .reduce((s, e) => s + e.amount, 0);
    if (total === 0) count++;
  }
  return count;
}

function getTopWeekday(entries: Expense[]): { name: string; total: number } | null {
  const totals = [0, 0, 0, 0, 0, 0, 0];
  for (const e of entries) {
    if (e.type !== "expense") continue;
    totals[new Date(e.createdAt).getDay()] += e.amount;
  }
  let maxIdx = -1;
  let max = 0;
  totals.forEach((v, i) => {
    if (v > max) {
      max = v;
      maxIdx = i;
    }
  });
  if (maxIdx < 0) return null;
  const fullNames = ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"];
  return { name: fullNames[maxIdx], total: max };
}

function getRecurringGroup(
  entries: Expense[],
): { title: string; amount: number; count: number; category: ExpenseCategory } | null {
  const last30 = Date.now() - 30 * 86400000;
  const recent = entries.filter((e) => e.type === "expense" && e.createdAt >= last30);
  type G = { title: string; amount: number; category: ExpenseCategory; dates: Set<string> };
  const groups: G[] = [];
  for (const e of recent) {
    const placed = groups.find(
      (g) => g.category === e.category && Math.abs(e.amount - g.amount) / g.amount <= 0.1,
    );
    if (placed) {
      placed.dates.add(dayKey(e.createdAt));
      const n = placed.dates.size;
      placed.amount = (placed.amount * (n - 1) + e.amount) / n;
      if (e.title.trim()) placed.title = e.title;
    } else {
      groups.push({
        title: e.title || e.category,
        amount: e.amount,
        category: e.category,
        dates: new Set([dayKey(e.createdAt)]),
      });
    }
  }
  const best = groups
    .filter((g) => g.dates.size >= 3)
    .sort((a, b) => b.dates.size - a.dates.size)[0];
  if (!best) return null;
  return {
    title: best.title,
    amount: Math.round(best.amount),
    count: best.dates.size,
    category: best.category,
  };
}

function getProjection(
  entries: Expense[],
  selectedMonth: string,
): { projected: number; daysPassed: number; totalDays: number; spent: number } | null {
  const [y, m] = selectedMonth.split("-").map(Number);
  const totalDays = new Date(y, m, 0).getDate();
  const now = new Date();
  const isCurrent = monthKey(now.getTime()) === selectedMonth;
  const daysPassed = isCurrent ? now.getDate() : totalDays;
  const spent = entries
    .filter((e) => e.type === "expense" && monthKey(e.createdAt) === selectedMonth)
    .reduce((s, e) => s + e.amount, 0);
  if (daysPassed < 3) return null;
  const projected = Math.round((spent / daysPassed) * totalDays);
  return { projected, daysPassed, totalDays, spent };
}


export const Route = createFileRoute("/expenses")({
  head: () => ({
    meta: [
      { title: "Expenses — DailyOS" },
      { name: "description", content: "Track your income, expenses and balance." },
    ],
  }),
  component: ExpensesPage,
});

function ExpensesPage() {
  const entries = useExpenses();
  const taka = useTakaSymbol();
  const [openExpense, setOpenExpense] = useState(false);
  const [openIncome, setOpenIncome] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [detail, setDetail] = useState<Expense | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Expense | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => monthKey(Date.now()));
  const [showHistory, setShowHistory] = useState(false);
  const [dailyLimit, setDailyLimitState] = useState<number>(() => getDailyLimit());
  const [editingLimit, setEditingLimit] = useState(false);
  const [filter, setFilter] = useState<Filter>({ scope: "month", category: null });

  const requestDelete = (e: Expense) => {
    setDetail(null);
    setPendingDelete(e);
  };
  const confirmDelete = () => {
    const snap = pendingDelete;
    if (!snap) return;
    setPendingDelete(null);
    deleteExpense(snap.id);
    toast("Entry deleted", {
      action: {
        label: "Undo",
        onClick: () =>
          snap.type === "income"
            ? addIncome({ amount: snap.amount, title: snap.title })
            : addExpense({
                title: snap.title,
                amount: snap.amount,
                type: "expense",
                category: snap.category,
              }),
      },
    });
  };


  // Today's expense calculation (all entries, not just selected month)
  const todayKeyStr = dayKey(Date.now());
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayKeyStr = dayKey(yesterdayDate.getTime());
  const todayExpense = entries
    .filter((e) => e.type === "expense" && dayKey(e.createdAt) === todayKeyStr)
    .reduce((s, e) => s + e.amount, 0);
  const limitPct = dailyLimit > 0 ? (todayExpense / dailyLimit) * 100 : 0;
  const limitTone = getLimitTone(limitPct);
  const remaining = dailyLimit > 0 ? dailyLimit - todayExpense : 0;
  const displayPercent = dailyLimit > 0 ? Math.round(limitPct) : 0;
  const limitExceeded = dailyLimit > 0 && todayExpense > dailyLimit;

  // Available months (always include current month even if empty)
  const availableMonths = (() => {
    const set = new Set<string>();
    set.add(monthKey(Date.now()));
    for (const e of entries) set.add(monthKey(e.createdAt));
    return Array.from(set).sort((a, b) => (a < b ? 1 : -1));
  })();

  const monthEntries = entries.filter((e) => monthKey(e.createdAt) === selectedMonth);

  // Filtered entries (category + scope applied to month entries)
  const weekStart = startOfWeekMonday();
  const filteredMonthEntries = monthEntries.filter((e) => {
    if (filter.category && e.category !== filter.category) return false;
    if (filter.scope === "today" && dayKey(e.createdAt) !== todayKeyStr) return false;
    if (filter.scope === "week" && e.createdAt < weekStart) return false;
    return true;
  });

  const totalIncome = monthEntries
    .filter((e) => e.type === "income")
    .reduce((s, e) => s + e.amount, 0);
  const totalExpense = monthEntries
    .filter((e) => e.type === "expense")
    .reduce((s, e) => s + e.amount, 0);
  const balance = totalIncome - totalExpense;

  const currentIdx = availableMonths.indexOf(selectedMonth);
  const canPrev = currentIdx < availableMonths.length - 1;
  const canNext = currentIdx > 0;

  // Scroll helpers
  const scrollToId = (id: string) => {
    if (typeof document === "undefined") return;
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };




  return (
    <>
    {showHistory ? (
      <MonthHistory
        entries={entries}
        currentMonth={monthKey(Date.now())}
        selectedMonth={selectedMonth}
        onBack={() => setShowHistory(false)}
        onSelect={(k) => {
          setSelectedMonth(k);
          setShowHistory(false);
        }}
      />
    ) : (
    <div className="space-y-6 pb-8 stagger-sections">
      {/* Month selector */}
      <div className="flex items-center justify-between bg-card border border-border/60 rounded-2xl px-2 py-2 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)]">
        <button
          onClick={() => canPrev && setSelectedMonth(availableMonths[currentIdx + 1])}
          disabled={!canPrev}
          aria-label="Previous month"
          className="press p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-30"
        >
          <ChevronLeft className="size-5" />
        </button>
        <div className="relative">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="appearance-none bg-transparent text-center font-bold text-foreground tracking-tight text-[0.95rem] pr-5 pl-2 py-1 outline-none cursor-pointer"
          >
            {availableMonths.map((k) => (
              <option key={k} value={k}>
                {formatMonthLabel(k)}
              </option>
            ))}
          </select>
          <ChevronDown className="size-3.5 text-muted-foreground absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
        <button
          onClick={() => canNext && setSelectedMonth(availableMonths[currentIdx - 1])}
          disabled={!canNext}
          aria-label="Next month"
          className="press p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-30"
        >
          <ChevronRight className="size-5" />
        </button>
      </div>

      {/* History button */}
      <button
        onClick={() => setShowHistory(true)}
        className="press w-full flex items-center justify-center gap-2 bg-secondary/60 hover:bg-secondary text-foreground rounded-2xl py-2.5 text-sm font-semibold border border-border/60"
      >
        <HistoryIcon className="size-4" />
        View month history
      </button>

      {/* Balance summary */}
      <section className="bg-card border border-border/60 rounded-[1.75rem] p-6 shadow-[0_8px_32px_-12px_rgba(15,23,42,0.08)] text-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
          {formatMonthLabel(selectedMonth)} · Balance
        </p>
        <CurrencyTrigger
          ariaLabel="Change currency"
          className="press inline-block mt-1 rounded-2xl px-3 py-1 -mx-3 hover:bg-secondary/50 transition-colors"
        >
          <span
            className={`text-4xl font-extrabold tracking-tight ${
              balance < 0 ? "text-destructive" : "text-foreground"
            }`}
          >
            {formatTaka(balance, taka)}
          </span>
        </CurrencyTrigger>
        <div className="grid grid-cols-2 gap-3 mt-5">
          <div className="bg-secondary/60 rounded-2xl p-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
              Income
            </p>
            <p className="text-lg font-bold text-emerald-600 mt-0.5">
              +{formatTaka(totalIncome, taka)}
            </p>
          </div>
          <div className="bg-secondary/60 rounded-2xl p-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
              Expense
            </p>
            <p className="text-lg font-bold text-destructive mt-0.5">
              -{formatTaka(totalExpense, taka)}
            </p>
          </div>
        </div>
      </section>

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setOpenIncome(true)}
          className="press flex items-center justify-center gap-2 bg-emerald-600 text-white rounded-2xl py-3.5 font-semibold shadow-[0_4px_16px_-4px_rgba(5,150,105,0.35)]"
        >
          <ArrowDownCircle className="size-5" />
          Add Money
        </button>
        <button
          onClick={() => setOpenExpense(true)}
          className="press flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-2xl py-3.5 font-semibold shadow-[0_4px_16px_-4px_rgba(37,99,235,0.35)]"
        >
          <ArrowUpCircle className="size-5" />
          Add Expense
        </button>
      </div>

      {/* Daily spending limit */}
      <section className={`bg-card border rounded-[1.25rem] p-4 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)] ${limitTone.cardClass}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Settings2 className="size-4 text-muted-foreground" />
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
              Daily Limit
            </p>
          </div>
          {dailyLimit > 0 && (
            <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${limitTone.chipClass}`}>
              {limitTone.dot} {displayPercent}%
            </span>
          )}
        </div>

        {editingLimit ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const input = (e.currentTarget.elements.namedItem("limit") as HTMLInputElement)?.value;
              const num = parseFloat(input);
              if (!Number.isNaN(num) && num >= 0) {
                setDailyLimit(num);
                setDailyLimitState(num);
              }
              setEditingLimit(false);
            }}
            className="flex items-center gap-2"
          >
            <span className="text-sm text-muted-foreground font-semibold">{taka}</span>
            <input
              name="limit"
              type="number"
              step="1"
              min="0"
              defaultValue={dailyLimit || ""}
              autoFocus
              placeholder="0"
              className="flex-1 bg-secondary rounded-xl px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/60 font-semibold text-sm"
            />
            <button
              type="submit"
              className="press bg-primary text-primary-foreground rounded-xl px-3 py-2 text-xs font-bold"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditingLimit(false)}
              className="press text-muted-foreground hover:text-foreground rounded-xl px-2 py-2 text-xs font-bold"
            >
              Cancel
            </button>
          </form>
        ) : (
          <button
            onClick={() => setEditingLimit(true)}
            className="w-full text-left press"
          >
            {dailyLimit > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Today's spend
                  </p>
                  <p className={`text-sm font-extrabold ${limitTone.textClass}`}>
                    {formatTaka(todayExpense, taka)} / {formatTaka(dailyLimit, taka)}
                  </p>
                </div>
                <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${limitTone.barClass}`}
                    style={{ width: `${Math.min(limitPct, 100)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {remaining >= 0
                      ? `${formatTaka(remaining, taka)} left today`
                      : `${formatTaka(Math.abs(remaining), taka)} over limit`}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Tap to set a daily spending limit
              </p>
            )}
          </button>
        )}

        {dailyLimit > 0 && !editingLimit && (
          <div className={`mt-3 flex items-center gap-2 rounded-xl px-3 py-2.5 ${
            limitPct > 100
              ? "bg-red-500/10"
              : limitPct >= 80
                ? "bg-amber-500/10"
                : limitPct < 50
                  ? "bg-emerald-500/10"
                  : "bg-primary/5"
          }`}>
            <span className="text-sm">
              {limitPct > 100 ? "💡" : limitPct >= 80 ? "⚠️" : limitPct < 50 ? "💪" : "👍"}
            </span>
            <p className={`text-xs font-semibold ${limitTone.textClass}`}>
              {limitPct > 100
                ? `You're ${formatTaka(Math.abs(remaining), taka)} over today — tomorrow's a fresh start 💡`
                : limitPct >= 80
                  ? `You're ${displayPercent}% through today's budget — ${formatTaka(remaining, taka)} left`
                  : limitPct < 50
                    ? "Great control today 💪"
                    : `On track — ${formatTaka(remaining, taka)} left today`}
            </p>
          </div>
        )}
      </section>

      {/* Guidance Layer */}
      <GuidanceCard
        entries={entries}
        monthEntries={monthEntries}
        selectedMonth={selectedMonth}
        dailyLimit={dailyLimit}
        todayExpense={todayExpense}
      />

      {/* Filter bar */}
      <FilterBar filter={filter} onChange={setFilter} />

      {/* Today */}
      <div id="section-today">
        <DayCard
          dayKey={todayKeyStr}
          items={filteredMonthEntries.filter((e) => dayKey(e.createdAt) === todayKeyStr)}
          onEdit={setEditing}
          onOpenDetail={setDetail}
          onDeleteRequest={requestDelete}
          defaultOpen
          isToday
          hideWhenEmptyAndFiltered={!!filter.category || filter.scope !== "month"}
        />
      </div>

      {/* Yesterday */}
      {filter.scope !== "today" && (
        <div id="section-yesterday">
          <DayCard
            dayKey={yesterdayKeyStr}
            items={filteredMonthEntries.filter((e) => dayKey(e.createdAt) === yesterdayKeyStr)}
            onEdit={setEditing}
            onOpenDetail={setDetail}
            onDeleteRequest={requestDelete}
          />
        </div>
      )}


      {/* Category Breakdown */}
      <CategoryBreakdown
        entries={monthEntries}
        prevMonthEntries={entries.filter((e) => monthKey(e.createdAt) === shiftMonth(selectedMonth, -1))}
        activeCategory={filter.category}
        onSelectCategory={(c) =>
          setFilter((f) => ({ ...f, category: f.category === c ? null : c }))
        }
      />

      {/* Weekly spending chart */}
      <WeeklyChart entries={entries} dailyLimit={dailyLimit} />

      {/* Smart Insights */}
      <SmartInsights
        todayExpense={todayExpense}
        yesterdayExpense={entries
          .filter((e) => e.type === "expense" && dayKey(e.createdAt) === yesterdayKeyStr)
          .reduce((s, e) => s + e.amount, 0)}
        dailyLimit={dailyLimit}
        entries={entries}
        monthEntries={monthEntries}
        onFilterCategory={(c) => setFilter((f) => ({ ...f, category: c }))}
        onScrollTo={scrollToId}
      />

      {/* Remaining day history */}

      <DayGroupedHistory
        entries={monthEntries}
        onEdit={setEditing}
        onOpenDetail={setDetail}
        onDeleteRequest={requestDelete}
        excludeKeys={[todayKeyStr, yesterdayKeyStr]}
      />

      {openExpense && <AddExpenseSheet onClose={() => setOpenExpense(false)} />}
      {openIncome && <AddIncomeSheet onClose={() => setOpenIncome(false)} />}
      {editing && (
        <EditExpenseSheet expense={editing} onClose={() => setEditing(null)} />
      )}
      {detail && (
        <TransactionDetailSheet
          expense={detail}
          onClose={() => setDetail(null)}
          onEdit={(e) => {
            setDetail(null);
            setEditing(e);
          }}
          onDelete={requestDelete}
        />
      )}
      {pendingDelete && (
        <ConfirmDeleteDialog
          expense={pendingDelete}
          onCancel={() => setPendingDelete(null)}
          onConfirm={confirmDelete}
        />
      )}

    </div>
    )}
    </>
  );
}

function DayCard({
  dayKey: key,
  items,
  onEdit,
  onOpenDetail,
  onDeleteRequest,
  defaultOpen = false,
  isToday = false,
  hideWhenEmptyAndFiltered = false,
}: {
  dayKey: string;
  items: Expense[];
  onEdit: (e: Expense) => void;
  onOpenDetail: (e: Expense) => void;
  onDeleteRequest: (e: Expense) => void;
  defaultOpen?: boolean;
  isToday?: boolean;
  hideWhenEmptyAndFiltered?: boolean;
}) {

  const taka = useTakaSymbol();
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [revealedId, setRevealedId] = useState<string | null>(null);
  const longPressTimer = useRef<number | null>(null);

  const startLongPress = (id: string) => {
    if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
    longPressTimer.current = window.setTimeout(() => {
      setRevealedId(id);
    }, 500);
  };
  const cancelLongPress = () => {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  // Delete is confirmed at the page level; child rows only request it.


  // Empty state
  if (items.length === 0) {
    if (hideWhenEmptyAndFiltered) return null;
    if (!isToday) return null;
    return (
      <section className="bg-card border border-border/60 rounded-[1.25rem] shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)] overflow-hidden">
        <div className="p-5 text-center">
          <h3 className="font-bold text-foreground text-[0.95rem]">
            Today · 0 transactions
          </h3>
          <p className="mt-3 text-sm font-medium text-foreground">
            No spending yet today 💸
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Start tracking your expenses
          </p>
        </div>
      </section>
    );
  }

  const dayExpense = items
    .filter((e) => e.type === "expense")
    .reduce((s, e) => s + e.amount, 0);

  const txCount = items.length;
  const headerLabel = isToday
    ? `Today • ${txCount} ${txCount === 1 ? "transaction" : "transactions"}`
    : formatDayLabel(key);

  return (
    <section className="bg-card border border-border/60 rounded-[1.25rem] shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)] overflow-hidden">
      <button
        onClick={() => setIsOpen((o) => !o)}
        className="press w-full flex items-center justify-between p-4 text-left"
      >
        <div>
          <h3 className="font-bold text-foreground text-[0.95rem]">
            {headerLabel}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {!isToday && (
              <>
                {items.length} {items.length === 1 ? "entry" : "entries"} ·{" "}
              </>
            )}
            Total spent{" "}
            <span className="font-semibold text-destructive">
              {formatTaka(dayExpense, taka)}
            </span>
          </p>
        </div>
        <ChevronDown
          className={`size-5 text-muted-foreground shrink-0 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>
      {isOpen && (
        <ul className="px-3 pb-3 space-y-2.5">
          {items.map((e, idx) => {
            const isIncome = e.type === "income";
            const isMostRecent = isToday && idx === 0;
            const revealed = revealedId === e.id;
            return (
              <li key={e.id} className="card-pop">
                <SwipeableRow
                  onSwipeLeft={() => onDeleteRequest(e)}
                  onSwipeRight={() => onEdit(e)}
                  leftLabel="Delete"
                  rightLabel="Edit"
                  rightIcon="edit"
                  rightBgClass="bg-primary/90 text-primary-foreground"
                >
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => onOpenDetail(e)}
                    onKeyDown={(ev) => {
                      if (ev.key === "Enter" || ev.key === " ") {
                        ev.preventDefault();
                        onOpenDetail(e);
                      }
                    }}
                    onPointerDown={() => startLongPress(e.id)}
                    onPointerUp={cancelLongPress}
                    onPointerLeave={cancelLongPress}
                    onPointerCancel={cancelLongPress}

                    className={`flex items-stretch bg-secondary/40 rounded-2xl overflow-hidden ${
                      isMostRecent
                        ? "ring-1 ring-primary/40 shadow-[0_4px_18px_-6px_rgba(59,130,246,0.35)] bg-secondary/60"
                        : "shadow-sm"
                    }`}
                  >
                    <div
                      className="w-1 shrink-0"
                      style={{
                        backgroundColor: isIncome ? "#14B8A6" : CATEGORY_COLOR[e.category],
                      }}
                    />
                    <div className="flex items-center justify-between flex-1 p-3 min-w-0 gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div
                          className="size-9 shrink-0 rounded-full flex items-center justify-center text-base"
                          style={{
                            backgroundColor: isIncome
                              ? "#14B8A622"
                              : `${CATEGORY_COLOR[e.category]}22`,
                          }}
                        >
                          {isIncome ? "💰" : CATEGORY_EMOJI[e.category]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-foreground text-[0.9rem] truncate leading-tight">
                            {e.title}
                          </h4>
                          <p className="text-[11px] text-muted-foreground mt-0.5 font-medium">
                            {isIncome ? "Income" : e.category}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <p
                          className={`text-sm font-mono font-bold ${
                            isIncome ? "text-emerald-600" : "text-foreground"
                          }`}
                        >
                          {isIncome ? "+" : "-"}{formatTaka(e.amount, taka)}
                        </p>
                        {revealed && (
                          <div className="flex items-center gap-0.5 animate-in fade-in duration-150">
                            <button
                              onClick={(ev) => {
                                ev.stopPropagation();
                                setRevealedId(null);
                                onEdit(e);
                              }}
                              aria-label="Edit entry"
                              className="press text-primary p-1.5 rounded-full bg-primary/10"
                            >
                              <Pencil className="size-3.5" />
                            </button>
                            <button
                              onClick={(ev) => {
                                ev.stopPropagation();
                                setRevealedId(null);
                                onDeleteRequest(e);
                              }}
                              aria-label="Delete entry"
                              className="press text-destructive p-1.5 rounded-full bg-destructive/10"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </SwipeableRow>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}



function DayGroupedHistory({
  entries,
  onEdit,
  onOpenDetail,
  onDeleteRequest,
  excludeKeys = [],
}: {
  entries: Expense[];
  onEdit: (e: Expense) => void;
  onOpenDetail: (e: Expense) => void;
  onDeleteRequest: (e: Expense) => void;
  excludeKeys?: string[];
}) {

  if (entries.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-16">
        <div className="inline-flex items-center justify-center size-16 rounded-full bg-secondary mb-5">
          <Wallet className="size-7 text-muted-foreground" />
        </div>
        <p className="text-base font-semibold text-foreground">No entries this month</p>
        <p className="text-sm text-muted-foreground mt-1.5">
          Add money or an expense to get started.
        </p>
      </div>
    );
  }

  // Group by day, preserving sort (entries already newest-first)
  const groupsMap = new Map<string, Expense[]>();
  for (const e of entries) {
    const k = dayKey(e.createdAt);
    if (!groupsMap.has(k)) groupsMap.set(k, []);
    groupsMap.get(k)!.push(e);
  }
  const groups = Array.from(groupsMap.entries()).sort((a, b) =>
    a[0] < b[0] ? 1 : -1,
  );

  const filtered = groups.filter(([key]) => !excludeKeys.includes(key));
  if (filtered.length === 0) return null;

  const todayKey = dayKey(Date.now());

  return (
    <div className="space-y-3">
      {filtered.map(([key, items], gi) => (
        <div
          key={key}
          style={{ animationDelay: `${Math.min(gi * 50, 240)}ms` }}
          className="animate-list-item-in"
        >
          <DayCard
            dayKey={key}
            items={items}
            onEdit={onEdit}
            onOpenDetail={onOpenDetail}
            onDeleteRequest={onDeleteRequest}
            defaultOpen={key === todayKey}
          />

        </div>
      ))}
    </div>
  );
}

function WeeklyChart({ entries, dailyLimit }: { entries: Expense[]; dailyLimit: number }) {
  const taka = useTakaSymbol();
  const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const now = new Date();
  // Monday as start of week
  const dayIdx = (now.getDay() + 6) % 7; // 0 = Mon
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayIdx);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
    return { date: d, key: dayKey(d.getTime()) };
  });

  const totals = days.map(({ key }) =>
    entries
      .filter((e) => e.type === "expense" && dayKey(e.createdAt) === key)
      .reduce((s, e) => s + e.amount, 0)
  );

  const maxSpend = Math.max(...totals, dailyLimit || 0, 1);
  const todayStr = dayKey(now.getTime());

  return (
    <section className="bg-card border border-border/60 rounded-[1.25rem] p-4 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)]">
      <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground mb-3">
        This Week
      </h3>
      <div className="space-y-2">
        {days.map(({ key, date }, i) => {
          const amount = totals[i];
          const isFuture = date.getTime() > now.getTime() && key !== todayStr;
          const isToday = key === todayStr;
          const percent = isFuture ? 0 : (amount / maxSpend) * 100;
          const exceeded = dailyLimit > 0 && amount > dailyLimit;
          const barColor = isFuture
            ? "transparent"
            : isToday
              ? exceeded
                ? "#EF4444"
                : "#22C55E"
              : "#6B7280";
          return (
            <button
              key={key}
              type="button"
              onClick={() => {
                if (isFuture) return;
                toast(`${DAY_LABELS[i]} · ${amount > 0 ? formatTaka(amount, taka) : "No spend"}`);
              }}
              className="press flex items-center gap-3 w-full text-left rounded-lg"
            >
              <span
                className={`w-9 text-[11px] font-semibold ${
                  isToday ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {DAY_LABELS[i]}
              </span>
              <div className="flex-1 h-2 rounded-full bg-secondary/60 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(Math.max(percent, amount > 0 ? 4 : 0), 100)}%`,
                    backgroundColor: barColor,
                    opacity: isToday ? 1 : 0.75,
                  }}
                />
              </div>
              <span
                className={`w-16 text-right text-[11px] tabular-nums ${
                  isFuture ? "text-muted-foreground/40" : "text-muted-foreground"
                }`}
              >
                {isFuture ? "—" : amount > 0 ? formatTaka(amount, taka) : "0"}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function CategoryBreakdown({
  entries,
  prevMonthEntries = [],
  activeCategory = null,
  onSelectCategory,
}: {
  entries: Expense[];
  prevMonthEntries?: Expense[];
  activeCategory?: ExpenseCategory | null;
  onSelectCategory?: (c: ExpenseCategory) => void;
}) {
  const taka = useTakaSymbol();
  const expenseEntries = entries.filter((e) => e.type === "expense");
  const totalExpense = expenseEntries.reduce((s, e) => s + e.amount, 0);

  const categoryTotals: Record<ExpenseCategory, number> = {
    Food: 0,
    Transport: 0,
    Study: 0,
    Others: 0,
  };
  for (const e of expenseEntries) {
    categoryTotals[e.category] += e.amount;
  }

  const prevTotals: Record<ExpenseCategory, number> = {
    Food: 0,
    Transport: 0,
    Study: 0,
    Others: 0,
  };
  for (const e of prevMonthEntries) {
    if (e.type === "expense") prevTotals[e.category] += e.amount;
  }

  if (totalExpense === 0) return null;

  let topCategory: ExpenseCategory | null = null;
  let maxAmount = 0;
  for (const cat of CATEGORIES) {
    if (categoryTotals[cat] > maxAmount) {
      maxAmount = categoryTotals[cat];
      topCategory = cat;
    }
  }

  return (
    <section className="bg-card border border-border/60 rounded-[1.25rem] p-4 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)]">
      <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
        Category Breakdown
      </h3>
      <p className="text-xs text-muted-foreground mt-0.5 mb-3">
        Tap a category to filter
      </p>
      <div className="space-y-3">
        {CATEGORIES.map((cat) => {
          const amount = categoryTotals[cat];
          if (amount <= 0) return null;
          const percent = totalExpense > 0 ? (amount / totalExpense) * 100 : 0;
          const isTop = topCategory === cat;
          const isActive = activeCategory === cat;
          const prev = prevTotals[cat];
          let trendNode: React.ReactNode = null;
          if (prev > 0) {
            const delta = ((amount - prev) / prev) * 100;
            const up = delta > 0;
            const flat = Math.abs(delta) < 1;
            trendNode = (
              <span
                className={`text-[10px] font-semibold ml-1.5 ${
                  flat
                    ? "text-muted-foreground"
                    : up
                      ? "text-red-500"
                      : "text-emerald-600"
                }`}
              >
                {flat ? "≈" : up ? "↑" : "↓"} {Math.abs(Math.round(delta))}% vs last month
              </span>
            );
          } else if (amount > 0) {
            trendNode = (
              <span className="text-[10px] font-semibold text-muted-foreground ml-1.5">
                new this month
              </span>
            );
          }
          return (
            <button
              key={cat}
              type="button"
              onClick={() => onSelectCategory?.(cat)}
              className={`press w-full text-left card-pop rounded-xl px-2 py-2 transition-colors ${
                isActive ? "bg-primary/10 ring-1 ring-primary/40" : "hover:bg-secondary/40"
              }`}
            >
              <div className="flex items-center justify-between mb-2 gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-base">{CATEGORY_EMOJI[cat]}</span>
                  <span
                    className={`text-sm font-semibold truncate ${
                      isTop ? "text-foreground" : "text-foreground/80"
                    }`}
                  >
                    {cat}
                  </span>
                  {isTop && (
                    <span className="inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary shrink-0">
                      Top
                    </span>
                  )}
                </div>
                <span className="text-sm font-bold tabular-nums shrink-0">
                  <span className={isTop ? "text-foreground" : "text-muted-foreground"}>
                    {formatTaka(amount, taka)}
                  </span>
                  <span className="text-xs font-semibold text-muted-foreground ml-1.5">
                    ({Math.round(percent)}%)
                  </span>
                </span>
              </div>
              <div className="h-2 w-full bg-secondary/60 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(percent, 100)}%`,
                    backgroundColor: CATEGORY_COLOR[cat],
                    opacity: isTop ? 1 : 0.7,
                  }}
                />
              </div>
              {trendNode && <div className="mt-1.5">{trendNode}</div>}
            </button>
          );
        })}
      </div>
    </section>
  );
}

type Insight = {
  icon: string;
  text: string;
  tone: "positive" | "warning" | "neutral";
  action?: () => void;
};

function SmartInsights({
  todayExpense,
  yesterdayExpense = 0,
  dailyLimit,
  entries,
  monthEntries = [],
  onFilterCategory,
  onScrollTo,
}: {
  todayExpense: number;
  yesterdayExpense?: number;
  dailyLimit: number;
  entries: Expense[];
  monthEntries?: Expense[];
  onFilterCategory?: (c: ExpenseCategory) => void;
  onScrollTo?: (id: string) => void;
}) {
  const insights: Insight[] = [];

  // A. Top category
  const expenseEntries = monthEntries.filter((e) => e.type === "expense");
  const totalExpense = expenseEntries.reduce((s, e) => s + e.amount, 0);
  if (totalExpense > 0) {
    const totals: Record<string, number> = {};
    for (const e of expenseEntries) totals[e.category] = (totals[e.category] || 0) + e.amount;
    const topCat = Object.entries(totals).sort((a, b) => b[1] - a[1])[0];
    if (topCat) {
      const percent = Math.round((topCat[1] / totalExpense) * 100);
      insights.push({
        icon: "📊",
        text: `${topCat[0]} is your top spending (${percent}%)`,
        tone: "neutral",
        action: () => onFilterCategory?.(topCat[0] as ExpenseCategory),
      });
    }
  }

  // B. Today vs yesterday
  if (todayExpense > 0 || yesterdayExpense > 0) {
    if (todayExpense > yesterdayExpense && yesterdayExpense > 0) {
      const delta = Math.round(((todayExpense - yesterdayExpense) / yesterdayExpense) * 100);
      insights.push({
        icon: "📈",
        text: `Spending up ${delta}% vs yesterday`,
        tone: "warning",
        action: () => onScrollTo?.("section-yesterday"),
      });
    } else if (yesterdayExpense > todayExpense) {
      insights.push({
        icon: "📉",
        text: "Spending reduced from yesterday — great control!",
        tone: "positive",
      });
    }
  }

  // C. No-spend streak
  const noSpend = getNoSpendStreak(entries);
  if (noSpend >= 1) {
    insights.push({
      icon: "🔥",
      text: `${noSpend} no-spend day${noSpend > 1 ? "s" : ""} this week 👏`,
      tone: "positive",
    });
  }

  // D. Top weekday
  const wd = getTopWeekday(monthEntries.length ? monthEntries : entries);
  if (wd && wd.total > 0) {
    insights.push({
      icon: "📅",
      text: `You spend most on ${wd.name}`,
      tone: "neutral",
    });
  }

  // E. Recurring
  const recurring = getRecurringGroup(entries);
  if (recurring) {
    insights.push({
      icon: "🔁",
      text: `${recurring.title} looks recurring (~${recurring.amount} · ${recurring.count}×)`,
      tone: "neutral",
      action: () => onFilterCategory?.(recurring.category),
    });
  }

  // F. Yesterday no-spend
  if (yesterdayExpense === 0 && entries.length > 0) {
    insights.push({
      icon: "👏",
      text: "Nice — no spending yesterday",
      tone: "positive",
    });
  }

  // Ensure at least one positive insight
  const hasPositive = insights.some((i) => i.tone === "positive");
  if (!hasPositive) {
    if (dailyLimit > 0 && todayExpense <= dailyLimit) {
      insights.unshift({
        icon: "👍",
        text: "You're within budget today",
        tone: "positive",
      });
    } else {
      insights.unshift({
        icon: "✨",
        text: "Steady tracking — keep it up",
        tone: "positive",
      });
    }
  }

  const toneClass = (t: Insight["tone"]) =>
    t === "positive"
      ? "text-emerald-700 dark:text-emerald-400"
      : t === "warning"
        ? "text-amber-700 dark:text-amber-400"
        : "text-foreground/85";

  return (
    <section className="card-pop bg-gradient-to-br from-amber-500/15 to-amber-700/10 border border-amber-500/20 rounded-[1.25rem] p-4 shadow-[0_4px_24px_-8px_rgba(245,158,11,0.25)]">
      <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-amber-600 dark:text-amber-400 mb-2.5 flex items-center gap-1.5">
        <Sparkles className="size-3.5" />
        Insights
      </h3>
      {insights.length === 0 ? (
        <div className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 bg-background/40 backdrop-blur-sm">
          <span className="text-sm">📊</span>
          <span className="text-sm font-semibold text-muted-foreground">
            No data yet — start tracking to see insights
          </span>
        </div>
      ) : (
        <div className="space-y-2">
          {insights.map((insight, i) => {
            const Tag = insight.action ? "button" : "div";
            return (
              <Tag
                key={i}
                {...(insight.action
                  ? { type: "button" as const, onClick: insight.action }
                  : {})}
                className={`press w-full text-left flex items-center gap-2.5 rounded-xl px-3 py-2.5 bg-background/40 backdrop-blur-sm ${
                  insight.action ? "hover:bg-background/60" : ""
                }`}
              >
                <span className="text-sm">{insight.icon}</span>
                <span className={`text-sm font-semibold flex-1 ${toneClass(insight.tone)}`}>
                  {insight.text}
                </span>
                {insight.action && (
                  <ChevronRight className="size-3.5 text-muted-foreground shrink-0" />
                )}
              </Tag>
            );
          })}
        </div>
      )}
    </section>
  );
}

function GuidanceCard({
  entries,
  monthEntries,
  selectedMonth,
  dailyLimit,
  todayExpense,
}: {
  entries: Expense[];
  monthEntries: Expense[];
  selectedMonth: string;
  dailyLimit: number;
  todayExpense: number;
}) {
  const taka = useTakaSymbol();
  const remaining = dailyLimit > 0 ? Math.max(dailyLimit - todayExpense, 0) : 0;
  const pct = dailyLimit > 0 ? (todayExpense / dailyLimit) * 100 : 0;

  const projection = getProjection(entries, selectedMonth);

  const income = monthEntries
    .filter((e) => e.type === "income")
    .reduce((s, e) => s + e.amount, 0);
  const expense = monthEntries
    .filter((e) => e.type === "expense")
    .reduce((s, e) => s + e.amount, 0);

  let savingRate: number | null = null;
  if (income > 0) savingRate = Math.round(((income - expense) / income) * 100);

  const savingTone =
    savingRate === null
      ? null
      : savingRate >= 50
        ? { emoji: "🎉", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" }
        : savingRate >= 20
          ? { emoji: "👍", cls: "bg-primary/10 text-primary" }
          : savingRate >= 0
            ? { emoji: "⚠️", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-500" }
            : { emoji: "💡", cls: "bg-red-500/10 text-red-600" };

  return (
    <section className="bg-card border border-border/60 rounded-[1.25rem] p-4 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)]">
      <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground mb-3 flex items-center gap-1.5">
        <Shield className="size-3.5" />
        Guidance
      </h3>
      <div className="grid grid-cols-2 gap-2.5">
        {/* Safe to spend */}
        <div className="bg-secondary/50 rounded-xl p-3">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
            <PiggyBank className="size-3" /> Safe today
          </div>
          {dailyLimit > 0 ? (
            <p className="mt-1 text-base font-extrabold tabular-nums text-foreground">
              {formatTaka(remaining, taka)}
            </p>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">Set a daily limit</p>
          )}
        </div>

        {/* Predictive warning OR encouragement */}
        <div
          className={`rounded-xl p-3 ${
            dailyLimit === 0
              ? "bg-secondary/50"
              : pct >= 100
                ? "bg-red-500/10"
                : pct >= 60
                  ? "bg-amber-500/15"
                  : "bg-emerald-500/10"
          }`}
        >
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
            <Lightbulb className="size-3" /> Budget
          </div>
          {dailyLimit === 0 ? (
            <p className="mt-1 text-xs text-muted-foreground">No limit set</p>
          ) : pct >= 100 ? (
            <p className="mt-1 text-xs font-semibold text-red-600">
              {formatTaka(todayExpense - dailyLimit, taka)} over today
            </p>
          ) : pct >= 60 ? (
            <p className="mt-1 text-xs font-semibold text-amber-700 dark:text-amber-500">
              {Math.round(pct)}% used — {formatTaka(remaining, taka)} left
            </p>
          ) : (
            <p className="mt-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              Plenty left — {formatTaka(remaining, taka)}
            </p>
          )}
        </div>

        {/* Month projection */}
        <div className="bg-secondary/50 rounded-xl p-3">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
            <TargetIcon className="size-3" /> Month projection
          </div>
          {projection ? (
            <>
              <p className="mt-1 text-base font-extrabold tabular-nums text-foreground">
                {formatTaka(projection.projected, taka)}
              </p>
              <p className="text-[10px] text-muted-foreground">
                at this rate · day {projection.daysPassed}/{projection.totalDays}
              </p>
            </>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">Not enough data yet</p>
          )}
        </div>

        {/* Saving rate */}
        <div className={`rounded-xl p-3 ${savingTone ? savingTone.cls : "bg-secondary/50"}`}>
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.1em] opacity-70">
            <TrendingUp className="size-3" /> Saving rate
          </div>
          {savingRate !== null && savingTone ? (
            <p className="mt-1 text-base font-extrabold tabular-nums">
              {savingRate}% {savingTone.emoji}
            </p>
          ) : (
            <p className="mt-1 text-xs opacity-70">Add income to track</p>
          )}
        </div>
      </div>
    </section>
  );
}

function FilterBar({
  filter,
  onChange,
}: {
  filter: Filter;
  onChange: (f: Filter) => void;
}) {
  const active = filter.scope !== "month" || filter.category !== null;
  const scopes: { key: FilterScope; label: string }[] = [
    { key: "today", label: "Today" },
    { key: "week", label: "Week" },
    { key: "month", label: "Month" },
  ];

  return (
    <section className="bg-card border border-border/60 rounded-[1.25rem] p-3 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)]">
      <div className="flex items-center gap-2 flex-wrap">
        {scopes.map((s) => {
          const isActive = filter.scope === s.key;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => onChange({ ...filter, scope: s.key })}
              className={`press text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full border ${
                isActive
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-secondary/60 text-foreground border-transparent"
              }`}
            >
              {s.label}
            </button>
          );
        })}
        <span className="w-px h-5 bg-border mx-1" />
        {CATEGORIES.map((cat) => {
          const isActive = filter.category === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() =>
                onChange({ ...filter, category: isActive ? null : cat })
              }
              className={`press text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full border flex items-center gap-1 ${
                isActive
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-secondary/60 text-foreground border-transparent"
              }`}
            >
              <span>{CATEGORY_EMOJI[cat]}</span>
              {cat}
            </button>
          );
        })}
        {active && (
          <button
            type="button"
            onClick={() => onChange({ scope: "month", category: null })}
            className="press text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full bg-destructive/10 text-destructive ml-auto"
          >
            Clear ✕
          </button>
        )}
      </div>
    </section>
  );
}



function CategorySelect({
  value,
  onChange,
}: {
  value: ExpenseCategory;
  onChange: (c: ExpenseCategory) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {CATEGORIES.map((cat) => (
        <button
          key={cat}
          type="button"
          onClick={() => onChange(cat)}
          className={`press flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold border transition-colors ${
            value === cat
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-secondary text-foreground border-transparent hover:bg-secondary/80"
          }`}
        >
          <span>{CATEGORY_EMOJI[cat]}</span>
          {cat}
        </button>
      ))}
    </div>
  );
}

function AddExpenseSheet({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("Others");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(amount);
    if (!title.trim() || Number.isNaN(num) || num <= 0) return;
    addExpense({ title, amount: num, type: "expense", category });
    toast.success("Expense added");
    onClose();
  };

  return (
    <Sheet title="New expense" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Title">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Breakfast, Bus, Lunch"
            className="w-full bg-secondary rounded-xl px-4 py-3.5 text-foreground outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/60 font-medium"
          />
        </Field>
        <Field label="Amount">
          <input
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full bg-secondary rounded-xl px-4 py-3.5 text-foreground outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/60 font-medium"
          />
        </Field>
        <Field label="Category">
          <CategorySelect value={category} onChange={setCategory} />
        </Field>
        <button
          type="submit"
          disabled={!title.trim() || !amount || Number.isNaN(parseFloat(amount)) || parseFloat(amount) <= 0}
          className="press w-full bg-primary text-primary-foreground rounded-[1.25rem] py-4 font-semibold shadow-[0_4px_16px_-4px_rgba(37,99,235,0.35)] disabled:opacity-45 disabled:shadow-none mt-2"
        >
          Add Expense
        </button>
      </form>
    </Sheet>
  );
}

function AddIncomeSheet({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(amount);
    if (Number.isNaN(num) || num <= 0) return;
    addIncome({ amount: num, title: title.trim() || "Added money" });
    toast.success("Income added");
    onClose();
  };

  return (
    <Sheet title="Add money" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Note (optional)">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Salary, Allowance"
            className="w-full bg-secondary rounded-xl px-4 py-3.5 text-foreground outline-none focus:ring-2 focus:ring-emerald-500/30 placeholder:text-muted-foreground/60 font-medium"
          />
        </Field>
        <Field label="Amount">
          <input
            autoFocus
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full bg-secondary rounded-xl px-4 py-3.5 text-foreground outline-none focus:ring-2 focus:ring-emerald-500/30 placeholder:text-muted-foreground/60 font-medium"
          />
        </Field>
        <button
          type="submit"
          disabled={!amount || Number.isNaN(parseFloat(amount)) || parseFloat(amount) <= 0}
          className="press w-full bg-emerald-600 text-white rounded-[1.25rem] py-4 font-semibold shadow-[0_4px_16px_-4px_rgba(5,150,105,0.35)] disabled:opacity-45 disabled:shadow-none mt-2"
        >
          Add Money
        </button>
      </form>
    </Sheet>
  );
}

function EditExpenseSheet({
  expense,
  onClose,
}: {
  expense: Expense;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(expense.title);
  const [amount, setAmount] = useState(String(expense.amount));
  const [category, setCategory] = useState<ExpenseCategory>(expense.category);
  const isIncome = expense.type === "income";

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(amount);
    if (!title.trim() || Number.isNaN(num) || num <= 0) return;
    updateExpense(expense.id, { title, amount: num, category: isIncome ? undefined : category });
    toast.success(isIncome ? "Income updated" : "Expense updated");
    onClose();
  };

  return (
    <Sheet title={isIncome ? "Edit income" : "Edit expense"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Title">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-secondary rounded-xl px-4 py-3.5 text-foreground outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/60 font-medium"
          />
        </Field>
        <Field label="Amount">
          <input
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full bg-secondary rounded-xl px-4 py-3.5 text-foreground outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/60 font-medium"
          />
        </Field>
        {!isIncome && (
          <Field label="Category">
            <CategorySelect value={category} onChange={setCategory} />
          </Field>
        )}
        <button
          type="submit"
          disabled={!title.trim() || !amount || Number.isNaN(parseFloat(amount)) || parseFloat(amount) <= 0}
          className="press w-full bg-primary text-primary-foreground rounded-[1.25rem] py-4 font-semibold shadow-[0_4px_16px_-4px_rgba(37,99,235,0.35)] disabled:opacity-45 disabled:shadow-none mt-2"
        >
          Save Changes
        </button>
      </form>
    </Sheet>
  );
}

function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/25 backdrop-blur-md">
      <div className="w-full max-w-md bg-card rounded-t-[1.75rem] p-6 shadow-[0_-8px_40px_-8px_rgba(15,23,42,0.15)] animate-in slide-in-from-bottom duration-300">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-foreground tracking-tight">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-muted-foreground hover:text-foreground p-1.5 rounded-full hover:bg-secondary transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.12em]">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

function MonthHistory({
  entries,
  currentMonth,
  selectedMonth,
  onBack,
  onSelect,
}: {
  entries: Expense[];
  currentMonth: string;
  selectedMonth: string;
  onBack: () => void;
  onSelect: (k: string) => void;
}) {
  const taka = useTakaSymbol();
  // Group entries by month
  const byMonth = new Map<string, Expense[]>();
  for (const e of entries) {
    const k = monthKey(e.createdAt);
    if (!byMonth.has(k)) byMonth.set(k, []);
    byMonth.get(k)!.push(e);
  }
  // Always include current month
  if (!byMonth.has(currentMonth)) byMonth.set(currentMonth, []);

  const months = Array.from(byMonth.keys()).sort((a, b) => (a < b ? 1 : -1));

  return (
    <div className="space-y-5 pb-8">
      <div className="flex items-center gap-2">
        <button
          onClick={onBack}
          aria-label="Back"
          className="press p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary"
        >
          <ArrowLeft className="size-5" />
        </button>
        <div>
          <h2 className="font-bold text-foreground text-lg leading-tight">Month History</h2>
          <p className="text-xs text-muted-foreground">Browse past months</p>
        </div>
      </div>

      <div className="space-y-3">
        {months.map((k, i) => {
          const items = byMonth.get(k) ?? [];
          const income = items
            .filter((e) => e.type === "income")
            .reduce((s, e) => s + e.amount, 0);
          const expense = items
            .filter((e) => e.type === "expense")
            .reduce((s, e) => s + e.amount, 0);
          const balance = income - expense;
          const isCurrent = k === currentMonth;
          const isSelected = k === selectedMonth;
          return (
            <button
              key={k}
              onClick={() => onSelect(k)}
              style={{ animationDelay: `${Math.min(i * 50, 240)}ms` }}
              className={`press w-full text-left bg-card border rounded-[1.25rem] p-4 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)] animate-list-item-in transition-colors ${
                isSelected ? "border-primary/60 ring-2 ring-primary/20" : "border-border/60"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-foreground text-[0.95rem]">
                    {formatMonthLabel(k)}
                  </h3>
                  {isCurrent && (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                      Active
                    </span>
                  )}
                </div>
                <p
                  className={`text-base font-extrabold tracking-tight ${
                    balance < 0 ? "text-destructive" : "text-foreground"
                  }`}
                >
                  {formatTaka(balance, taka)}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-secondary/60 rounded-xl p-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                    Income
                  </p>
                  <p className="text-sm font-bold text-emerald-600 mt-0.5">
                    +{formatTaka(income, taka)}
                  </p>
                </div>
                <div className="bg-secondary/60 rounded-xl p-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                    Expense
                  </p>
                  <p className="text-sm font-bold text-destructive mt-0.5">
                    -{formatTaka(expense, taka)}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
