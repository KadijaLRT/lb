import { useEffect, useState } from "react";
import { Target, Plus, X, Trash2, Pencil, TrendingUp, GraduationCap, DollarSign, Briefcase, Import } from "lucide-react";
import { listGoals, addGoal, updateGoal, deleteGoal, listJobApplications } from "../lib/db.js";
import { computeProgress, milestoneBadge, defaultMilestones } from "../lib/goalProgress.js";
import { parseGoalsFromText } from "../lib/parseGoalsFromText.js";

const TYPE_ICON = { debt: TrendingUp, savings: DollarSign, salary: Briefcase, education: GraduationCap };
const TYPE_LABEL = { debt: "Debt payoff", savings: "Savings", salary: "Salary", education: "Education" };
const TYPE_COLOR = { debt: "bg-fire", savings: "bg-earth", salary: "bg-clay", education: "bg-air" };

function emptyForm() {
  return { type: "savings", title: "", starting_amount: "", current_amount: "", target_amount: "", target_date: "" };
}

function goalToEditForm(goal) {
  return {
    title: goal.title || "",
    starting_amount: goal.starting_amount ?? "",
    current_amount: goal.current_amount ?? "",
    target_amount: goal.target_amount ?? "",
    target_date: goal.target_date || "",
  };
}

export default function GoalsTracker({ profile }) {
  const [open, setOpen] = useState(false);
  const [goals, setGoals] = useState(null);
  const [jobApps, setJobApps] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [editSaving, setEditSaving] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [amountInputs, setAmountInputs] = useState({});
  const [importSuggestions, setImportSuggestions] = useState(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (!open || !profile?.id) return;
    listGoals(profile.id)
      .then(setGoals)
      .catch((err) => {
        console.error(err);
        setError("Couldn't load your goals.");
      });
  }, [open, profile?.id]);

  useEffect(() => {
    if (!open || !profile?.id) return;
    if (!goals?.some((g) => g.type === "salary")) return;
    listJobApplications(profile.id)
      .then(setJobApps)
      .catch((err) => console.error(err));
  }, [open, profile?.id, goals]);

  async function handleAdd(e) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    setError("");
    try {
      const payload = { type: form.type, title: form.title.trim(), target_date: form.target_date || null };
      if (form.type === "debt") {
        payload.starting_amount = Number(form.starting_amount) || 0;
        payload.current_amount = Number(form.starting_amount) || 0;
      } else if (form.type === "savings") {
        payload.target_amount = Number(form.target_amount) || 0;
        payload.current_amount = Number(form.current_amount) || 0;
      } else if (form.type === "salary") {
        payload.target_amount = Number(form.target_amount) || 0;
      } else if (form.type === "education") {
        payload.milestones = defaultMilestones();
      }
      const created = await addGoal(profile.id, payload);
      setGoals((prev) => [...(prev || []), created]);
      setForm(emptyForm());
      setShowForm(false);
    } catch (err) {
      console.error(err);
      setError(err.message || "Couldn't save that goal.");
    } finally {
      setSaving(false);
    }
  }

  async function logAmount(goal, delta) {
    const raw = amountInputs[goal.id];
    const amount = Number(raw);
    if (!amount) return;
    setError("");
    try {
      const nextAmount = Math.max(0, Number(goal.current_amount || 0) + delta * amount);
      const updated = await updateGoal(goal.id, { current_amount: nextAmount });
      setGoals((prev) => prev.map((g) => (g.id === goal.id ? updated : g)));
      setAmountInputs((prev) => ({ ...prev, [goal.id]: "" }));
    } catch (err) {
      console.error(err);
      setError("Couldn't update that goal.");
    }
  }

  async function toggleMilestone(goal, index) {
    setError("");
    const milestones = (goal.milestones?.length ? goal.milestones : defaultMilestones()).map((m, i) =>
      i === index ? { ...m, done: !m.done } : m
    );
    try {
      const updated = await updateGoal(goal.id, { milestones });
      setGoals((prev) => prev.map((g) => (g.id === goal.id ? updated : g)));
    } catch (err) {
      console.error(err);
      setError("Couldn't update that milestone.");
    }
  }

  function startEdit(goal) {
    setShowForm(false);
    setImportSuggestions(null);
    setEditingId(goal.id);
    setEditForm(goalToEditForm(goal));
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm(null);
  }

  async function saveEdit(goal) {
    if (!editForm.title.trim()) return;
    setEditSaving(true);
    setError("");
    try {
      const patch = { title: editForm.title.trim(), target_date: editForm.target_date || null };
      if (goal.type === "debt") {
        patch.starting_amount = Number(editForm.starting_amount) || 0;
        patch.current_amount = Number(editForm.current_amount) || 0;
      } else if (goal.type === "savings") {
        patch.target_amount = Number(editForm.target_amount) || 0;
        patch.current_amount = Number(editForm.current_amount) || 0;
      } else if (goal.type === "salary") {
        patch.target_amount = Number(editForm.target_amount) || 0;
      }
      const updated = await updateGoal(goal.id, patch);
      setGoals((prev) => prev.map((g) => (g.id === goal.id ? updated : g)));
      setEditingId(null);
      setEditForm(null);
    } catch (err) {
      console.error(err);
      setError(err.message || "Couldn't save changes.");
    } finally {
      setEditSaving(false);
    }
  }

  async function remove(goal) {
    setError("");
    try {
      await deleteGoal(goal.id);
      setGoals((prev) => prev.filter((g) => g.id !== goal.id));
      if (editingId === goal.id) {
        setEditingId(null);
        setEditForm(null);
      }
    } catch (err) {
      console.error(err);
      setError("Couldn't delete that goal.");
    }
  }

  function startImport() {
    const existingTitles = new Set((goals || []).map((g) => g.title.toLowerCase().trim()));
    const suggestions = parseGoalsFromText(profile?.core_goals || "").filter(
      (s) => !existingTitles.has(s.title.toLowerCase().trim())
    );
    setImportSuggestions(suggestions);
  }

  function updateSuggestion(index, patch) {
    setImportSuggestions((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function removeSuggestion(index) {
    setImportSuggestions((prev) => prev.filter((_, i) => i !== index));
  }

  async function confirmImport() {
    setImporting(true);
    setError("");
    try {
      const created = [];
      for (const s of importSuggestions) {
        const payload = { type: s.type, title: s.title, target_date: null };
        if (s.type === "debt") {
          payload.starting_amount = Number(s.target_amount) || 0;
          payload.current_amount = Number(s.target_amount) || 0;
        } else if (s.type === "savings" || s.type === "salary") {
          payload.target_amount = Number(s.target_amount) || 0;
          payload.current_amount = 0;
        } else if (s.type === "education") {
          payload.milestones = defaultMilestones();
        }
        created.push(await addGoal(profile.id, payload));
      }
      setGoals((prev) => [...(prev || []), ...created]);
      setImportSuggestions(null);
    } catch (err) {
      console.error(err);
      setError(err.message || "Couldn't import those goals.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="border border-line rounded-2xl overflow-hidden">
      <button type="button" onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between px-4 py-3">
        <span className="flex items-center gap-2 text-sm text-cream">
          <Target size={14} className="text-clay" />
          Goal progress
        </span>
        {goals && goals.length > 0 && <span className="text-xs text-muted">{goals.length} tracked</span>}
      </button>

      {open && (
        <div className="border-t border-line p-4 flex flex-col gap-3">
          {!showForm && !importSuggestions && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setShowForm(true)}
                className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full bg-clay text-ink font-medium"
              >
                <Plus size={14} />
                Add goal
              </button>
              {profile?.core_goals && (
                <button
                  type="button"
                  onClick={startImport}
                  className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border border-clay text-clay"
                >
                  <Import size={14} />
                  Import from Core Goals
                </button>
              )}
            </div>
          )}

          {importSuggestions && (
            <div className="flex flex-col gap-2 border border-clay rounded-xl p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-[0.2em] text-muted">
                  Review before importing ({importSuggestions.length})
                </span>
                <button type="button" onClick={() => setImportSuggestions(null)} className="text-muted hover:text-cream">
                  <X size={14} />
                </button>
              </div>

              {importSuggestions.length === 0 && (
                <p className="text-sm text-muted italic">Nothing new to import — looks like these are already tracked.</p>
              )}

              {importSuggestions.map((s, i) => (
                <div key={i} className="flex flex-col gap-1.5 border-b border-line pb-2 last:border-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-cream">{s.title}</span>
                    <button type="button" onClick={() => removeSuggestion(i)} className="text-muted hover:text-fire shrink-0">
                      <X size={13} />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(TYPE_LABEL).map(([t, label]) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => updateSuggestion(i, { type: t })}
                        className={`text-[10px] px-2 py-0.5 rounded-full border ${
                          s.type === t ? "border-clay text-clay" : "border-line text-muted"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {(s.type === "debt" || s.type === "savings" || s.type === "salary") && (
                    <input
                      type="number"
                      value={s.target_amount ?? ""}
                      onChange={(e) => updateSuggestion(i, { target_amount: e.target.value })}
                      placeholder={s.type === "debt" ? "Amount owed ($)" : "Target amount ($)"}
                      className="bg-transparent border-b border-line focus:border-clay outline-none text-xs py-1 placeholder:text-muted/60"
                    />
                  )}
                </div>
              ))}

              {importSuggestions.length > 0 && (
                <button
                  type="button"
                  onClick={confirmImport}
                  disabled={importing}
                  className="self-start px-4 py-1.5 rounded-full bg-clay text-ink text-sm font-medium disabled:opacity-40"
                >
                  {importing ? "Importing…" : `Import ${importSuggestions.length} goal${importSuggestions.length !== 1 ? "s" : ""}`}
                </button>
              )}
            </div>
          )}

          {showForm && (
            <form onSubmit={handleAdd} className="flex flex-col gap-2 border border-line rounded-xl p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-[0.2em] text-muted">New goal</span>
                <button type="button" onClick={() => setShowForm(false)} className="text-muted hover:text-cream">
                  <X size={14} />
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {Object.entries(TYPE_LABEL).map(([t, label]) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, type: t }))}
                    className={`text-xs px-3 py-1 rounded-full border ${
                      form.type === t ? "border-clay text-clay" : "border-line text-muted"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Goal name (e.g. 'Townhouse down payment')"
                className="bg-transparent border-b border-line focus:border-clay outline-none text-sm py-1 placeholder:text-muted/60"
              />

              {form.type === "debt" && (
                <input
                  type="number"
                  value={form.starting_amount}
                  onChange={(e) => setForm((f) => ({ ...f, starting_amount: e.target.value }))}
                  placeholder="Total owed right now ($)"
                  className="bg-transparent border-b border-line focus:border-clay outline-none text-sm py-1 placeholder:text-muted/60"
                />
              )}

              {form.type === "savings" && (
                <>
                  <input
                    type="number"
                    value={form.target_amount}
                    onChange={(e) => setForm((f) => ({ ...f, target_amount: e.target.value }))}
                    placeholder="Target amount ($)"
                    className="bg-transparent border-b border-line focus:border-clay outline-none text-sm py-1 placeholder:text-muted/60"
                  />
                  <input
                    type="number"
                    value={form.current_amount}
                    onChange={(e) => setForm((f) => ({ ...f, current_amount: e.target.value }))}
                    placeholder="Already saved ($, optional)"
                    className="bg-transparent border-b border-line focus:border-clay outline-none text-sm py-1 placeholder:text-muted/60"
                  />
                </>
              )}

              {form.type === "salary" && (
                <input
                  type="number"
                  value={form.target_amount}
                  onChange={(e) => setForm((f) => ({ ...f, target_amount: e.target.value }))}
                  placeholder="Target salary ($)"
                  className="bg-transparent border-b border-line focus:border-clay outline-none text-sm py-1 placeholder:text-muted/60"
                />
              )}

              {form.type === "education" && (
                <p className="text-xs text-muted italic">
                  Tracked by milestone: Applied → Accepted → Enrolled → Coursework → Graduated
                </p>
              )}

              <input
                type="date"
                value={form.target_date}
                onChange={(e) => setForm((f) => ({ ...f, target_date: e.target.value }))}
                className="bg-transparent border-b border-line focus:border-clay outline-none text-sm py-1 text-cream"
              />
              <span className="text-[10px] text-muted -mt-1">Target date (optional)</span>

              <button
                type="submit"
                disabled={saving || !form.title.trim()}
                className="self-start px-4 py-1.5 rounded-full bg-clay text-ink text-sm font-medium disabled:opacity-40"
              >
                {saving ? "Saving…" : "Save goal"}
              </button>
            </form>
          )}

          {error && <p className="text-sm text-fire">{error}</p>}
          {goals === null && <p className="text-sm text-muted">Loading…</p>}
          {goals?.length === 0 && <p className="text-sm text-muted italic">No goals tracked yet.</p>}

          {goals && goals.length > 0 && (
            <div className="flex flex-col gap-3">
              {goals.map((goal) => {
                const { percent, detailText } = computeProgress(goal, jobApps);
                const badge = milestoneBadge(percent);
                const Icon = TYPE_ICON[goal.type] || Target;
                const isEditing = editingId === goal.id;

                if (isEditing) {
                  return (
                    <div key={goal.id} className="border border-clay rounded-xl p-3 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs uppercase tracking-[0.2em] text-muted">
                          Editing · {TYPE_LABEL[goal.type]}
                        </span>
                        <button type="button" onClick={cancelEdit} className="text-muted hover:text-cream">
                          <X size={14} />
                        </button>
                      </div>
                      <input
                        value={editForm.title}
                        onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                        placeholder="Goal name"
                        className="bg-transparent border-b border-line focus:border-clay outline-none text-sm py-1 placeholder:text-muted/60"
                      />

                      {goal.type === "debt" && (
                        <>
                          <input
                            type="number"
                            value={editForm.starting_amount}
                            onChange={(e) => setEditForm((f) => ({ ...f, starting_amount: e.target.value }))}
                            placeholder="Total owed originally ($)"
                            className="bg-transparent border-b border-line focus:border-clay outline-none text-sm py-1 placeholder:text-muted/60"
                          />
                          <input
                            type="number"
                            value={editForm.current_amount}
                            onChange={(e) => setEditForm((f) => ({ ...f, current_amount: e.target.value }))}
                            placeholder="Remaining balance ($)"
                            className="bg-transparent border-b border-line focus:border-clay outline-none text-sm py-1 placeholder:text-muted/60"
                          />
                        </>
                      )}

                      {goal.type === "savings" && (
                        <>
                          <input
                            type="number"
                            value={editForm.target_amount}
                            onChange={(e) => setEditForm((f) => ({ ...f, target_amount: e.target.value }))}
                            placeholder="Target amount ($)"
                            className="bg-transparent border-b border-line focus:border-clay outline-none text-sm py-1 placeholder:text-muted/60"
                          />
                          <input
                            type="number"
                            value={editForm.current_amount}
                            onChange={(e) => setEditForm((f) => ({ ...f, current_amount: e.target.value }))}
                            placeholder="Already saved ($)"
                            className="bg-transparent border-b border-line focus:border-clay outline-none text-sm py-1 placeholder:text-muted/60"
                          />
                        </>
                      )}

                      {goal.type === "salary" && (
                        <input
                          type="number"
                          value={editForm.target_amount}
                          onChange={(e) => setEditForm((f) => ({ ...f, target_amount: e.target.value }))}
                          placeholder="Target salary ($)"
                          className="bg-transparent border-b border-line focus:border-clay outline-none text-sm py-1 placeholder:text-muted/60"
                        />
                      )}

                      <input
                        type="date"
                        value={editForm.target_date}
                        onChange={(e) => setEditForm((f) => ({ ...f, target_date: e.target.value }))}
                        className="bg-transparent border-b border-line focus:border-clay outline-none text-sm py-1 text-cream"
                      />
                      <span className="text-[10px] text-muted -mt-1">Target date (optional)</span>

                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => saveEdit(goal)}
                          disabled={editSaving || !editForm.title.trim()}
                          className="px-4 py-1.5 rounded-full bg-clay text-ink text-sm font-medium disabled:opacity-40"
                        >
                          {editSaving ? "Saving…" : "Save changes"}
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="px-4 py-1.5 rounded-full border border-line text-sm text-muted hover:text-cream"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={goal.id} className="border border-line rounded-xl p-3 flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 min-w-0">
                        <Icon size={14} className="text-clay shrink-0 mt-0.5" />
                        <span className="text-sm text-cream">{goal.title}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button type="button" onClick={() => startEdit(goal)} className="text-muted hover:text-clay">
                          <Pencil size={13} />
                        </button>
                        <button type="button" onClick={() => remove(goal)} className="text-muted hover:text-fire">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    <div className="h-1.5 w-full bg-line rounded-full overflow-hidden">
                      <div
                        className={`h-full ${TYPE_COLOR[goal.type] || "bg-clay"} transition-all`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-xs text-muted">
                      <span>{detailText}</span>
                      <span>{Math.round(percent)}%</span>
                    </div>

                    {badge && <span className="text-xs text-clay">{badge}</span>}

                    {(goal.type === "debt" || goal.type === "savings") && (
                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="number"
                          value={amountInputs[goal.id] || ""}
                          onChange={(e) => setAmountInputs((prev) => ({ ...prev, [goal.id]: e.target.value }))}
                          placeholder="$ amount"
                          className="flex-1 bg-transparent border-b border-line focus:border-clay outline-none text-xs py-1 placeholder:text-muted/60"
                        />
                        <button
                          type="button"
                          onClick={() => logAmount(goal, goal.type === "debt" ? -1 : 1)}
                          className="text-xs px-2.5 py-1 rounded-full border border-line hover:border-clay text-muted hover:text-cream"
                        >
                          {goal.type === "debt" ? "Log payment" : "Log deposit"}
                        </button>
                      </div>
                    )}

                    {goal.type === "education" && (
                      <div className="flex flex-col gap-1 pt-1">
                        {(goal.milestones?.length ? goal.milestones : defaultMilestones()).map((m, i) => (
                          <label key={i} className="flex items-center gap-2 text-xs text-muted">
                            <input
                              type="checkbox"
                              checked={!!m.done}
                              onChange={() => toggleMilestone(goal, i)}
                              className="accent-[#C96A4B]"
                            />
                            <span className={m.done ? "line-through text-muted/60" : ""}>{m.label}</span>
                          </label>
                        ))}
                      </div>
                    )}

                    {goal.type === "salary" && (
                      <p className="text-[10px] text-muted italic pt-1">Based on your logged job applications.</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
