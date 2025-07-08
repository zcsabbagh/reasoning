import { cn } from "@/lib/utils";

interface ThinkingIndicatorProps {
  className?: string;
}

export default function ThinkingIndicator({ className }: ThinkingIndicatorProps) {
  return (
    <div className={cn("flex items-center space-x-1 text-slate-500", className)}>
      <span className="italic text-sm">Thinking</span>
      <div className="flex space-x-1">
        <div className="w-1 h-1 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
        <div className="w-1 h-1 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
        <div className="w-1 h-1 bg-slate-400 rounded-full animate-bounce"></div>
      </div>
    </div>
  );
}