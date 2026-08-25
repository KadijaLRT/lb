import { plaidClient, assertPlaidConfigured } from "./_client.js";
import { supabaseServer } from "../_supabaseServer.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!assertPlaidConfigured(res)) return;
  if (!supabaseServer) return res.status(500).json({ error: "Supabase server client not configured." });

  const { accountId } = req.body || {};
  if (!accountId) return res.status(400).json({ error: "Missing 'accountId'" });

  try {
    const { data: account, error: readErr } = await supabaseServer
      .from("financial_accounts")
      .select("*")
      .eq("id", accountId)
      .single();
    if (readErr) throw readErr;
    if (!account?.plaid_access_token) {
      return res.status(400).json({ error: "This account isn't linked to Plaid yet." });
    }

    let cursor = account.plaid_cursor || undefined;
    let added = [];
    let hasMore = true;
    let iterations = 0;
    const MAX_ITERATIONS = 20; // safety cap — avoid looping until function timeout on a misbehaving response

    while (hasMore && iterations < MAX_ITERATIONS) {
      const resp = await plaidClient.transactionsSync({
        access_token: account.plaid_access_token,
        cursor,
      });
      added = added.concat(resp.data.added);
      hasMore = resp.data.has_more;
      cursor = resp.data.next_cursor;
      iterations++;
    }

    if (added.length) {
      const rows = added.map((t) => ({
        account_id: accountId,
        amount: t.amount, // Plaid: positive = money out, matches our "spend" convention
        category: t.personal_finance_category?.primary || t.category?.[0] || "Other",
        note: t.name,
        source: "plaid",
        occurred_at: t.datetime || `${t.date}T12:00:00Z`,
      }));
      const { error: insertErr } = await supabaseServer.from("transactions").insert(rows);
      if (insertErr) throw insertErr;
    }

    await supabaseServer
      .from("financial_accounts")
      .update({ plaid_cursor: cursor, updated_at: new Date().toISOString() })
      .eq("id", accountId);

    return res.status(200).json({ synced: added.length });
  } catch (err) {
    const detail = err.response?.data?.error_message || err.message || "Unknown error";
    console.error("Plaid sync error:", err.response?.data || err.message);
    return res.status(502).json({ error: `Couldn't sync transactions: ${detail}` });
  }
}
