import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, Check } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { CurrencyTrigger } from "@/components/CurrencySheet";
import { useCurrency, TAKA } from "@/lib/currency";

export const Route = createFileRoute("/edit-profile")({
  head: () => ({
    meta: [
      { title: "Edit Profile — DailyOS" },
      { name: "description", content: "Update your DailyOS profile." },
    ],
  }),
  component: EditProfilePage,
});

const AVATAR_OPTIONS = ["🙂", "😎", "🚀", "🔥", "🌟", "🧠", "💡", "🎯", "📚", "💪"];

function EditProfilePage() {
  const navigate = useNavigate();
  const { userProfile, setUserProfile } = useAuth();
  const currency = useCurrency();

  const [name, setName] = useState(userProfile?.name ?? "");
  const [avatar, setAvatar] = useState(userProfile?.avatar ?? "🙂");

  const currencySymbol = currency === "USD" ? "$" : TAKA;

  const handleSave = () => {
    setUserProfile({
      ...(userProfile ?? {}),
      name: name.trim() || "Your name",
      avatar,
      currency,
    });
    navigate({ to: "/settings" });
  };


  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={() => navigate({ to: "/settings" })}
          aria-label="Back"
          className="size-10 inline-flex items-center justify-center rounded-xl border border-border/60 bg-card text-foreground active:scale-[0.96] hover:bg-secondary/40 transition-all"
        >
          <ChevronLeft className="size-[18px]" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-[22px] font-bold tracking-tight leading-none">Edit Profile</h1>
          <p className="text-[13px] text-muted-foreground leading-snug mt-1.5">
            Personalize your system
          </p>
        </div>
      </div>

      {/* Avatar */}
      <section className="rounded-[14px] border border-border/60 bg-card p-4 space-y-3 shadow-sm">
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          Avatar
        </h2>
        <div className="flex items-center gap-3">
          <div
            className="size-16 rounded-full flex items-center justify-center text-3xl border border-primary/30 bg-gradient-to-br from-primary/15 to-primary/5 shadow-inner"
            aria-hidden
          >
            {avatar}
          </div>
          <p className="text-[12px] text-muted-foreground">Pick one that feels like you</p>
        </div>
        <div className="grid grid-cols-5 gap-2">
          {AVATAR_OPTIONS.map((emoji) => {
            const selected = emoji === avatar;
            return (
              <button
                key={emoji}
                type="button"
                onClick={() => setAvatar(emoji)}
                className={`aspect-square rounded-[12px] text-2xl flex items-center justify-center border transition-all active:scale-[0.94] ${
                  selected
                    ? "border-primary bg-primary/15 shadow-[0_0_0_1px_var(--primary)]"
                    : "border-border/60 bg-background/40 hover:bg-secondary/50"
                }`}
              >
                {emoji}
              </button>
            );
          })}
        </div>
      </section>

      {/* Name */}
      <section className="rounded-[14px] border border-border/60 bg-card p-4 space-y-3 shadow-sm">
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          Name
        </h2>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          maxLength={40}
          className="w-full h-12 rounded-[12px] border border-border/60 bg-background px-4 text-[14px] font-medium text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/60 focus:bg-background transition-all"
        />
      </section>

      {/* Currency */}
      <section className="rounded-[14px] border border-border/60 bg-card p-4 space-y-3 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Currency
          </h2>
          <span className="text-[11px] text-muted-foreground/80">
            {currencySymbol} {currency}
          </span>
        </div>
        <CurrencyTrigger
          ariaLabel="Change currency"
          className="w-full h-12 rounded-[12px] border border-border/60 bg-background hover:bg-secondary/40 text-[13px] font-semibold text-foreground flex items-center justify-between px-4 active:scale-[0.96] transition-all"
        >
          <span className="inline-flex items-center gap-2">
            {currencySymbol} {currency}
          </span>
          <span className="text-[12px] text-muted-foreground">Change</span>
        </CurrencyTrigger>
      </section>

      {/* Save */}
      <button
        onClick={handleSave}
        className="w-full h-12 rounded-[12px] bg-primary hover:bg-primary/90 text-primary-foreground text-[14px] font-bold flex items-center justify-center gap-2 shadow-md shadow-primary/20 active:scale-[0.97] transition-all"
      >
        <Check className="size-4" />
        Save changes
      </button>
    </div>
  );
}
