// AI Mission Planner — structured, topic-aware plan generator.
// No network. Produces a Foundations → Practice → Apply → Review arc
// with unique day titles and specific, actionable tasks.
//
// Safe to swap with a real AI call later — keep the return shape.

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

type Phase = "Foundations" | "Practice" | "Apply" | "Review";

interface DaySpec {
  title: string;
  tasks: string[];
  phase: Phase;
}

interface Curriculum {
  // Ordered pool of day specs. We pick/stretch/compress to match `days`.
  foundations: DaySpec[];
  practice: DaySpec[];
  apply: DaySpec[];
  review: DaySpec[];
}

// ---------- Topic detection ----------

type TopicKey =
  | "python"
  | "javascript"
  | "react"
  | "typescript"
  | "html_css"
  | "sql"
  | "language"
  | "workout"
  | "running"
  | "reading"
  | "writing"
  | "study"
  | "build"
  | "generic";

const TOPIC_RULES: Array<{ key: TopicKey; patterns: RegExp[] }> = [
  { key: "python", patterns: [/\bpython\b/i, /\bdjango\b/i, /\bflask\b/i] },
  { key: "javascript", patterns: [/\bjavascript\b/i, /\bjs\b/i, /\bnode(\.js)?\b/i] },
  { key: "typescript", patterns: [/\btypescript\b/i, /\bts\b/i] },
  { key: "react", patterns: [/\breact\b/i, /\bnext\.?js\b/i] },
  { key: "html_css", patterns: [/\bhtml\b/i, /\bcss\b/i, /\btailwind\b/i] },
  { key: "sql", patterns: [/\bsql\b/i, /\bpostgres\b/i, /\bmysql\b/i, /\bdatabase\b/i] },
  {
    key: "language",
    patterns: [
      /\b(spanish|french|german|japanese|korean|chinese|english|arabic|italian|portuguese|russian)\b/i,
      /\blanguage\b/i,
    ],
  },
  { key: "workout", patterns: [/\b(workout|gym|fitness|strength|yoga|exercise)\b/i] },
  { key: "running", patterns: [/\b(run|running|5k|10k|marathon|jog)\b/i] },
  { key: "reading", patterns: [/\b(read|book|novel|chapter)\b/i] },
  { key: "writing", patterns: [/\b(write|writing|essay|blog|journal)\b/i] },
  { key: "study", patterns: [/\b(exam|study|revise|test|quiz|midterm|final)\b/i] },
  { key: "build", patterns: [/\b(build|ship|launch|create|make|develop|design)\b/i] },
];

function detectTopic(goal: string): TopicKey {
  for (const r of TOPIC_RULES) {
    if (r.patterns.some((p) => p.test(goal))) return r.key;
  }
  return "generic";
}

// ---------- RNG / helpers ----------

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

function extractTopicNoun(goal: string): string {
  let t = goal.trim();
  t = t.replace(
    /^(learn|master|build|create|study|prepare|read|practice|do|start|finish|complete|improve)\s+/i,
    "",
  );
  t = t.replace(/\s+in\s+\d+\s*(day|days|week|weeks|month|months)\s*$/i, "");
  t = t.replace(/\s+for\s+\d+\s*(day|days|week|weeks)\s*$/i, "");
  return t.trim() || goal.trim() || "your goal";
}

