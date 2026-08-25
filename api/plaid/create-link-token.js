import { plaidClient, assertPlaidConfigured } from "./_client.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!assertPlaidConfigured(res)) return;

  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ error: "Missing 'userId'" });

  try {
    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: userId },
      client_name: "Kadija Life Blueprint",
      products: ["transactions"],
      country_codes: ["US"],
      language: "en",
    });
    return res.status(200).json({ link_token: response.data.link_token });
  } catch (err) {
    const detail = err.response?.data?.error_message || err.message || "Unknown error";
    console.error("Plaid link token error:", err.response?.data || err.message);
    return res.status(502).json({ error: `Couldn't create a Plaid link token: ${detail}` });
  }
}
