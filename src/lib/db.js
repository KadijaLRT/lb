import { supabase } from "./supabase.js";

// Phase 1 is single-user, so we always work with the first row in user_profile.
// Swap for auth.uid()-scoped queries once multi-user/auth is added.

export async function getOrCreateProfile(defaults = {}) {
  if (!supabase) return null;
  const { data: existing, error: readErr } = await supabase
    .from("user_profile")
    .select("*")
    .limit(1)
    .maybeSingle();
  if (readErr) throw readErr;
  if (existing) return existing;

  const { data: created, error: writeErr } = await supabase
    .from("user_profile")
    .insert({ name: "Kadija", ...defaults })
    .select()
    .single();
  if (writeErr) throw writeErr;
  return created;
}

export async function updateProfile(id, patch) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("user_profile")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getTodayBlueprint(userId) {
  if (!supabase) return null;
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("daily_blueprint")
    .select("*")
    .eq("user_id", userId)
    .eq("date", today)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertTodayBlueprint(userId, patch) {
  if (!supabase) return null;
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("daily_blueprint")
    .upsert({ user_id: userId, date: today, ...patch }, { onConflict: "user_id,date" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getPrimaryAccount(userId) {
  if (!supabase) return null;
  const { data: existing, error: readErr } = await supabase
    .from("financial_accounts")
    .select("*")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (readErr) throw readErr;
  if (existing) return existing;

  const { data: created, error: writeErr } = await supabase
    .from("financial_accounts")
    .insert({ user_id: userId, provider: "manual", weekly_spend_limit: 200 })
    .select()
    .single();
  if (writeErr) throw writeErr;
  return created;
}

export async function getWeekSpend(accountId) {
  if (!supabase) return 0;
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("transactions")
    .select("amount")
    .eq("account_id", accountId)
    .gte("occurred_at", weekAgo);
  if (error) throw error;
  return (data || []).reduce((sum, t) => sum + Number(t.amount || 0), 0);
}

export async function logExpense(accountId, { amount, category, note }) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("transactions")
    .insert({ account_id: accountId, amount, category, note, source: "manual" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function saveScript(userId, payload) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("scripts_and_ideas")
    .insert({ user_id: userId, ...payload })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function listScripts(userId, limit = 10) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("scripts_and_ideas")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}