function titleCase(s: string): string {
  return s
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

// ---------- Curricula ----------

const PYTHON: Curriculum = {
  foundations: [
    {
      phase: "Foundations",
      title: "Setup & First Steps",
      tasks: [
        "Install Python and a code editor (VS Code)",
        "Run your first 'Hello, World!' script",
        "Learn how to use the REPL",
      ],
    },
    {
      phase: "Foundations",
      title: "Variables & Data Types",
      tasks: [
        "Learn variables, strings, ints and floats",
        "Practice type conversion (int, str, float)",
        "Write a script that asks for your name and age",
      ],
    },
    {
      phase: "Foundations",
      title: "Control Flow & Loops",
      tasks: [
        "Learn if / elif / else statements",
        "Practice for and while loops",
        "Solve 5 small loop problems",
      ],
    },
  ],
  practice: [
    {
      phase: "Practice",
      title: "Functions & Scope",
      tasks: [
        "Write 3 functions with parameters and return values",
        "Refactor a previous script into functions",
        "Learn about default arguments",
      ],
    },
    {
      phase: "Practice",
      title: "Lists, Dicts & Strings",
      tasks: [
        "Practice list and dict operations",
        "Solve 5 string manipulation problems",
        "Build a small contacts dictionary",
      ],
    },
    {
      phase: "Practice",
      title: "Files & Error Handling",
      tasks: [
        "Read and write to a text file",
        "Use try/except to handle errors",
        "Build a script that logs notes to a file",
      ],
    },
  ],
  apply: [
    {
      phase: "Apply",
      title: "Mini Project: CLI Tool",
      tasks: [
        "Plan a small CLI tool (todo, calculator, quiz)",
        "Implement the core feature",
        "Test it with at least 3 inputs",
      ],
    },
    {
      phase: "Apply",
      title: "Add Features & Polish",
      tasks: [
        "Add one new feature to your project",
        "Improve user prompts and output",
        "Handle invalid input gracefully",
      ],
    },
    {
      phase: "Apply",
      title: "Refactor & Clean Up",
      tasks: [
        "Split code into multiple functions/files",
        "Add comments and a short README",
        "Remove unused code",
      ],
    },
  ],
  review: [
    {
      phase: "Review",
      title: "Recap & Weak Spots",
      tasks: [
        "List 3 topics you still find hard",
        "Re-do the hardest exercise from earlier",
        "Write a short summary of what you learned",
      ],
    },
    {
      phase: "Review",
      title: "Showcase & Next Steps",
      tasks: [
        "Share your project with a friend or online",
        "Plan your next Python topic (OOP, web, data)",
        "Bookmark 3 resources to continue learning",
      ],
    },
  ],
};

const JAVASCRIPT: Curriculum = {
  foundations: [
    {
      phase: "Foundations",
      title: "Setup & First Script",
      tasks: [
        "Install Node.js and VS Code",
        "Run your first .js file from the terminal",
        "Try a few expressions in the browser console",
      ],
    },
    {
      phase: "Foundations",
      title: "Variables & Types",
      tasks: [
        "Learn let, const and basic types",
        "Practice template literals",
        "Write a script that greets a user by name",
      ],
    },
    {
      phase: "Foundations",
      title: "Conditions & Loops",
      tasks: [
        "Practice if/else and switch",
        "Use for, while and for...of loops",
        "Solve 5 small array problems",
      ],
    },
  ],
  practice: [
    {
      phase: "Practice",
      title: "Functions & Arrow Syntax",
      tasks: [
        "Write 3 functions (regular and arrow)",
        "Practice map, filter and reduce",
        "Refactor a previous script to use functions",
      ],
    },
    {
      phase: "Practice",
      title: "Objects & Arrays",
      tasks: [
        "Build a small dataset as an array of objects",
        "Practice destructuring and spread",
        "Sort and filter your dataset",
      ],
    },
    {
      phase: "Practice",
      title: "DOM & Events",
      tasks: [
        "Select elements and update text in the DOM",
        "Handle a click and an input event",
        "Build a tiny counter or toggle widget",
      ],
    },
  ],
  apply: [
    {
      phase: "Apply",
      title: "Mini Project Kickoff",
      tasks: [
        "Plan a small app (todo, notes, quiz)",
        "Sketch the UI on paper",
        "Set up the project files",
      ],
    },
    {
      phase: "Apply",
      title: "Build Core Features",
      tasks: [
        "Implement the main feature end-to-end",
        "Save data to localStorage",
        "Handle empty and error states",
      ],
    },
    {
      phase: "Apply",
      title: "Polish & Deploy",
      tasks: [
        "Improve styling and spacing",
        "Test on mobile width",
        "Deploy to Netlify, Vercel or GitHub Pages",
      ],
    },
  ],
  review: [
    {
      phase: "Review",
      title: "Recap & Gaps",
      tasks: [
        "List 3 JS concepts you want to revisit",
        "Re-solve your hardest exercise",
        "Write a short reflection on your project",
      ],
    },
    {
      phase: "Review",
      title: "What's Next",
      tasks: [
        "Pick a next topic (React, Node, TS)",
        "Bookmark 3 resources to continue",
        "Share your project for feedback",
      ],
    },
  ],
};

const REACT: Curriculum = {
  foundations: [
    {
      phase: "Foundations",
      title: "Setup & First Component",
      tasks: [
        "Create a Vite + React project",
        "Render your first component",
        "Understand JSX basics",
      ],
    },
    {
      phase: "Foundations",
      title: "Props & State",
      tasks: [
        "Pass props between components",
        "Use useState in a small example",
        "Build a counter component",
      ],
    },
    {
      phase: "Foundations",
      title: "Lists & Conditional UI",
      tasks: [
        "Render a list with .map and keys",
        "Show/hide UI with conditional rendering",
        "Build a simple filterable list",
      ],
    },
  ],
  practice: [
    {
      phase: "Practice",
      title: "Forms & Inputs",
      tasks: [
        "Build a controlled input form",
        "Validate one field",
        "Reset the form on submit",
      ],
    },
    {
      phase: "Practice",
      title: "Effects & Data",
      tasks: [
        "Use useEffect to load data on mount",
        "Fetch from a public API",
        "Handle loading and error states",
      ],
    },
    {
      phase: "Practice",
      title: "Component Composition",
      tasks: [
        "Split a page into 3 reusable components",
        "Lift state up to a parent",
        "Pass callbacks down via props",
      ],
    },
  ],
  apply: [
    {
      phase: "Apply",
      title: "Mini App Kickoff",
      tasks: [
        "Plan a small app (todo, notes, weather)",
        "Sketch the component tree",
        "Set up routing if needed",
      ],
    },
    {
      phase: "Apply",
      title: "Build Core Features",
      tasks: [
        "Implement the main flow end-to-end",
        "Persist data to localStorage",
        "Handle empty and error states",
      ],
    },
    {
      phase: "Apply",
      title: "Polish & Deploy",
      tasks: [
        "Improve styling and spacing",
        "Test on mobile width",
        "Deploy to Vercel or Netlify",
      ],
    },
  ],
  review: [
    {
      phase: "Review",
      title: "Recap & Gaps",
      tasks: [
        "List 3 React topics to revisit",
        "Refactor your weakest component",
        "Write a short project reflection",
      ],
    },
    {
      phase: "Review",
      title: "What's Next",
      tasks: [
        "Pick a next topic (React Query, Router, Zustand)",
        "Bookmark 3 high-quality resources",
        "Share your project for feedback",
      ],
    },
  ],
};

const TYPESCRIPT: Curriculum = {
  foundations: [
    {
      phase: "Foundations",
      title: "Setup & First Types",
      tasks: ["Install TypeScript and tsconfig basics", "Annotate variables and functions", "Run your first .ts file"],
    },
    {
      phase: "Foundations",
      title: "Interfaces & Types",
      tasks: ["Create interfaces for simple objects", "Use type aliases and unions", "Practice optional and readonly fields"],
    },
    {
      phase: "Foundations",
      title: "Generics Basics",
      tasks: ["Write a generic function", "Use generics with arrays", "Type a simple wrapper component or util"],
    },
  ],
  practice: [
    {
      phase: "Practice",
      title: "Narrowing & Guards",
      tasks: ["Practice typeof and in narrowing", "Write a custom type guard", "Refactor an any-heavy file"],
    },
    {
      phase: "Practice",
      title: "Utility Types",
      tasks: ["Use Partial, Pick, Omit on real data", "Create a Record-based map", "Build a typed config object"],
    },
    {
      phase: "Practice",
      title: "Types in React/Node",
      tasks: ["Type a React component's props", "Type an API response", "Remove 5 'any' types from a project"],
    },
  ],
  apply: [
    { phase: "Apply", title: "Convert a JS Project", tasks: ["Pick a small JS project", "Convert files to .ts incrementally", "Fix the first batch of errors"] },
    { phase: "Apply", title: "Strict Mode Pass", tasks: ["Enable strict in tsconfig", "Resolve resulting errors", "Add types for missing modules"] },
    { phase: "Apply", title: "Refactor for Clarity", tasks: ["Extract shared types into a types.ts", "Replace duplicated shapes with a single interface", "Add JSDoc to public functions"] },
  ],
  review: [
    { phase: "Review", title: "Recap & Weak Spots", tasks: ["List 3 type features you want to revisit", "Re-do a tricky generic exercise", "Write a short reflection"] },
    { phase: "Review", title: "What's Next", tasks: ["Explore advanced types (mapped, conditional)", "Bookmark 3 TS resources", "Share your converted project"] },
  ],
};

const HTML_CSS: Curriculum = {
  foundations: [
    { phase: "Foundations", title: "HTML Essentials", tasks: ["Build a semantic page layout", "Use headings, lists and links correctly", "Add an image with alt text"] },
    { phase: "Foundations", title: "CSS Basics", tasks: ["Style text, colors and spacing", "Practice the box model", "Use classes effectively"] },
    { phase: "Foundations", title: "Flexbox & Grid", tasks: ["Build a navbar with Flexbox", "Build a 3-column layout with Grid", "Center elements with both"] },
  ],
  practice: [
    { phase: "Practice", title: "Responsive Design", tasks: ["Add a mobile-first media query", "Make a layout responsive", "Test at 3 different widths"] },
    { phase: "Practice", title: "Components & Reuse", tasks: ["Build a reusable card component", "Build a button system (primary, ghost)", "Extract common styles into classes"] },
    { phase: "Practice", title: "Animations & Polish", tasks: ["Add hover and focus styles", "Add a subtle transition", "Use one keyframe animation"] },
  ],
  apply: [
    { phase: "Apply", title: "Landing Page Build", tasks: ["Plan a single-page landing site", "Build hero + features section", "Add a footer"] },
    { phase: "Apply", title: "Add Sections & Polish", tasks: ["Add testimonials or pricing section", "Improve spacing and typography", "Test on mobile width"] },
    { phase: "Apply", title: "Deploy Your Page", tasks: ["Push to GitHub", "Deploy to Netlify, Vercel or Pages", "Share the link for feedback"] },
  ],
  review: [
    { phase: "Review", title: "Recap & Weak Spots", tasks: ["List 3 CSS topics to revisit", "Rebuild your weakest section", "Write a short reflection"] },
    { phase: "Review", title: "What's Next", tasks: ["Pick a next topic (Tailwind, animations, accessibility)", "Bookmark 3 resources", "Plan your next site"] },
  ],
};

const SQL: Curriculum = {
  foundations: [
    { phase: "Foundations", title: "SQL Basics", tasks: ["Install a local DB or use an online sandbox", "Practice SELECT, WHERE, ORDER BY", "Query a sample dataset"] },
    { phase: "Foundations", title: "Filtering & Sorting", tasks: ["Use LIKE, IN, BETWEEN", "Combine conditions with AND/OR", "Limit and paginate results"] },
    { phase: "Foundations", title: "Joins", tasks: ["Practice INNER JOIN", "Practice LEFT JOIN", "Join 3 tables in one query"] },
  ],
  practice: [
    { phase: "Practice", title: "Aggregations", tasks: ["Use COUNT, SUM, AVG", "Group with GROUP BY", "Filter groups with HAVING"] },
    { phase: "Practice", title: "Subqueries & CTEs", tasks: ["Write a subquery in WHERE", "Convert it to a CTE (WITH)", "Solve 3 reporting questions"] },
    { phase: "Practice", title: "Indexes & Performance", tasks: ["Read about indexes", "EXPLAIN a slow query", "Add an index and re-check"] },
  ],
  apply: [
    { phase: "Apply", title: "Mini Report Build", tasks: ["Pick a dataset (sales, users, events)", "Write 5 useful reports as SQL", "Save them as views"] },
    { phase: "Apply", title: "Schema Design", tasks: ["Design tables for a small app", "Add primary and foreign keys", "Seed with sample data"] },
    { phase: "Apply", title: "Refactor & Document", tasks: ["Rename unclear columns", "Add comments to complex queries", "Write a short data dictionary"] },
  ],
  review: [
    { phase: "Review", title: "Recap & Weak Spots", tasks: ["List 3 SQL topics to revisit", "Re-solve your hardest query", "Write a short reflection"] },
    { phase: "Review", title: "What's Next", tasks: ["Explore window functions", "Bookmark 3 SQL resources", "Share your reports for feedback"] },
  ],
};

const LANGUAGE: Curriculum = {
  foundations: [
    { phase: "Foundations", title: "Sounds & Alphabet", tasks: ["Learn the alphabet and key sounds", "Practice pronouncing 10 common words", "Install a learning app"] },
    { phase: "Foundations", title: "Greetings & Basics", tasks: ["Learn 10 greetings and polite phrases", "Introduce yourself out loud", "Write 3 simple sentences"] },
    { phase: "Foundations", title: "Core Grammar", tasks: ["Study basic sentence structure", "Learn present-tense conjugation", "Form 5 of your own sentences"] },
  ],
  practice: [
    { phase: "Practice", title: "Daily Vocabulary", tasks: ["Learn 15 new words around food/home", "Use 5 of them in sentences", "Review yesterday's words"] },
    { phase: "Practice", title: "Listening Practice", tasks: ["Listen to a short clip or song", "Write down 5 words you heard", "Repeat the clip out loud"] },
    { phase: "Practice", title: "Speaking Practice", tasks: ["Speak for 5 minutes about your day", "Record yourself and listen back", "Note 3 mistakes to fix"] },
  ],
  apply: [
    { phase: "Apply", title: "Short Conversation", tasks: ["Hold a 3-minute conversation (real or roleplay)", "Use 5 new words you learned", "Note words you missed"] },
    { phase: "Apply", title: "Write a Short Text", tasks: ["Write a 100-word paragraph about your week", "Check it with a tool or tutor", "Rewrite the corrected version"] },
    { phase: "Apply", title: "Media Immersion", tasks: ["Watch a short video with subtitles", "Note 10 new words", "Repeat 5 sentences out loud"] },
  ],
  review: [
    { phase: "Review", title: "Vocabulary Recap", tasks: ["Review all new words from this plan", "Self-test with flashcards", "Mark the hardest 10 for tomorrow"] },
    { phase: "Review", title: "Next Steps", tasks: ["Choose your next topic (travel, work, hobbies)", "Set a weekly speaking goal", "Bookmark 3 resources"] },
  ],
};

const WORKOUT: Curriculum = {
  foundations: [
    { phase: "Foundations", title: "Baseline & Mobility", tasks: ["Log your current weight and key stats", "Do a 10-minute mobility routine", "Take baseline measurements (push-ups, plank)"] },
    { phase: "Foundations", title: "Form & Technique", tasks: ["Practice squat, hinge and push form", "Record one set and review it", "Do a light technique session"] },
    { phase: "Foundations", title: "Warm-Up Routine", tasks: ["Build a 10-minute warm-up you enjoy", "Use it before today's session", "Note how it felt"] },
  ],
  practice: [
    { phase: "Practice", title: "Strength Day", tasks: ["3 sets of squats", "3 sets of push-ups or bench", "3 sets of rows or pull-ups"] },
    { phase: "Practice", title: "Cardio Session", tasks: ["20-minute steady cardio", "5-minute cooldown walk", "Stretch hamstrings and hips"] },
    { phase: "Practice", title: "Core & Conditioning", tasks: ["Plank ladder (3 sets)", "Glute bridges (3 sets)", "Finisher: 5-minute HIIT"] },
  ],
  apply: [
    { phase: "Apply", title: "Push Day", tasks: ["Increase weight or reps by ~10%", "Track every set in a notebook/app", "Hydrate and eat enough protein"] },
    { phase: "Apply", title: "Benchmark Workout", tasks: ["Time a benchmark workout", "Compare to baseline", "Note what felt strong and weak"] },
    { phase: "Apply", title: "Active Day", tasks: ["Choose a fun activity (hike, bike, sport)", "Move for 30+ minutes", "Stretch afterwards"] },
  ],
  review: [
    { phase: "Review", title: "Recovery & Reflection", tasks: ["Light walk and stretching only", "Log how the week felt", "Note 2 wins and 1 thing to improve"] },
    { phase: "Review", title: "Plan Next Block", tasks: ["Pick a focus for next week", "Schedule sessions in your calendar", "Prep gym bag / clothes"] },
  ],
};

const RUNNING: Curriculum = {
  foundations: [
    { phase: "Foundations", title: "Baseline Easy Run", tasks: ["Easy 20-minute run/walk", "Note pace and how you felt", "Stretch calves and hips"] },
    { phase: "Foundations", title: "Form Focus", tasks: ["Read or watch a short running form video", "Do 4×30s strides", "Easy 15-minute run"] },
    { phase: "Foundations", title: "Build Base", tasks: ["Easy 25-minute run at conversational pace", "Foam roll legs", "Hydrate well today"] },
  ],
  practice: [
    { phase: "Practice", title: "Intervals", tasks: ["Warm-up 10 min", "6×1 minute fast, 2 min easy", "Cooldown 10 min"] },
    { phase: "Practice", title: "Tempo Run", tasks: ["Warm-up 10 min", "15 minutes at comfortably hard pace", "Cooldown 10 min"] },
    { phase: "Practice", title: "Strength for Runners", tasks: ["Squats, lunges, calf raises (3 sets each)", "Plank and side plank", "Hip mobility routine"] },
  ],
  apply: [
    { phase: "Apply", title: "Long Run", tasks: ["Run 40–50 minutes easy", "Fuel before and hydrate after", "Note pace and mood"] },
    { phase: "Apply", title: "Race-Pace Practice", tasks: ["Warm-up 10 min", "3×5 min at goal pace, 2 min easy", "Cooldown 10 min"] },
    { phase: "Apply", title: "Recovery Jog", tasks: ["Easy 20–25 minutes", "Focus on relaxed breathing", "Stretch thoroughly"] },
  ],
  review: [
    { phase: "Review", title: "Reflect & Recover", tasks: ["Rest or very light walk", "Log weekly mileage and feel", "Plan next week's runs"] },
    { phase: "Review", title: "Set Next Goal", tasks: ["Pick a distance or pace target", "Schedule next 3 key sessions", "Refresh playlist or route"] },
  ],
};

const READING: Curriculum = {
  foundations: [
    { phase: "Foundations", title: "Kickoff", tasks: ["Skim the table of contents", "Read the first chapter", "Set a daily page goal"] },
    { phase: "Foundations", title: "Get Into Rhythm", tasks: ["Read 20–30 pages", "Highlight 3 key ideas", "Note any unknown words"] },
    { phase: "Foundations", title: "Build the Habit", tasks: ["Read at the same time as yesterday", "Write 2 sentences summarizing today's pages", "Look up 1 unknown word"] },
  ],
  practice: [
    { phase: "Practice", title: "Deep Read", tasks: ["Read 30+ pages with no distractions", "Highlight one passage that struck you", "Reflect for 2 minutes after"] },
    { phase: "Practice", title: "Notes & Highlights", tasks: ["Re-read yesterday's highlights", "Write a short note for each", "Connect one idea to your life"] },
    { phase: "Practice", title: "Discuss or Share", tasks: ["Tell someone what the book is about", "Share one quote online or with a friend", "Read 20 pages"] },
  ],
  apply: [
    { phase: "Apply", title: "Apply One Idea", tasks: ["Pick one idea from the book", "Apply it to your day today", "Note how it went"] },
    { phase: "Apply", title: "Approach the End", tasks: ["Read toward the final chapters", "Predict how it ends", "Reflect on the main argument"] },
    { phase: "Apply", title: "Finish Strong", tasks: ["Finish the last chapters", "Write a one-paragraph reaction", "Rate the book honestly"] },
  ],
  review: [
    { phase: "Review", title: "Recap & Takeaways", tasks: ["List your top 3 takeaways", "Re-read your favorite highlights", "Decide what to do differently"] },
    { phase: "Review", title: "Next Book", tasks: ["Pick your next book", "Set a start date", "Shelf or pass on the current one"] },
  ],
};

const WRITING: Curriculum = {
  foundations: [
    { phase: "Foundations", title: "Pick a Topic", tasks: ["Brainstorm 5 topic ideas", "Pick the one you care about most", "Write a one-sentence thesis"] },
    { phase: "Foundations", title: "Outline", tasks: ["Draft a 3-section outline", "List 3 supporting points per section", "Note your target audience"] },
    { phase: "Foundations", title: "Warm Up Writing", tasks: ["Free-write for 10 minutes on your topic", "Highlight the strongest sentences", "Save them for the draft"] },
  ],
  practice: [
    { phase: "Practice", title: "First Draft", tasks: ["Write the opening paragraph", "Draft section 1 without editing", "Stop before you over-polish"] },
    { phase: "Practice", title: "Continue Draft", tasks: ["Draft section 2", "Draft section 3", "Write a rough conclusion"] },
    { phase: "Practice", title: "Strengthen Examples", tasks: ["Add 1 concrete example per section", "Cut 1 weak paragraph", "Tighten the intro"] },
  ],
  apply: [
    { phase: "Apply", title: "Self Edit", tasks: ["Read out loud start to finish", "Cut 10% of the words", "Improve the headline"] },
    { phase: "Apply", title: "Outside Feedback", tasks: ["Share with 1 trusted reader", "Note their top 2 suggestions", "Apply the most useful one"] },
    { phase: "Apply", title: "Publish", tasks: ["Final proofread pass", "Publish or send the piece", "Share it in one place"] },
  ],
  review: [
    { phase: "Review", title: "Reflect", tasks: ["Note what worked and what didn't", "Save 3 sentences you're proud of", "List what to improve next time"] },
    { phase: "Review", title: "Plan Next Piece", tasks: ["Pick your next topic", "Sketch a rough outline", "Schedule writing time"] },
  ],
};

const STUDY: Curriculum = {
  foundations: [
    { phase: "Foundations", title: "Map the Syllabus", tasks: ["Skim the full syllabus", "Identify 3 weak areas", "Set up a notes folder"] },
    { phase: "Foundations", title: "Core Concepts", tasks: ["Study the first key topic", "Make a one-page summary", "Try 3 practice questions"] },
    { phase: "Foundations", title: "Active Recall", tasks: ["Close your notes and recall key terms", "Re-explain a concept out loud", "Mark what you forgot"] },
  ],
  practice: [
    { phase: "Practice", title: "Practice Problems", tasks: ["Solve 10 practice questions", "Review wrong answers carefully", "Re-do the worst 3"] },
    { phase: "Practice", title: "Flashcards", tasks: ["Make 20 flashcards for weak topics", "Run 2 review rounds", "Mark hardest cards"] },
    { phase: "Practice", title: "Targeted Review", tasks: ["Pick your weakest topic", "Re-study it from scratch", "Try 5 fresh problems on it"] },
  ],
  apply: [
    { phase: "Apply", title: "Mock Test", tasks: ["Take a timed mock test", "Score it honestly", "List 3 areas to improve"] },
    { phase: "Apply", title: "Past Paper", tasks: ["Solve a past paper", "Mark and review every answer", "Re-do missed questions"] },
    { phase: "Apply", title: "Explain It Back", tasks: ["Pick the hardest topic", "Teach it to an imaginary student", "Re-record or rewrite for clarity"] },
  ],
  review: [
    { phase: "Review", title: "Weak-Spot Sweep", tasks: ["Re-review the 3 hardest topics", "Self-test on each", "Update your one-page summary"] },
    { phase: "Review", title: "Exam-Ready", tasks: ["Quick recap of all topics", "Prepare materials for exam day", "Sleep early tonight"] },
  ],
};

const BUILD: Curriculum = {
  foundations: [
    { phase: "Foundations", title: "Define the Idea", tasks: ["Write a one-sentence pitch", "List the top 3 user problems it solves", "Define what 'done' looks like"] },
    { phase: "Foundations", title: "Scope & Sketch", tasks: ["Sketch the main screens or flow", "Cut features down to a v1", "List the tools you'll use"] },
    { phase: "Foundations", title: "Setup Project", tasks: ["Create the repo or project", "Set up the basic structure", "Commit a 'hello world' version"] },
  ],
  practice: [
    { phase: "Practice", title: "Core Feature", tasks: ["Implement the main feature end-to-end", "Stub data where needed", "Commit working progress"] },
    { phase: "Practice", title: "Secondary Feature", tasks: ["Add one supporting feature", "Improve the main flow with what you learned", "Fix the most annoying bug"] },
    { phase: "Practice", title: "Refine UX", tasks: ["Improve copy and labels", "Handle empty and error states", "Tighten spacing and typography"] },
  ],
  apply: [
    { phase: "Apply", title: "End-to-End Test", tasks: ["Walk through the full flow yourself", "Note every rough edge", "Fix the top 3"] },
    { phase: "Apply", title: "Get Feedback", tasks: ["Share with 2 people", "Capture their first impressions", "Pick 1 piece of feedback to act on"] },
    { phase: "Apply", title: "Polish Pass", tasks: ["Fix the feedback you chose", "Improve the landing/first screen", "Write a short README or about page"] },
  ],
  review: [
    { phase: "Review", title: "Launch", tasks: ["Deploy or publish the project", "Share it in one place", "Celebrate shipping"] },
    { phase: "Review", title: "Retrospective", tasks: ["Note what worked", "Note what you'd do differently", "Decide if there's a v2"] },
  ],
};

const GENERIC: Curriculum = {
  foundations: [
    { phase: "Foundations", title: "Define Success", tasks: ["Write what 'done' looks like in one sentence", "List the first 3 concrete steps", "Block focus time on your calendar"] },
    { phase: "Foundations", title: "Remove Friction", tasks: ["Identify the biggest blocker", "Remove or work around it", "Prepare materials you'll need"] },
    { phase: "Foundations", title: "Easy Start", tasks: ["Do the smallest version of the task", "Note how it felt", "Commit to tomorrow's slot"] },
  ],
  practice: [
    { phase: "Practice", title: "Focused Session", tasks: ["Work 30 focused minutes", "Avoid your top distraction", "Write down what you finished"] },
    { phase: "Practice", title: "Build Momentum", tasks: ["Repeat yesterday's session", "Push for 10% more", "Review what worked"] },
    { phase: "Practice", title: "Mid-Plan Check", tasks: ["Re-read your 'done' definition", "Adjust the plan if needed", "Pick the next concrete step"] },
  ],
  apply: [
    { phase: "Apply", title: "Push Forward", tasks: ["Tackle the hardest part", "Stay with it for 30+ minutes", "Note your output"] },
    { phase: "Apply", title: "Refine Output", tasks: ["Improve what you produced", "Cut what's not needed", "Ask 1 person for feedback"] },
    { phase: "Apply", title: "Near the Finish", tasks: ["Identify what's left", "Do the final hard step", "Prepare to wrap up"] },
  ],
  review: [
    { phase: "Review", title: "Wrap Up", tasks: ["Mark the goal complete", "Save your outputs in one place", "Share progress with someone"] },
    { phase: "Review", title: "Reflect & Next", tasks: ["Note 2 wins and 1 lesson", "Decide your next goal", "Schedule the first step"] },
  ],
};

const CURRICULA: Record<TopicKey, Curriculum> = {
  python: PYTHON,
  javascript: JAVASCRIPT,
  react: REACT,
  typescript: TYPESCRIPT,
  html_css: HTML_CSS,
  sql: SQL,
  language: LANGUAGE,
  workout: WORKOUT,
  running: RUNNING,
  reading: READING,
  writing: WRITING,
  study: STUDY,
  build: BUILD,
  generic: GENERIC,
};

// ---------- Phase allocation ----------

// Distribute N days across 4 phases with a sensible weighting.
function allocatePhases(days: number): Phase[] {
  if (days <= 0) return [];
  if (days === 1) return ["Apply"];
  if (days === 2) return ["Foundations", "Review"];
  if (days === 3) return ["Foundations", "Practice", "Review"];
  if (days === 4) return ["Foundations", "Practice", "Apply", "Review"];

  // For >=5: weights F:P:A:R ≈ 0.30 : 0.30 : 0.25 : 0.15, minimum 1 each.
  let f = Math.max(1, Math.round(days * 0.3));
  let p = Math.max(1, Math.round(days * 0.3));
  let a = Math.max(1, Math.round(days * 0.25));
  let r = Math.max(1, days - f - p - a);

  // Fix if rounding overshot.
  while (f + p + a + r > days) {
    if (p > 1) p--;
    else if (f > 1) f--;
    else if (a > 1) a--;
    else if (r > 1) r--;
    else break;
  }
  while (f + p + a + r < days) p++;

  const out: Phase[] = [];
  for (let i = 0; i < f; i++) out.push("Foundations");
  for (let i = 0; i < p; i++) out.push("Practice");
  for (let i = 0; i < a; i++) out.push("Apply");
  for (let i = 0; i < r; i++) out.push("Review");
  return out;
}

// ---------- Variation helpers ----------

const TITLE_PREFIXES: Record<Phase, string[]> = {
  Foundations: ["Foundations", "Kickoff", "Getting Started", "Basics"],
  Practice: ["Practice", "Hands-On", "Drill", "Workshop"],
  Apply: ["Apply", "Build", "Mini Project", "Deep Work"],
  Review: ["Review", "Recap", "Reflection", "Wrap-Up"],
};

function fallbackTitle(phase: Phase, topic: string, rnd: () => number, used: Set<string>): string {
  const prefixes = shuffle(TITLE_PREFIXES[phase], rnd);
  for (const p of prefixes) {
    const candidates = [
      `${p}: ${titleCase(topic)}`,
      `${titleCase(topic)} — ${p}`,
      `${p} Session`,
    ];
    for (const c of candidates) {
      if (!used.has(c.toLowerCase())) return c;
    }
  }
  // Last resort
  let i = 2;
  while (used.has(`${phase} session ${i}`.toLowerCase())) i++;
  return `${phase} Session ${i}`;
}

function tweakTask(task: string, rnd: () => number): string {
  // Very light phrasing variation — keep meaning intact.
  if (rnd() < 0.25 && /^Practice /.test(task)) {
    return task.replace(/^Practice /, "Work on ");
  }
  if (rnd() < 0.2 && /^Learn /.test(task)) {
    return task.replace(/^Learn /, "Study ");
  }
  if (rnd() < 0.2 && /^Build /.test(task)) {
    return task.replace(/^Build /, "Create ");
  }
  return task;
}

// ---------- Main generator ----------

export function generatePlan(input: GeneratePlanInput): GeneratedPlan {
  const goal = (input.goal || "").trim();
  const days = Math.max(1, Math.min(60, Math.floor(input.days) || 1));
  const difficulty: Difficulty = input.difficulty === "Intermediate" ? "Intermediate" : "Beginner";
  const tasksPerDay = difficulty === "Intermediate" ? 3 : 2;

  const topicKey = detectTopic(goal);
  const curriculum = CURRICULA[topicKey];
  const topicNoun = extractTopicNoun(goal);

  const rnd = mulberry32(Date.now() ^ Math.floor(Math.random() * 1e9));
  const phases = allocatePhases(days);

  // Shuffle pools so each generation varies but stays within phase.
  const pools: Record<Phase, DaySpec[]> = {
    Foundations: shuffle(curriculum.foundations, rnd),
    Practice: shuffle(curriculum.practice, rnd),
    Apply: shuffle(curriculum.apply, rnd),
    Review: shuffle(curriculum.review, rnd),
  };
  const cursors: Record<Phase, number> = { Foundations: 0, Practice: 0, Apply: 0, Review: 0 };

  const usedTitles = new Set<string>();
  const out: PlannedDay[] = [];

  for (let i = 0; i < phases.length; i++) {
    const phase = phases[i];
    const pool = pools[phase];

    // Pick next unused spec from pool; if exhausted, fall back to generated title.
    let spec: DaySpec | null = null;
    for (let attempt = 0; attempt < pool.length; attempt++) {
      const idx = (cursors[phase] + attempt) % pool.length;
      const candidate = pool[idx];
      if (!usedTitles.has(candidate.title.toLowerCase())) {
        spec = candidate;
        cursors[phase] = idx + 1;
        break;
      }
    }

    let title: string;
    let taskPool: string[];

    if (spec) {
      title = spec.title;
      taskPool = spec.tasks;
    } else {
      // Pool exhausted — synthesize a unique title, reuse a random task set from phase.
      title = fallbackTitle(phase, topicNoun, rnd, usedTitles);
      const anySpec = pool[Math.floor(rnd() * pool.length)] ?? GENERIC[phaseKey(phase)][0];
      taskPool = anySpec.tasks;
    }

    usedTitles.add(title.toLowerCase());

    const tasks: string[] = [];
    const shuffledTasks = shuffle(taskPool, rnd);
    for (let k = 0; k < Math.min(tasksPerDay, shuffledTasks.length); k++) {
      tasks.push(tweakTask(shuffledTasks[k], rnd));
    }

    out.push({ day: i + 1, title, tasks });
  }

  return { days: out };
}

function phaseKey(p: Phase): keyof Curriculum {
  switch (p) {
    case "Foundations":
      return "foundations";
    case "Practice":
      return "practice";
    case "Apply":
      return "apply";
    case "Review":
      return "review";
  }
}
