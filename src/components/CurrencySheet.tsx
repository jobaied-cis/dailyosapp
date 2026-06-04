import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useCurrency, setCurrency, type CurrencyCode, TAKA } from "@/lib/currency";

type Props = {
  children: React.ReactNode;
  className?: string;
  ariaLabel?: string;
};

export function CurrencyTrigger({ children, className, ariaLabel = "Change currency" }: Props) {
  const [open, setOpen] = useState(false);
  const current = useCurrency();
  const [draft, setDraft] = useState<CurrencyCode>(current);

  useEffect(() => {
    if (open) setDraft(current);
  }, [open, current]);

  const apply = () => {
    setCurrency(draft);
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={ariaLabel}
        className={
          className ??
          "press inline-flex items-center justify-center rounded-xl hover:bg-secondary/50 transition-colors"
        }
      >
        {children}
      </button>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="bg-card border-border/60 backdrop-blur-xl">
          <div className="px-6 pt-2 pb-6 max-w-md mx-auto w-full">
            <DrawerTitle className="text-xl font-extrabold tracking-tight text-foreground">
              Select currency
            </DrawerTitle>
            <DrawerDescription className="mt-1 text-sm text-muted-foreground">
              Only symbol changes — no conversion
            </DrawerDescription>

            <div className="mt-5 space-y-2.5">
              <Option
                label="Bangladeshi Taka"
                symbol={TAKA}
                code="BDT"
                selected={draft === "BDT"}
                onSelect={() => setDraft("BDT")}
              />
              <Option
                label="US Dollar"
                symbol="$"
                code="USD"
                selected={draft === "USD"}
                onSelect={() => setDraft("USD")}
              />
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="press h-12 rounded-2xl bg-secondary text-foreground font-bold text-sm hover:bg-secondary/80"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={apply}
                className="press h-12 rounded-2xl bg-primary text-primary-foreground font-bold text-sm shadow-md hover:bg-primary/90"
              >
                Apply currency
              </button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}

function Option({
  label,
  symbol,
  code,
  selected,
  onSelect,
}: {
  label: string;
  symbol: string;
  code: CurrencyCode;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full flex items-center gap-3 p-4 rounded-2xl border transition-all text-left ${
        selected
          ? "border-primary bg-primary/10 shadow-[0_0_0_1px_var(--primary)]"
          : "border-border/60 bg-secondary/40 hover:bg-secondary/70"
      }`}
    >
      <div
        className={`size-10 rounded-xl flex items-center justify-center font-extrabold text-base ${
          selected ? "bg-primary text-primary-foreground" : "bg-background text-foreground"
        }`}
      >
        {symbol}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-foreground leading-tight">{label}</p>
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground mt-0.5">
          {code}
        </p>
      </div>
      {selected && (
        <div className="size-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
          <Check className="size-4" strokeWidth={3} />
        </div>
      )}
    </button>
  );
}
