import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

const env = (process.env.PLAID_ENV || "sandbox").toLowerCase();

const configuration = new Configuration({
  basePath: PlaidEnvironments[env] || PlaidEnvironments.sandbox,
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
      "PLAID-SECRET": process.env.PLAID_SECRET,
    },
  },
});

export const plaidClient = new PlaidApi(configuration);

export function assertPlaidConfigured(res) {
  if (!process.env.PLAID_CLIENT_ID || !process.env.PLAID_SECRET) {
    res.status(500).json({ error: "Plaid isn't configured. Set PLAID_CLIENT_ID and PLAID_SECRET." });
    return false;
  }
  return true;
}
