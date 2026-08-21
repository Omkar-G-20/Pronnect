import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "indigo" | "green" | "yellow" | "red" | "purple";
  className?: string;
}

const variantClasses = {
  default: "bg-gray-800 text-gray-300 border border-gray-700",
  indigo: "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30",
  green: "bg-green-500/20 text-green-300 border border-green-500/30",
  yellow: "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30",
  red: "bg-red-500/20 text-red-300 border border-red-500/30",
  purple: "bg-purple-500/20 text-purple-300 border border-purple-500/30",
};

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium",
        variantClasses[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
