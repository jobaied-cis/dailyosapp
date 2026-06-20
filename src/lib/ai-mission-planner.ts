// AI Mission Planner — template-based plan generator.
// No network. Deterministic-ish with light randomness so "Regenerate" varies output.
// Safe to swap with a real AI call later — keep the same return shape.

export type Difficulty = "Beginner" | "Intermediate";

export interface PlannedDay {
  day: number;
  title: string;
  tasks: string[];
}

export interface GeneratedPlan {
  days: PlannedDay[];
}

export interface GeneratePlanInput {
  goal: string;
  days: number;
  difficulty?: Difficulty;
}

type Category =
  | "learn"
  | "build"
  | "study"
  | "workout"
  | "language"
  | "read"
  | "generic";

const CATEGORY_KEYWORDS: Record<Exclude<Category, "generic">, string[]> = {
  learn: ["learn", "master", "understand", "course"],
  build: ["build", "create", "make", "develop", "ship", "launch", "design"],
  study: ["study", "exam", "revise", "prepare", "test", "quiz"],
  workout: ["workout", "fitness", "gym", "run", "exercise", "yoga", "weight"],
  language: [
    "spanish",
    "french",
    "german",
    "japanese",
    "korean",
    "chinese",
    "english",
    "arabic",
    "italian",
    "language",
  ],
  read: ["read", "book", "novel", "chapter"],
};

function detectCategory(goal: string): Category {
  const g = goal.toLowerCase();
  for (const key of Object.keys(CATEGORY_KEYWORDS) as Array<
    Exclude<Category, "generic">
  >) {
    if (CATEGORY_KEYWORDS[key].some((k) => g.includes(k))) return key;
  }
  return "generic";
}

function extractTopic(goal: string): string {
  // Strip leading verbs + trailing duration phrases for a cleaner topic noun.
  let t = goal.trim();
  t = t.replace(
    /^(learn|master|build|create|study|prepare|read|practice|do|start|finish|complete)\s+/i,
    "",
  );
  t = t.replace(/\s+in\s+\d+\s*(day|days|week|weeks|month|months)\s*$/i, "");
  t = t.replace(/\s+for\s+\d+\s*(day|days|week|weeks)\s*$/i, "");
  return t.trim() || goal.trim();
}

function pick<T>(arr: T[], rnd: () => number): T {
  return arr[Math.floor(rnd() * arr.length)];
}

