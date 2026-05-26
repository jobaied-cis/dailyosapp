import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  useExpenses,
  addExpense,
  updateExpense,
  deleteExpense,
} from "@/lib/expenses-store";
import { Plus, Trash2, Wallet, X, Pencil } from "lucide-react";

export const Route = createFileRoute("/expenses")({
  head: () => ({
    meta: [
      { title: "Expenses — DailyOS" },
      { name: "description", content: "Track your daily expenses." },
    ],
  }),
  component: ExpensesPage,
});

function ExpensesPage() {
  const expenses = useExpenses();
  const [open, setOpen] = useState(false);
  const total = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="space-y-6">
      {/* Total */}
      <section className="bg-card border border-border/60 rounded-[1.75rem] p-6 shadow-[0_8px_32px_-12px_rgba(15,23,42,0.08)] text-center">
        <div className="inline-flex items-center justify-center size-14 rounded-full bg-primary/10 mb-4">
          <Wallet className="size-7 text-primary" />
        </div>
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Total Expense</p>
        <p className="text-3xl font-extrabold text-foreground mt-1 tracking-tight">${total.toFixed(2)}</p>
      </section>

      {/* List */}
      <ul className="space-y-3">
        {expenses.map((e, i) => (
          <li
            key={e.id}
            style={{ animationDelay: `${Math.min(i * 40, 240)}ms` }}
            className="group flex items-center justify-between bg-card border border-border/60 rounded-[1.25rem] p-4 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)] animate-list-item-in transition-all duration-300 hover:shadow-[0_4px_20px_-6px_rgba(15,23,42,0.1)]"
          >
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground text-[0.95rem]">{e.title}</h3>
              <p className="text-sm font-mono font-medium text-muted-foreground mt-0.5">${e.amount.toFixed(2)}</p>
            </div>
            <button
              onClick={() => deleteExpense(e.id)}
              aria-label="Delete expense"
              className="press text-muted-foreground/40 hover:text-destructive p-1.5 rounded-full hover:bg-destructive/5"
            >
              <Trash2 className="size-4" />
            </button>
          </li>
        ))}
        {expenses.length === 0 && (
          <li className="text-center text-muted-foreground py-16">
            <div className="inline-flex items-center justify-center size-16 rounded-full bg-secondary mb-5">
              <Wallet className="size-7 text-muted-foreground" />
            </div>
            <p className="text-base font-semibold text-foreground">No expenses yet</p>
            <p className="text-sm text-muted-foreground mt-1.5">Add your first expense to get started.</p>
          </li>
        )}
      </ul>

      {/* Add button */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Add expense"
        className="press fixed bottom-24 right-1/2 translate-x-[calc(50%+7.5rem)] size-14 rounded-full bg-primary text-primary-foreground shadow-[0_8px_28px_-6px_rgba(37,99,235,0.45)] flex items-center justify-center hover:shadow-[0_12px_36px_-6px_rgba(37,99,235,0.55)]"
      >
        <Plus className="size-6" strokeWidth={2.5} />
      </button>

      {open && <AddExpenseSheet onClose={() => setOpen(false)} />}
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
    addExpense({ title, amount: num });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/25 backdrop-blur-md">
      <div className="w-full max-w-md bg-card rounded-t-[1.75rem] p-6 shadow-[0_-8px_40px_-8px_rgba(15,23,42,0.15)] animate-in slide-in-from-bottom duration-300">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-foreground tracking-tight">New expense</h3>
          <button onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground p-1.5 rounded-full hover:bg-secondary transition-colors">
            <X className="size-5" />
          </button>
        </div>
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
