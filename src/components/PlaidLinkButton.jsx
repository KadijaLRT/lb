import { useCallback, useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import { Landmark, RefreshCw, Loader2, AlertCircle } from "lucide-react";

export default function PlaidLinkButton({ userId, accountId, linked, onLinked, onSynced }) {
  const [linkToken, setLinkToken] = useState(null);
  const [tokenLoading, setTokenLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const fetchLinkToken = useCallback(() => {
    if (!userId) return;
    setTokenLoading(true);
    setError("");
    fetch("/api/plaid/create-link-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || `Request failed (${r.status})`);
        setLinkToken(data.link_token || null);
        if (!data.link_token) throw new Error("No link token returned.");
      })
      .catch((err) => {
        setError(err.message || "Couldn't reach Plaid.");
        setLinkToken(null);
      })
      .finally(() => setTokenLoading(false));
  }, [userId]);

  useEffect(() => {
    if (linked) return;
    fetchLinkToken();
  }, [linked, fetchLinkToken]);

  const onSuccess = useCallback(
    async (publicToken) => {
      setBusy(true);
      setError("");
      try {
        const res = await fetch("/api/plaid/exchange-public-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ publicToken, accountId }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Couldn't finish linking your bank.");
        onLinked?.();
      } catch (err) {
        setError(err.message || "Couldn't finish linking your bank.");
      } finally {
        setBusy(false);
      }
    },
    [accountId, onLinked]
  );

  const { open, ready } = usePlaidLink({ token: linkToken, onSuccess });

  async function sync() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/plaid/sync-transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Sync failed.");
      onSynced?.(data.synced || 0);
    } catch (err) {
      setError(err.message || "Sync failed.");
    } finally {
      setBusy(false);
    }
  }

  if (linked) {
    return (
      <div className="flex flex-col items-end gap-1">
        <button
          type="button"
          onClick={sync}
          disabled={busy}
          className="text-xs flex items-center gap-1 text-muted hover:text-cream transition-colors disabled:opacity-40"
        >
          {busy ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          Sync
        </button>
        {error && <span className="text-xs text-fire flex items-center gap-1"><AlertCircle size={11} />{error}</span>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => {
          if (!linkToken && !tokenLoading) {
            fetchLinkToken();
            return;
          }
          if (ready) open();
        }}
        disabled={tokenLoading || busy || (!!linkToken && !ready)}
        className="text-xs flex items-center gap-1 text-muted hover:text-cream transition-colors disabled:opacity-40"
      >
        {busy || tokenLoading || (linkToken && !ready) ? (
          <Loader2 size={12} className="animate-spin" />
        ) : (
          <Landmark size={12} />
        )}
        {tokenLoading ? "Connecting…" : linkToken && !ready ? "Preparing…" : "Link bank"}
      </button>
      {error && (
        <span className="text-xs text-fire text-right max-w-[200px] flex items-center gap-1">
          <AlertCircle size={11} className="shrink-0" />
          {error}
        </span>
      )}
    </div>
  );
}