function shuffle<T>(arr: T[], rnd: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Phase label for a given day index out of total days.
// Foundations → Practice → Apply → Review
function phaseFor(dayIdx: number, total: number): "Foundations" | "Practice" | "Apply" | "Review" {
  if (total === 1) return "Apply";
  const ratio = dayIdx / Math.max(1, total - 1);
  if (ratio < 0.3) return "Foundations";
  if (ratio < 0.65) return "Practice";
  if (ratio < 0.9) return "Apply";
  return "Review";
}

const TITLES: Record<Category, Record<string, string[]>> = {
  learn: {
    Foundations: ["Foundations of {t}", "Getting started with {t}", "Core concepts of {t}"],
    Practice: ["Hands-on with {t}", "Practicing {t}", "Drills: {t}"],
    Apply: ["Apply {t} to a mini project", "Build with {t}", "Real-world {t}"],
    Review: ["Review & consolidate {t}", "Recap: {t}", "Polish your {t} skills"],
  },
  build: {
    Foundations: ["Plan & scope {t}", "Setup for {t}", "Architecture of {t}"],
    Practice: ["Core build: {t}", "Iterate on {t}", "Feature work on {t}"],
    Apply: ["Polish {t}", "Integrate {t}", "Test {t} end-to-end"],
    Review: ["Ship {t}", "Final review of {t}", "Launch {t}"],
  },
  study: {
    Foundations: ["Overview of {t}", "Key concepts: {t}", "Syllabus map: {t}"],
    Practice: ["Practice problems: {t}", "Drill {t}", "Active recall: {t}"],
    Apply: ["Mock test: {t}", "Past papers: {t}", "Timed practice: {t}"],
    Review: ["Final revision: {t}", "Weak-spot review: {t}", "Recap: {t}"],
  },
  workout: {
    Foundations: ["Warm-up & form: {t}", "Mobility base: {t}", "Baseline test: {t}"],
    Practice: ["Strength day: {t}", "Cardio session: {t}", "Skill work: {t}"],
    Apply: ["Push day: {t}", "Intensity session: {t}", "Challenge set: {t}"],
    Review: ["Active recovery: {t}", "Deload & review: {t}", "Progress check: {t}"],
  },
  language: {
    Foundations: ["Alphabet & sounds: {t}", "Greetings & basics: {t}", "Core grammar: {t}"],
    Practice: ["Vocabulary drills: {t}", "Listening practice: {t}", "Speaking practice: {t}"],
    Apply: ["Conversation: {t}", "Write a short text in {t}", "Watch & note: {t}"],
    Review: ["Review vocabulary: {t}", "Recap grammar: {t}", "Self-test: {t}"],
  },
  read: {
    Foundations: ["Start {t}", "Opening chapters: {t}", "Set reading pace: {t}"],
    Practice: ["Read & note: {t}", "Deep read: {t}", "Annotate {t}"],
    Apply: ["Discuss {t}", "Summarize sections of {t}", "Reflect on {t}"],
    Review: ["Final chapters: {t}", "Recap {t}", "Key takeaways: {t}"],
  },
  generic: {
    Foundations: ["Kickoff: {t}", "Plan {t}", "Foundations: {t}"],
    Practice: ["Work on {t}", "Practice: {t}", "Build momentum: {t}"],
    Apply: ["Push on {t}", "Apply {t}", "Deep work: {t}"],
    Review: ["Review {t}", "Wrap up {t}", "Reflect on {t}"],
  },
};

const TASKS: Record<Category, Record<string, string[]>> = {
  learn: {
    Foundations: [
      "Read intro material on {t}",
      "Watch a beginner overview of {t}",
      "Take notes on key terms of {t}",
      "Set up tools/environment for {t}",
    ],
    Practice: [
      "Complete 3 exercises on {t}",
      "Follow a hands-on tutorial for {t}",
      "Solve a small problem using {t}",
      "Review yesterday's notes on {t}",
    ],
    Apply: [
      "Start a mini project using {t}",
      "Apply {t} to a real example",
      "Refactor or improve your {t} work",
      "Document what you've built with {t}",
    ],
    Review: [
      "Summarize what you learned about {t}",
      "Re-do the hardest exercise in {t}",
      "Teach {t} back in your own words",
      "Plan next steps after {t}",
    ],
  },
  build: {
    Foundations: [
      "Define scope & goals for {t}",
      "Sketch the structure of {t}",
      "Set up the project for {t}",
      "List required tools for {t}",
    ],
    Practice: [
      "Implement the core of {t}",
      "Add a key feature to {t}",
      "Fix the most blocking issue in {t}",
      "Refine the UI/UX of {t}",
    ],
    Apply: [
      "Test {t} end-to-end",
      "Get feedback on {t}",
      "Polish rough edges in {t}",
      "Write a short README for {t}",
    ],
    Review: [
      "Final QA pass on {t}",
      "Ship or publish {t}",
      "Review what worked in {t}",
      "Plan v2 of {t}",
    ],
  },
  study: {
    Foundations: [
      "Skim the full syllabus of {t}",
      "Identify weak areas in {t}",
      "Prepare notes structure for {t}",
      "Read chapter 1 of {t}",
    ],
    Practice: [
      "Do 10 practice questions on {t}",
      "Active recall session on {t}",
      "Make flashcards for {t}",
      "Review yesterday's mistakes in {t}",
    ],
    Apply: [
      "Take a timed mock test on {t}",
      "Solve a past paper on {t}",
      "Explain {t} out loud",
      "Group similar problems in {t}",
    ],
    Review: [
      "Revise weakest topics in {t}",
      "Quick recap of all chapters in {t}",
      "Self-test on {t}",
      "Sleep early before {t}",
    ],
  },
  workout: {
    Foundations: [
      "10-min warm-up",
      "Mobility & stretching",
      "Light technique work",
      "Log baseline stats",
    ],
    Practice: [
      "Strength: 3 sets compound lifts",
      "20-min cardio",
      "Core circuit",
      "Cooldown stretch",
    ],
    Apply: [
      "Push intensity by 10%",
      "Try a new exercise variation",
      "Time a benchmark workout",
      "Hydrate & track macros",
    ],
    Review: [
      "Light recovery walk",
      "Foam roll & stretch",
      "Log weekly progress",
      "Plan next week's split",
    ],
  },
  language: {
    Foundations: [
      "Learn the alphabet/sounds of {t}",
      "Memorize 10 basic greetings in {t}",
      "Study core sentence structure in {t}",
      "Install a {t} learning app",
    ],
    Practice: [
      "Learn 15 new {t} words",
      "10-min listening in {t}",
      "Speak out loud for 5 min in {t}",
      "Write 3 sentences in {t}",
    ],
    Apply: [
      "Hold a short conversation in {t}",
      "Watch a short video in {t} with notes",
      "Write a short paragraph in {t}",
      "Describe your day in {t}",
    ],
    Review: [
      "Review all new {t} vocabulary",
      "Recap grammar rules of {t}",
      "Self-test on {t}",
      "Plan next phase of {t}",
    ],
  },
  read: {
    Foundations: [
      "Read the first chapter of {t}",
      "Set a daily page goal for {t}",
      "Prepare notes for {t}",
      "Skim the table of contents of {t}",
    ],
    Practice: [
      "Read 1 chapter of {t}",
      "Highlight key ideas in {t}",
      "Write a short summary of today's {t} reading",
      "Look up unknown words from {t}",
    ],
    Apply: [
      "Discuss {t} with someone",
      "Write a reflection on {t}",
      "Apply one idea from {t}",
      "Share a quote from {t}",
    ],
    Review: [
      "Finish the final chapters of {t}",
      "Write a one-page recap of {t}",
      "List top 3 takeaways from {t}",
      "Rate & shelve {t}",
    ],
  },
  generic: {
    Foundations: [
      "Define what success looks like for {t}",
      "List the first 3 steps for {t}",
      "Block focus time for {t}",
      "Remove one obstacle to {t}",
    ],
    Practice: [
      "Spend 30 min on {t}",
      "Complete one small piece of {t}",
      "Review yesterday's progress on {t}",
      "Avoid distractions while doing {t}",
    ],
    Apply: [
      "Push harder on {t}",
      "Share progress on {t}",
      "Tackle the hardest part of {t}",
      "Refine your output for {t}",
    ],
    Review: [
      "Recap progress on {t}",
      "Note lessons learned from {t}",
      "Plan what's next after {t}",
      "Celebrate finishing {t}",
    ],
  },
};

// Small seeded RNG so each generate is varied but stable within a call.
function mulberry32(seed: number) {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generatePlan(input: GeneratePlanInput): GeneratedPlan {
  const goal = (input.goal || "").trim();
  const days = Math.max(1, Math.min(60, Math.floor(input.days) || 1));
  const difficulty: Difficulty = input.difficulty === "Intermediate" ? "Intermediate" : "Beginner";
  const tasksPerDay = difficulty === "Intermediate" ? 3 : 2;

  const category = detectCategory(goal);
  const topic = extractTopic(goal) || "your goal";
  const rnd = mulberry32(Date.now() ^ Math.floor(Math.random() * 1e9));

  const fill = (s: string) => s.replace(/\{t\}/g, topic);

  const out: PlannedDay[] = [];
  for (let i = 0; i < days; i++) {
    const phase = phaseFor(i, days);
    const titlePool = TITLES[category][phase];
    const taskPool = shuffle(TASKS[category][phase], rnd);
    const title = fill(pick(titlePool, rnd));
    const tasks: string[] = [];
    for (let k = 0; k < Math.min(tasksPerDay, 3) && k < taskPool.length; k++) {
      tasks.push(fill(taskPool[k]));
    }
    out.push({ day: i + 1, title, tasks });
  }
  return { days: out };
}
