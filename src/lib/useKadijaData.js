import { useEffect, useState, useCallback } from "react";
import { supabase } from "./supabase.js";
import {
  getOrCreateProfile,
  updateProfile,
  getTodayBlueprint,
  upsertTodayBlueprint,
  getPrimaryAccount,
  getWeekSpend,
} from "./db.js";

export function useKadijaData() {
  const [profile, setProfile] = useState(null);
  const [blueprint, setBlueprint] = useState(null);
  const [account, setAccount] = useState(null);
  const [weekSpend, setWeekSpend] = useState(0);
  const [ready, setReady] = useState(false);
  const [dbError, setDbError] = useState("");

  const refreshSpend = useCallback(async (acct) => {
    const target = acct || account;
    if (!target) return;
    try {
      const spend = await getWeekSpend(target.id);
      setWeekSpend(spend);
    } catch (err) {
      console.error(err);
    }
  }, [account]);

  useEffect(() => {
    if (!supabase) {
      setReady(true); // Run in "no database" mode so the UI still works.
      return;
    }
    (async () => {
      try {
        const p = await getOrCreateProfile();
        setProfile(p);
        const [bp, acct] = await Promise.all([
          getTodayBlueprint(p.id),
          getPrimaryAccount(p.id),
        ]);
        setBlueprint(bp);
        setAccount(acct);
        if (acct) refreshSpend(acct);
      } catch (err) {
        console.error(err);
        setDbError("Couldn't reach Supabase. Check .env and schema setup.");
      } finally {
        setReady(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshAccount = useCallback(async () => {
    if (!profile) return;
    try {
      const acct = await getPrimaryAccount(profile.id);
      setAccount(acct);
      if (acct) refreshSpend(acct);
    } catch (err) {
      console.error(err);
    }
  }, [profile, refreshSpend]);

  const setFocus = useCallback(
    async (text, elementTag) => {
      if (!profile) return;
      const bp = await upsertTodayBlueprint(profile.id, {
        primary_focus: text,
        element_tag: elementTag,
      });
      setBlueprint(bp);
    },
    [profile]
  );

  const saveProfileFields = useCallback(
    async (patch) => {
      if (!profile) return;
      const p = await updateProfile(profile.id, patch);
      setProfile(p);
    },
    [profile]
  );

  return {
    profile,
    blueprint,
    account,
    weekSpend,
    ready,
    dbError,
    setFocus,
    saveProfileFields,
    refreshSpend,
    refreshAccount,
  };
}
