import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  useExpenses,
  addExpense,
  addIncome,
  updateExpense,
  deleteExpense,
  type Expense,
} from "@/lib/expenses-store";
import { Plus, Trash2, Wallet, X, Pencil, ArrowDownCircle, ArrowUpCircle } from "lucide-react";

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

  const totalIncome = entries
    .filter((e) => e.type === "income")
    .reduce((s, e) => s + e.amount, 0);
  const totalExpense = entries
    .filter((e) => e.type === "expense")
    .reduce((s, e) => s + e.amount, 0);
  const balance = totalIncome - totalExpense;

  return (
    <div className="space-y-6 pb-8">
      {/* Balance summary */}
      <section className="bg-card border border-border/60 rounded-[1.75rem] p-6 shadow-[0_8px_32px_-12px_rgba(15,23,42,0.08)] text-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
          Current Balance
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

      {/* History */}
      <ul className="space-y-3">
        {entries.map((e, i) => {
          const isIncome = e.type === "income";
          return (
            <li
              key={e.id}
              style={{ animationDelay: `${Math.min(i * 40, 240)}ms` }}
              className="group flex items-center justify-between bg-card border border-border/60 rounded-[1.25rem] p-4 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)] animate-list-item-in transition-all duration-300 hover:shadow-[0_4px_20px_-6px_rgba(15,23,42,0.1)]"
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
                  <h3 className="font-semibold text-foreground text-[0.95rem] truncate">
                    {e.title}
                  </h3>
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
                  onClick={() => setEditing(e)}
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
        {entries.length === 0 && (
          <li className="text-center text-muted-foreground py-16">
            <div className="inline-flex items-center justify-center size-16 rounded-full bg-secondary mb-5">
              <Wallet className="size-7 text-muted-foreground" />
            </div>
            <p className="text-base font-semibold text-foreground">No entries yet</p>
            <p className="text-sm text-muted-foreground mt-1.5">
              Add money or an expense to get started.
            </p>
          </li>
        )}
      </ul>

      {openExpense && <AddExpenseSheet onClose={() => setOpenExpense(false)} />}
      {openIncome && <AddIncomeSheet onClose={() => setOpenIncome(false)} />}
      {editing && (
        <EditExpenseSheet expense={editing} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

function AddExpenseSheet({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(amount);
    if (!title.trim() || Number.isNaN(num) || num <= 0) return;
    addExpense({ title, amount: num, type: "expense" });
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

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(amount);
    if (!title.trim() || Number.isNaN(num) || num <= 0) return;
    updateExpense(expense.id, { title, amount: num });
    onClose();
  };

  return (
    <Sheet title={expense.type === "income" ? "Edit income" : "Edit expense"} onClose={onClose}>
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
