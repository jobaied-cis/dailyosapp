import type { EventType, EventPriority } from "@/lib/events-store";

function pad(n: number) { return String(n).padStart(2, "0"); }
function toDateStr(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const MONTHS = ["january","february","march","april","may","june","july","august","september","october","november","december"];
const MONTHS_SHORT = ["jan","feb","mar","apr","may","jun","jul","aug","sept","sep","oct","nov","dec"];

function monthIndex(name: string): number {
  const n = name.toLowerCase();
  let i = MONTHS.indexOf(n);
  if (i >= 0) return i;
  i = MONTHS_SHORT.indexOf(n);
  if (i < 0) return -1;
  const map: Record<string, number> = { jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sept:8,sep:8,oct:9,nov:10,dec:11 };
  return map[n] ?? -1;
}

export interface QuickAddParsed {
  title: string;
  date: string;
  time: string;
  confidence: "high" | "low" | "none";
  hint: string;
  dateFound: boolean;
  timeFound: boolean;
}

export function prettyDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(`${dateStr}T00:00`);
  const today = new Date(); today.setHours(0,0,0,0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const target = new Date(d); target.setHours(0,0,0,0);
  if (target.getTime() === today.getTime()) return "Today";
  if (target.getTime() === tomorrow.getTime()) return "Tomorrow";
  const diff = (target.getTime() - today.getTime()) / 86400000;
  if (diff > 1 && diff < 7) return d.toLocaleDateString(undefined, { weekday: "long" });
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function prettyTime(timeStr: string): string {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":").map(Number);
  const d = new Date(); d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function parseQuickAdd(input: string): QuickAddParsed {
  const raw = (input || "").trim();
  if (!raw) {
    return { title: "", date: "", time: "", confidence: "none", hint: "Type something like 'exam tomorrow 2pm'", dateFound: false, timeFound: false };
  }

  let text = " " + raw + " ";
  const today = new Date();
  let date = toDateStr(today);
  let time = "";
  let dateFound = false;
  let timeFound = false;

  // Time
  const timeRe = /\b(at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b|\b(\d{1,2}):(\d{2})\b/i;
  const tm = text.match(timeRe);
  if (tm) {
    let h: number, m: number;
    if (tm[4]) {
      h = parseInt(tm[2], 10) % 12;
      if (tm[4].toLowerCase() === "pm") h += 12;
      m = tm[3] ? parseInt(tm[3], 10) : 0;
    } else {
      h = parseInt(tm[5], 10);
      m = parseInt(tm[6], 10);
    }
    if (h >= 0 && h < 24 && m >= 0 && m < 60) {
      time = `${pad(h)}:${pad(m)}`;
      timeFound = true;
      text = text.replace(tm[0], " ");
    }
  }

  // ISO date
  const isoM = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (isoM) {
    date = `${isoM[1]}-${isoM[2]}-${isoM[3]}`;
    dateFound = true;
    text = text.replace(isoM[0], " ");
  }

  if (!dateFound) {
    const nm = text.match(/\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/);
    if (nm) {
      const mo = parseInt(nm[1], 10), da = parseInt(nm[2], 10);
      let y = nm[3] ? parseInt(nm[3], 10) : today.getFullYear();
      if (y < 100) y += 2000;
      if (mo >= 1 && mo <= 12 && da >= 1 && da <= 31) {
        date = `${y}-${pad(mo)}-${pad(da)}`;
        dateFound = true;
        text = text.replace(nm[0], " ");
      }
    }
  }

  // Month-name dates
  if (!dateFound) {
    const mp = MONTHS.concat(MONTHS_SHORT).join("|");
    const md1 = text.match(new RegExp(`\\b(${mp})\\s+(\\d{1,2})(?:,?\\s+(\\d{4}))?\\b`, "i"));
    const md2 = !md1 ? text.match(new RegExp(`\\b(\\d{1,2})\\s+(${mp})(?:,?\\s+(\\d{4}))?\\b`, "i")) : null;
    const md = md1 || md2;
    if (md) {
      const monName = md1 ? md[1] : md[2];
      const dayStr = md1 ? md[2] : md[1];
      const mo = monthIndex(monName);
      const da = parseInt(dayStr, 10);
      if (mo >= 0 && da >= 1 && da <= 31) {
        const y = md[3] ? parseInt(md[3], 10) : today.getFullYear();
        date = `${y}-${pad(mo + 1)}-${pad(da)}`;
        dateFound = true;
        text = text.replace(md[0], " ");
      }
    }
  }

  // "in N days"
  if (!dateFound) {
    const inM = text.match(/\bin\s+(\d{1,3})\s+days?\b/i);
    if (inM) {
      const n = parseInt(inM[1], 10);
      if (n > 0 && n < 366) {
        const d = new Date(today); d.setDate(d.getDate() + n);
        date = toDateStr(d); dateFound = true;
        text = text.replace(inM[0], " ");
      }
    }
  }

  // Keywords
  if (!dateFound && /\btonight\b/i.test(text)) {
    date = toDateStr(today); dateFound = true;
    if (!timeFound) { time = "20:00"; timeFound = true; }
    text = text.replace(/\btonight\b/i, " ");
  } else if (!dateFound && /\btoday\b/i.test(text)) {
    date = toDateStr(today); dateFound = true;
    text = text.replace(/\btoday\b/i, " ");
  } else if (!dateFound && /\btomorrow\b/i.test(text)) {
    const d = new Date(today); d.setDate(d.getDate() + 1);
    date = toDateStr(d); dateFound = true;
    text = text.replace(/\btomorrow\b/i, " ");
  } else if (!dateFound) {
    for (let i = 0; i < WEEKDAYS.length; i++) {
      const re = new RegExp(`\\b(next\\s+)?${WEEKDAYS[i]}\\b`, "i");
      const mm = text.match(re);
      if (mm) {
        const cur = today.getDay();
        let diff = (i - cur + 7) % 7;
        if (diff === 0 || mm[1]) diff = diff === 0 ? 7 : (mm[1] ? diff + 7 : diff);
        if (diff === 0) diff = 7;
        const d = new Date(today); d.setDate(d.getDate() + diff);
        date = toDateStr(d); dateFound = true;
        text = text.replace(re, " ");
        break;
      }
    }
  }

  let title = text.replace(/\b(on|at|the)\b/gi, " ").replace(/\s+/g, " ").trim();

  if (!timeFound) {
    const n = new Date();
    n.setHours(n.getHours() + 1, 0, 0, 0);
    time = `${pad(n.getHours())}:${pad(n.getMinutes())}`;
  }

  const titleFound = title.length > 0;
  let confidence: "high" | "low" | "none" = "none";
  if (titleFound && dateFound) confidence = "high";
  else if (titleFound || dateFound) confidence = "low";

  let hint: string;
  if (confidence === "high") {
    hint = `Got it: ${prettyDate(date)}${timeFound ? ` at ${prettyTime(time)}` : ""} — ${title}`;
  } else if (!dateFound && titleFound) {
    hint = "Couldn't detect date — try 'tomorrow' or 'June 25'";
  } else if (dateFound && !titleFound) {
    hint = "Add a short title (e.g. 'Exam')";
  } else {
    hint = "Try 'exam tomorrow 2pm' or 'meeting next monday 10am'";
  }

  return { title: title || raw, date, time, confidence, hint, dateFound, timeFound };
}

export interface EventInput {
  title: string;
  date: string;
  time: string;
  type?: EventType;
  priority?: EventPriority;
  notes?: string;
}

export type ValidationErrors = { title?: string; date?: string; time?: string };

export type ValidationResult =
  | { ok: true; data: Required<Pick<EventInput, "title" | "date" | "time">> & { type: EventType; priority: EventPriority; notes: string } }
  | { ok: false; errors: ValidationErrors };

export function validateEvent(input: EventInput): ValidationResult {
  const errors: ValidationErrors = {};
  const title = (input.title || "").trim();
  const date = (input.date || "").trim();
  const time = (input.time || "").trim();

  if (!title) errors.title = "Please enter a title";
  if (!date) errors.date = "Please select a date";
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.date = "Invalid date";
  if (!time) errors.time = "Please select a time";
  else if (!/^\d{2}:\d{2}$/.test(time)) errors.time = "Invalid time";

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    data: {
      title,
      date,
      time,
      type: input.type ?? "Other",
      priority: input.priority ?? "Medium",
      notes: (input.notes ?? "").trim(),
    },
  };
}
