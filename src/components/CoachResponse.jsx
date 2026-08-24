import { Sparkles } from "lucide-react";

export default function CoachResponse({ text, loading }) {
  if (!text && !loading) return null;
  return (
    <div className="mt-6 border-l-2 border-clay pl-4 py-1 animate-[fadeIn_0.3s_ease]">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-clay mb-2">
        <Sparkles size={12} />
        Coach
      </div>
      {loading ? (
        <div className="space-y-2">
          <div className="h-3 w-4/5 bg-line rounded animate-pulse" />
          <div className="h-3 w-3/5 bg-line rounded animate-pulse" />
        </div>
      ) : (
        <p className="text-cream/90 leading-relaxed whitespace-pre-wrap">{text}</p>
      )}
    </div>
  );
}
