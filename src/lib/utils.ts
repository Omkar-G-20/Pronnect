import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatRelativeTime(date: Date | string): string {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return formatDate(date);
}

export const SKILL_OPTIONS = [
  "Machine Learning",
  "Deep Learning",
  "Computer Vision",
  "NLP",
  "Data Science",
  "Web Development",
  "Frontend",
  "Backend",
  "Full Stack",
  "Mobile (iOS)",
  "Mobile (Android)",
  "React Native",
  "Embedded Systems",
  "IoT",
  "Robotics",
  "Cybersecurity",
  "Blockchain",
  "DevOps",
  "Cloud (AWS)",
  "Cloud (GCP)",
  "Cloud (Azure)",
  "Game Development",
  "AR/VR",
  "UI/UX Design",
  "Product Management",
  "Research",
  "Hardware",
  "Open Source",
];

export const DOMAIN_TAGS = [
  "AI/ML",
  "Web Dev",
  "Mobile",
  "Embedded Systems",
  "Cybersecurity",
  "Blockchain",
  "DevOps",
  "Game Dev",
  "AR/VR",
  "Design",
  "Research",
  "Hardware",
  "Robotics",
  "IoT",
  "Data Science",
  "Open Source",
];

export function generateInviteCode(): string {
  return crypto.randomUUID().split("-")[0].toUpperCase();
}

// Word filter for chat moderation
const BANNED_WORDS = ["spam", "abuse"]; // extend as needed

export function filterMessage(content: string): string {
  let filtered = content;
  for (const word of BANNED_WORDS) {
    const regex = new RegExp(`\\b${word}\\b`, "gi");
    filtered = filtered.replace(regex, "*".repeat(word.length));
  }
  return filtered;
}

export function sanitizeText(text: string): string {
  return text
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}
