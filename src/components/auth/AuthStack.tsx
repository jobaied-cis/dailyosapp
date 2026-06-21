import { useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, Mail, Lock, User } from "lucide-react";
import { ListChecks, Target, CalendarDays, Wallet, ChevronRight } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

type Screen = "welcome" | "intro" | "login" | "signup" | "profile";

type AuthStackProps = {
  initial?: Screen;
};

/**
 * AuthStack — flow controller for the onboarding/auth screens.
 */
export function AuthStack({ initial = "welcome" }: AuthStackProps) {
  const [screen, setScreen] = useState<Screen>(initial);

  switch (screen) {
    case "intro":
      return <IntroSlides go={setScreen} />;
    case "login":
      return <LoginScreen go={setScreen} />;
    case "signup":
      return <SignupScreen go={setScreen} />;
    case "profile":
      return <ProfileSetupScreen />;
    case "welcome":
    default:
      return <WelcomeScreen go={setScreen} />;
  }
}

type GoProp = { go: (s: Screen) => void };

/* -------------------------------------------------------------------------- */
/*  Shared shell                                                              */
/* -------------------------------------------------------------------------- */

function Stage({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-dvh w-full flex justify-center px-6 py-10"
      style={{ background: "#0D1220", color: "white" }}
    >
      <div className="w-full max-w-md flex flex-col">{children}</div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Welcome                                                                   */
/* -------------------------------------------------------------------------- */

function WelcomeScreen({ go }: GoProp) {
  return (
    <Stage>
      <div className="flex-1 flex flex-col items-center justify-center text-center animate-fade-in">
        <div
          className="w-20 h-20 rounded-[20px] flex items-center justify-center mb-6"
          style={{
            background: "linear-gradient(135deg, #378ADD, #34D399)",
            boxShadow: "0 12px 40px -10px rgba(55,138,221,0.55)",
          }}
          aria-hidden
        >
          <svg viewBox="0 0 24 24" className="w-10 h-10" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="8" />
            <path d="M12 12 L17 9" />
          </svg>
        </div>

        <h1 className="text-3xl font-semibold tracking-tight">
          Daily<span style={{ color: "#378ADD" }}>OS</span>
        </h1>
        <p className="mt-2 text-sm text-white/60">Your Life Operating System</p>
      </div>

      <div className="flex flex-col gap-3 pb-4 animate-fade-in">
        <button
          onClick={() => go("signup")}
          className="w-full py-3.5 text-sm font-medium transition-all duration-200 active:scale-95"
          style={{
            background: "#378ADD",
            color: "white",
            borderRadius: 14,
            boxShadow: "0 10px 30px -12px rgba(55,138,221,0.6)",
          }}
        >
          Start your journey 🚀
        </button>
        <button
          onClick={() => go("login")}
          className="w-full py-3.5 text-sm font-medium transition-all duration-200 active:scale-95"
          style={{
            background: "transparent",
            color: "white",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 14,
          }}
        >
          I already use DailyOS
        </button>
      </div>
    </Stage>
  );
}

/* -------------------------------------------------------------------------- */
/*  Intro slides                                                              */
/* -------------------------------------------------------------------------- */

type Slide = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  tint: string;
};

const SLIDES: Slide[] = [
  { icon: ListChecks, title: "Smart Routine", desc: "Plan your day with AI and stay in control.", tint: "#378ADD" },
  { icon: Target, title: "AI Mission Planner", desc: "Set goals and auto-generate your journey.", tint: "#7F77DD" },
  { icon: CalendarDays, title: "Smart Events", desc: "Never miss important moments.", tint: "#34D399" },
  { icon: Wallet, title: "Expense Intelligence", desc: "Track and control your spending smartly.", tint: "#1D9E75" },
];

function IntroSlides({ go }: GoProp) {
  const { introProgress, setIntroProgress } = useAuth();
  const [index, setIndex] = useState<number>(() =>
    Math.min(Math.max(introProgress ?? 0, 0), SLIDES.length - 1),
  );

  useEffect(() => {
    setIntroProgress(index);
  }, [index, setIntroProgress]);

  const isLast = index === SLIDES.length - 1;
  const next = () => {
    if (isLast) go("welcome");
    else setIndex((i) => i + 1);
  };

  const slide = SLIDES[index];
  const Icon = slide.icon;

  return (
    <Stage>
      {/* Skip */}
      <div className="flex justify-end">
        <button
          onClick={() => go("welcome")}
          className="text-xs text-white/60 px-3 py-1.5 rounded-full transition-colors hover:text-white/90 active:scale-95"
        >
          Skip
        </button>
      </div>

      {/* Slide content */}
      <div
        key={index}
        className="flex-1 flex flex-col items-center justify-center text-center animate-fade-in"
      >
        <div
          className="w-24 h-24 rounded-[24px] flex items-center justify-center mb-8 intro-float"
          style={{
            background: `linear-gradient(135deg, ${slide.tint}33, ${slide.tint}11)`,
            border: `1px solid ${slide.tint}40`,
            boxShadow: `0 20px 50px -20px ${slide.tint}66`,
          }}
          aria-hidden
        >
          <Icon className="w-11 h-11" />
        </div>
        <h2 className="text-2xl font-semibold tracking-tight">{slide.title}</h2>
        <p className="mt-3 text-sm text-white/60 max-w-[18rem] leading-relaxed">
          {slide.desc}
        </p>
      </div>

      {/* Dots */}
      <div className="flex justify-center gap-2 pb-6">
        {SLIDES.map((_, i) => (
          <span
            key={i}
            className="rounded-full transition-all duration-300"
            style={{
              width: i === index ? 22 : 6,
              height: 6,
              background: i === index ? "#378ADD" : "rgba(255,255,255,0.2)",
            }}
          />
        ))}
      </div>

      {/* CTA */}
      <button
        onClick={next}
        className="w-full py-3.5 text-sm font-medium flex items-center justify-center gap-1.5 transition-all duration-200 active:scale-95"
        style={{
          background: "#378ADD",
          color: "white",
          borderRadius: 14,
          boxShadow: "0 10px 30px -12px rgba(55,138,221,0.6)",
        }}
      >
        {isLast ? "Start your system 🚀" : (
          <>
            Next <ChevronRight className="w-4 h-4" />
          </>
        )}
      </button>

      <style>{`
        @keyframes intro-float-kf {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        .intro-float { animation: intro-float-kf 3.2s ease-in-out infinite; }
      `}</style>
    </Stage>
  );
}

/* -------------------------------------------------------------------------- */
/*  Auth form primitives                                                      */
/* -------------------------------------------------------------------------- */

function Field({
  icon: Icon,
  type = "text",
  placeholder,
  value,
  onChange,
  trailing,
}: {
  icon: React.ComponentType<{ className?: string }>;
  type?: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  trailing?: React.ReactNode;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <label
      className="flex items-center gap-3 px-4 py-3 transition-all duration-200"
      style={{
        background: "#131B2E",
        border: `1px solid ${focused ? "#378ADD" : "rgba(255,255,255,0.08)"}`,
        borderRadius: 14,
        boxShadow: focused ? "0 0 0 4px rgba(55,138,221,0.18)" : "none",
      }}
    >
      <Icon className="w-4 h-4 text-white/40 shrink-0" />
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        className="flex-1 bg-transparent text-sm text-white placeholder:text-white/35 outline-none"
      />
      {trailing}
    </label>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full py-3.5 text-sm font-medium transition-all duration-200 active:scale-95 disabled:opacity-50"
      style={{
        background: "#378ADD",
        color: "white",
        borderRadius: 14,
        boxShadow: "0 10px 30px -12px rgba(55,138,221,0.6)",
      }}
    >
      {children}
    </button>
  );
}

function GoogleButton() {
  return (
    <button
      type="button"
      disabled
      className="w-full py-3 text-sm font-medium flex items-center justify-center gap-2 cursor-not-allowed opacity-60"
      style={{
        background: "transparent",
        color: "white",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 14,
      }}
    >
      <span
        className="w-4 h-4 rounded-full"
        style={{ background: "conic-gradient(#EA4335, #FBBC05, #34A853, #4285F4, #EA4335)" }}
        aria-hidden
      />
      Continue with Google
    </button>
  );
}

function Divider() {
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="flex-1 h-px bg-white/10" />
      <span className="text-[10px] uppercase tracking-widest text-white/40">or</span>
      <span className="flex-1 h-px bg-white/10" />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Login                                                                     */
/* -------------------------------------------------------------------------- */

function LoginScreen({ go }: GoProp) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);

  return (
    <Stage>
      <div className="flex-1 flex flex-col animate-fade-in">
        <div className="pt-6 pb-8">
          <h1 className="text-2xl font-semibold tracking-tight">Welcome back 🔥</h1>
          <p className="mt-1.5 text-sm text-white/55">Continue your system</p>
        </div>

        <div className="flex flex-col gap-3">
          <Field icon={Mail} type="email" placeholder="Email" value={email} onChange={setEmail} />
          <Field
            icon={Lock}
            type={show ? "text" : "password"}
            placeholder="Password"
            value={password}
            onChange={setPassword}
            trailing={
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="text-white/40 hover:text-white/80 transition-colors"
                aria-label={show ? "Hide password" : "Show password"}
              >
                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            }
          />

          <button className="self-end text-xs text-white/55 hover:text-white/80 transition-colors">
            Forgot password?
          </button>
        </div>

        <div className="mt-6 flex flex-col gap-3">
          <PrimaryButton onClick={() => login({ name: email.split("@")[0] || "Guest" })}>
            Continue your system →
          </PrimaryButton>
          <Divider />
          <GoogleButton />
        </div>

        <div className="mt-auto pt-8 text-center text-sm text-white/55">
          Don't have an account?{" "}
          <button
            onClick={() => go("signup")}
            className="text-white font-medium hover:underline"
          >
            Sign up
          </button>
        </div>
      </div>
    </Stage>
  );
}

