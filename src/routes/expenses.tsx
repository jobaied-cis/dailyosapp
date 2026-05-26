import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  useExpenses,
  addExpense,
  addIncome,
  updateExpense,
  deleteExpense,
  type Expense,
  type ExpenseCategory,
} from "@/lib/expenses-store";
import { Plus, Trash2, Wallet, X, Pencil, ArrowDownCircle, ArrowUpCircle, ChevronDown, ChevronLeft, ChevronRight, History as HistoryIcon, ArrowLeft } from "lucide-react";

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
  Food: "🍔",
  Transport: "🚌",
  Study: "📚",
  Others: "📦",
};

const CATEGORIES: ExpenseCategory[] = ["Food", "Transport", "Study", "Others"];

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
  const [openExpense, setOpenExpense] = useState(false);
  const [openIncome, setOpenIncome] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => monthKey(Date.now()));
  const [showHistory, setShowHistory] = useState(false);

  // Available months (always include current month even if empty)
  const availableMonths = (() => {
    const set = new Set<string>();
    set.add(monthKey(Date.now()));
    for (const e of entries) set.add(monthKey(e.createdAt));
    return Array.from(set).sort((a, b) => (a < b ? 1 : -1));
  })();

  const monthEntries = entries.filter((e) => monthKey(e.createdAt) === selectedMonth);

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

  if (showHistory) {
    return (
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
    );
  }

  return (
    <div className="space-y-6 pb-8">
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

      {/* Balance summary */}
      <section className="bg-card border border-border/60 rounded-[1.75rem] p-6 shadow-[0_8px_32px_-12px_rgba(15,23,42,0.08)] text-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
          {formatMonthLabel(selectedMonth)} · Balance
        </p>
        <p
          className={`text-4xl font-extrabold mt-1 tracking-tight ${
            balance < 0 ? "text-destructive" : "text-foreground"
          }`}
        >
          ${balance.toFixed(2)}
        </p>
        <div className="grid grid-cols-2 gap-3 mt-5">
          <div className="bg-secondary/60 rounded-2xl p-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
              Income
            </p>
            <p className="text-lg font-bold text-emerald-600 mt-0.5">
              +${totalIncome.toFixed(2)}
            </p>
          </div>
          <div className="bg-secondary/60 rounded-2xl p-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
              Expense
            </p>
            <p className="text-lg font-bold text-destructive mt-0.5">
              -${totalExpense.toFixed(2)}
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

      {/* Day-grouped history (filtered to selected month) */}
      <DayGroupedHistory entries={monthEntries} onEdit={setEditing} />

      {openExpense && <AddExpenseSheet onClose={() => setOpenExpense(false)} />}
      {openIncome && <AddIncomeSheet onClose={() => setOpenIncome(false)} />}
      {editing && (
        <EditExpenseSheet expense={editing} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

function DayGroupedHistory({
  entries,
  onEdit,
}: {
  entries: Expense[];
  onEdit: (e: Expense) => void;
}) {
  const todayKey = dayKey(Date.now());
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

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

  return (
    <div className="space-y-3">
      {groups.map(([key, items], gi) => {
        const dayExpense = items
          .filter((e) => e.type === "expense")
          .reduce((s, e) => s + e.amount, 0);
        const isOpen = collapsed[key] !== undefined ? !collapsed[key] : key === todayKey;
        return (
          <section
            key={key}
            style={{ animationDelay: `${Math.min(gi * 50, 240)}ms` }}
            className="bg-card border border-border/60 rounded-[1.25rem] shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)] overflow-hidden animate-list-item-in"
          >
            <button
              onClick={() => setCollapsed((c) => ({ ...c, [key]: !(c[key] !== undefined ? !c[key] : key === todayKey) }))}
              className="press w-full flex items-center justify-between p-4 text-left"
            >
              <div>
                <h3 className="font-bold text-foreground text-[0.95rem]">
                  {formatDayLabel(key)}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {items.length} {items.length === 1 ? "entry" : "entries"} · Total spent{" "}
                  <span className="font-semibold text-destructive">
                    ${dayExpense.toFixed(2)}
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
              <ul className="px-3 pb-3 space-y-2">
                {items.map((e) => {
                  const isIncome = e.type === "income";
                  return (
                    <li
                      key={e.id}
                      className="group flex items-center justify-between bg-secondary/40 rounded-2xl p-3"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div
                          className={`size-9 shrink-0 rounded-full flex items-center justify-center ${
                            isIncome ? "bg-emerald-500/10" : "bg-destructive/10"
                          }`}
                        >
                          {isIncome ? (
                            <ArrowDownCircle className="size-5 text-emerald-600" />
                          ) : (
                            <ArrowUpCircle className="size-5 text-destructive" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-foreground text-[0.9rem] truncate">
                              {e.title}
                            </h4>
                            {!isIncome && (
                              <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                                {CATEGORY_EMOJI[e.category]} {e.category}
                              </span>
                            )}
                          </div>
                          <p
                            className={`text-sm font-mono font-semibold mt-0.5 ${
                              isIncome ? "text-emerald-600" : "text-destructive"
                            }`}
                          >
                            {isIncome ? "+" : "-"}${e.amount.toFixed(2)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => onEdit(e)}
                          aria-label="Edit entry"
                          className="press text-muted-foreground/40 hover:text-primary p-1.5 rounded-full hover:bg-primary/5"
                        >
                          <Pencil className="size-4" />
                        </button>
                        <button
                          onClick={() => deleteExpense(e.id)}
                          aria-label="Delete entry"
                          className="press text-muted-foreground/40 hover:text-destructive p-1.5 rounded-full hover:bg-destructive/5"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
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
