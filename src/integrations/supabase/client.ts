import { createClient } from "@supabase/supabase-js";

// Publishable / anon keys are safe in client code.
const SUPABASE_URL = "https://oibsmwpzthxrliiyqxyv.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_u6kcCG3ycq-EH4_P435ZYA_oNFngi87";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
    storageKey: "dailyos.supabase.auth",
  },
});
