import { useCallback, useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import { Landmark, RefreshCw, Loader2 } from "lucide-react";

export default function PlaidLinkButton({ userId, accountId, linked, onLinked, onSynced }) {
  const [linkToken, setLinkToken] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!userId || linked) return;
    fetch("/api/plaid/create-link-token.js", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    })
      .then((r) => r.json())
      .then((d) => setLinkToken(d.link_token || null))
      .catch(() => setLinkToken(null));
  }, [userId, linked]);

  const onSuccess = useCallback(
    async (publicToken) => {
      setBusy(true);
      try {
        await fetch("/api/plaid/exchange-public-token.js", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ publicToken, accountId }),
        });
        onLinked?.();
      } finally {
        setBusy(false);
      }
    },
    [accountId, onLinked]
  );

  const { open, ready } = usePlaidLink({ token: linkToken, onSuccess });

  async function sync() {
    setBusy(true);
    try {
      const res = await fetch("/api/plaid/sync-transactions.js", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId }),
      });
      const data = await res.json();
      onSynced?.(data.synced || 0);
    } finally {
      setBusy(false);
    }
  }

  if (linked) {
    return (
      <button
        type="button"
        onClick={sync}
        disabled={busy}
        className="text-xs flex items-center gap-1 text-muted hover:text-cream transition-colors disabled:opacity-40"
      >
        {busy ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
        Sync
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => open()}
      disabled={!ready || busy}
      className="text-xs flex items-center gap-1 text-muted hover:text-cream transition-colors disabled:opacity-40"
    >
      {busy ? <Loader2 size={12} className="animate-spin" /> : <Landmark size={12} />}
      Link bank
    </button>
  );
}
