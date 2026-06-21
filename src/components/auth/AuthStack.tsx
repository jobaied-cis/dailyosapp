import { useState } from "react";
import { useAuth } from "@/lib/auth-context";

type Screen = "welcome" | "intro" | "login" | "signup" | "profile";

type AuthStackProps = {
  initial?: Screen;
};

/**
 * AuthStack — flow controller for the onboarding/auth screens.
 * Renders one placeholder screen at a time. UI design lands later.
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

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm text-center space-y-4">{children}</div>
    </div>
  );
}

function Btn({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
    >
      {children}
    </button>
  );
}

function WelcomeScreen({ go }: GoProp) {
  return (
    <Shell>
      <h1 className="text-xl font-semibold">Welcome to DailyOS</h1>
      <div className="flex flex-col gap-2">
        <Btn onClick={() => go("signup")}>Start Journey</Btn>
        <Btn onClick={() => go("login")}>Login</Btn>
      </div>
    </Shell>
  );
}

function IntroSlides({ go }: GoProp) {
  return (
    <Shell>
      <h1 className="text-xl font-semibold">Intro Screen</h1>
      <Btn onClick={() => go("welcome")}>Next</Btn>
    </Shell>
  );
}

function LoginScreen({ go }: GoProp) {
  const { login } = useAuth();
  return (
    <Shell>
      <h1 className="text-xl font-semibold">Login Screen</h1>
      <div className="flex flex-col gap-2">
        <Btn onClick={() => login({ name: "Guest" })}>Login</Btn>
        <button
          onClick={() => go("welcome")}
          className="text-xs text-muted-foreground underline"
        >
          Back
        </button>
      </div>
    </Shell>
  );
}

function SignupScreen({ go }: GoProp) {
  return (
    <Shell>
      <h1 className="text-xl font-semibold">Signup Screen</h1>
      <Btn onClick={() => go("profile")}>Next</Btn>
    </Shell>
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
    <Shell>
      <h1 className="text-xl font-semibold">Profile Setup</h1>
      <Btn onClick={finish}>Finish</Btn>
    </Shell>
  );
}
