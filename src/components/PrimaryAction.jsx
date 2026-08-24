import { ArrowRight, Loader2 } from "lucide-react";

export default function PrimaryAction({ value, onChange, onSubmit, loading }) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim() && !loading) onSubmit();
      }}
      className="w-full"
    >
      <label className="block text-xs uppercase tracking-[0.2em] text-muted mb-2">
        Next small step
      </label>
      <div className="flex items-center gap-3 border-b border-line focus-within:border-clay transition-colors pb-3">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="What's on your mind right now?"
          className="flex-1 bg-transparent outline-none font-display text-2xl md:text-3xl placeholder:text-muted/60 text-cream"
        />
        <button
          type="submit"
          disabled={loading || !value.trim()}
          aria-label="Get my next step"
          className="shrink-0 w-11 h-11 rounded-full bg-clay text-ink flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
        >
          {loading ? <Loader2 className="animate-spin" size={18} /> : <ArrowRight size={18} />}
        </button>
      </div>
    </form>
  );
}
