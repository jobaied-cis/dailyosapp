import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { AuthStack } from "@/components/auth/AuthStack";
import { SplashScreen } from "@/components/auth/SplashScreen";
import { InstallPrompt } from "@/components/InstallPrompt";
import { useEventsSync } from "@/lib/events-store";
import { useExpensesSync } from "@/lib/expenses-store";
import { runCloudMigrationOnce } from "@/lib/cloud-migrate";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "DailyOS — Your Life Operating System" },
      { name: "description", content: "DailyOS helps you plan your day, manage tasks, track expenses, and stay focused with smart insights — your all-in-one Life Operating System." },
      { name: "author", content: "DailyOS" },
      { name: "theme-color", content: "#378ADD" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "DailyOS" },
      { name: "mobile-web-app-capable", content: "yes" },
      { property: "og:title", content: "DailyOS — Your Life Operating System" },
      { property: "og:description", content: "DailyOS helps you plan your day, manage tasks, track expenses, and stay focused with smart insights — your all-in-one Life Operating System." },
      { property: "og:site_name", content: "DailyOS" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "DailyOS — Your Life Operating System" },
      { name: "twitter:description", content: "DailyOS helps you plan your day, manage tasks, track expenses, and stay focused with smart insights — your all-in-one Life Operating System." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/6QdRGqLQzeQbp5jPdtu1nzlVZZW2/social-images/social-1782306441976-DailyOs_branding_picture.webp" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/6QdRGqLQzeQbp5jPdtu1nzlVZZW2/social-images/social-1782306441976-DailyOs_branding_picture.webp" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/icon-192.png" },
      { rel: "icon", type: "image/png", sizes: "512x512", href: "/icon-512.png" },
      { rel: "apple-touch-icon", href: "/icon-192.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var t = localStorage.getItem('dailyos.theme');
                  var isDark = t === 'dark' ||
                    ((t === 'system' || !t) && window.matchMedia &&
                      window.matchMedia('(prefers-color-scheme: dark)').matches);
                  if (isDark) document.documentElement.classList.add('dark');
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body suppressHydrationWarning>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RootSwitch />
        <InstallPrompt />
        <Toaster position="top-center" />
      </AuthProvider>
    </QueryClientProvider>
  );
}

/**
 * Root navigation switch:
 *   loading      → Splash
 *   isFirstTime  → AuthStack (intro)
 *   !isLoggedIn  → AuthStack (welcome)
 *   else         → AppShell (routed Outlet)
 */
function RootSwitch() {
  const { loading, isFirstTime, isLoggedIn, userId, completeOnboarding } = useAuth();

  // Keep cloud stores in sync with the current session
  useEventsSync(userId);
  useExpensesSync(userId);

  // One-time migrate local data to cloud on first sign-in per user
  useEffect(() => {
    if (userId) void runCloudMigrationOnce(userId);
  }, [userId]);

  // Defensive: a signed-in user should never loop back to intro on refresh.
  useEffect(() => {
    if (isLoggedIn && isFirstTime) completeOnboarding();
  }, [isLoggedIn, isFirstTime, completeOnboarding]);

  if (loading) return <SplashScreen />;
  if (isLoggedIn) return <AppShell />;
  if (isFirstTime) return <AuthStack initial="intro" />;
  return <AuthStack initial="welcome" />;
}
