import { useEffect, useState } from "react";
import { Send, Loader2, MessagesSquare } from "lucide-react";
import { listChatMessages, addChatMessage } from "../lib/db.js";

// When contextKey is given, the conversation is loaded from and saved to
// Supabase (scoped to that key — e.g. "career:2026-08-28").
// Without one (scenario advice), it stays purely in-memory, matching the
// fact that scenario readings themselves aren't saved either.
export default function ChatFollowUp({ area, profile, priorReading, contextKey }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !contextKey || !profile?.id) return;
    setMessages([]);
    setLoadingHistory(true);
    listChatMessages(profile.id, contextKey)
      .then((rows) => setMessages(rows.map((r) => ({ role: r.role, content: r.content }))))
      .catch((err) => console.error("Couldn't load chat history:", err))
      .finally(() => setLoadingHistory(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, contextKey, profile?.id]);

  async function send() {
    if (!input.trim() || loading) return;
    const userMsg = { role: "user", content: input.trim() };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    setError("");

    if (contextKey && profile?.id) {
      addChatMessage(profile.id, contextKey, "user", userMsg.content).catch((e) =>
        console.error("Couldn't save message:", e)
      );
    }

    try {
      const res = await fetch("/api/astrology-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ area, profile, priorReading, messages: nextMessages }),
      });
      const raw = await res.text();
      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        throw new Error(res.ok ? "Unreadable response." : `Server error (${res.status}): ${raw.slice(0, 200)}`);
      }
      if (!res.ok) throw new Error(data.error || "Couldn't get a reply.");
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      if (contextKey && profile?.id) {
        addChatMessage(profile.id, contextKey, "assistant", data.reply).catch((e) =>
          console.error("Couldn't save reply:", e)
        );
      }
    } catch (err) {
      setError(err.message || "Something went wrong.");
      // Roll back the optimistic user message so a retry doesn't duplicate it
      setMessages((prev) => prev.slice(0, -1));
      setInput(userMsg.content);
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-start flex items-center gap-1.5 text-xs text-clay hover:underline"
      >
        <MessagesSquare size={12} />
        Ask a follow-up
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 border-t border-line pt-3 mt-1">
      <span className="text-xs uppercase tracking-[0.2em] text-muted">
        Follow-up chat{!contextKey && " (not saved)"}
      </span>

      {loadingHistory && <p className="text-xs text-muted">Loading conversation…</p>}

      {messages.length > 0 && (
        <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`text-sm rounded-xl px-3 py-2 max-w-[85%] ${
                m.role === "user" ? "self-end bg-clay/20 text-cream" : "self-start bg-panel border border-line text-cream/90"
              }`}
            >
              {m.content}
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-fire">{error}</p>}

      <div className="flex items-center gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Ask something about this…"
          disabled={loading}
          className="flex-1 bg-transparent border-b border-line focus:border-clay outline-none text-sm py-1 placeholder:text-muted/60 disabled:opacity-50"
        />
        <button
          type="button"
          onClick={send}
          disabled={loading || !input.trim()}
          aria-label="Send"
          className="w-8 h-8 rounded-full bg-clay text-ink flex items-center justify-center disabled:opacity-40 shrink-0"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
        </button>
      </div>
    </div>
  );
}
