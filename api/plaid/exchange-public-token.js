import { plaidClient, assertPlaidConfigured } from "./_client.js";
import { supabaseServer } from "../_supabaseServer.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!assertPlaidConfigured(res)) return;

  const { publicToken, accountId } = req.body || {};
  if (!publicToken || !accountId) {
    return res.status(400).json({ error: "Missing 'publicToken' or 'accountId'" });
  }

  try {
    const exchange = await plaidClient.itemPublicTokenExchange({ public_token: publicToken });
    const { access_token, item_id } = exchange.data;

    if (supabaseServer) {
      const { error } = await supabaseServer
        .from("financial_accounts")
        .update({
          provider: "plaid",
          plaid_access_token: access_token,
          plaid_item_id: item_id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", accountId);
      if (error) throw error;
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Plaid exchange error:", err.response?.data || err.message);
    return res.status(502).json({ error: "Couldn't link your bank account." });
  }
}