/* -------------------------------------------------------------------------- */
/*  Signup                                                                    */
/* -------------------------------------------------------------------------- */

function passwordScore(pw: string): 0 | 1 | 2 | 3 {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  return Math.min(score, 3) as 0 | 1 | 2 | 3;
}

function SignupScreen({ go }: GoProp) {
  const { setUserProfile } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);

  const score = useMemo(() => passwordScore(password), [password]);
  const meter = [
    { label: "Weak", color: "#EF4444", emoji: "🔴" },
    { label: "Weak", color: "#EF4444", emoji: "🔴" },
    { label: "Good", color: "#F59E0B", emoji: "🟡" },
    { label: "Strong 💪", color: "#22C55E", emoji: "🟢" },
  ][score];

  const next = () => {
    // Carry partial profile into ProfileSetup; logic unchanged.
    setUserProfile({ name: name || undefined });
    go("profile");
  };

  return (
    <Stage>
      <div className="flex-1 flex flex-col animate-fade-in">
        <div className="pt-6 pb-8">
          <h1 className="text-2xl font-semibold tracking-tight">Create your system 🚀</h1>
          <p className="mt-1.5 text-sm text-white/55">A few seconds to set things up</p>
        </div>

        <div className="flex flex-col gap-3">
          <Field icon={User} placeholder="Name" value={name} onChange={setName} />
          <Field icon={Mail} type="email" placeholder="Email" value={email} onChange={setEmail} />
          <Field
            icon={Lock}
            type={show ? "text" : "password"}
            placeholder="Password"
            value={password}
            onChange={setPassword}
            trailing={
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="text-white/40 hover:text-white/80 transition-colors"
                aria-label={show ? "Hide password" : "Show password"}
              >
                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            }
          />

          {/* Strength meter */}
          <div className="px-1 pt-1">
            <div className="flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="flex-1 h-1 rounded-full transition-colors duration-200"
                  style={{
                    background:
                      score > i ? meter.color : "rgba(255,255,255,0.08)",
                  }}
                />
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-white/50">
              {password
                ? `${meter.emoji} ${meter.label}`
                : "Use 8+ chars with a number & uppercase"}
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3">
          <PrimaryButton onClick={next}>Create your system 🚀</PrimaryButton>
          <Divider />
          <GoogleButton />
        </div>

        <div className="mt-auto pt-8 text-center text-sm text-white/55">
          Already have an account?{" "}
          <button
            onClick={() => go("login")}
            className="text-white font-medium hover:underline"
          >
            Login
          </button>
        </div>
      </div>
    </Stage>
  );
}

function ProfileSetupScreen() {
  const { setUserProfile, login, completeOnboarding } = useAuth();
  const finish = () => {
    setUserProfile({ name: "Guest", currency: "BDT", priorities: [] });
    login();
    completeOnboarding();
  };
  return (
    <Stage>
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
        <h1 className="text-xl font-semibold">Profile Setup</h1>
        <button
          onClick={finish}
          className="w-full py-3 text-sm font-medium active:scale-95 transition-transform"
          style={{ background: "#378ADD", color: "white", borderRadius: 14 }}
        >
          Finish
        </button>
      </div>
    </Stage>
  );
}
