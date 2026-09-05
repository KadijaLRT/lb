import { useEffect, useState } from "react";
import { Briefcase, Plus, X, Trash2, ExternalLink } from "lucide-react";
import { listJobApplications, addJobApplication, updateJobApplicationStatus, deleteJobApplication } from "../lib/db.js";
import { localDateString } from "../lib/date.js";

const STATUSES = ["applied", "interviewing", "offer", "rejected", "withdrawn"];
const STATUS_LABEL = {
  applied: "Applied",
  interviewing: "Interviewing",
  offer: "Offer",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};
const STATUS_COLOR = {
  applied: "text-muted",
  interviewing: "text-clay",
  offer: "text-earth",
  rejected: "text-fire",
  withdrawn: "text-muted",
};

function emptyForm() {
  return { company: "", role: "", applied_date: localDateString(), expected_salary: "", job_url: "", notes: "" };
}

export default function JobApplicationTracker({ profile }) {
  const [open, setOpen] = useState(false);
  const [apps, setApps] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !profile?.id) return;
    listJobApplications(profile.id)
      .then(setApps)
      .catch((err) => {
        console.error(err);
        setError("Couldn't load your applications.");
      });
  }, [open, profile?.id]);

  async function handleAdd(e) {
    e.preventDefault();
    if (!form.company.trim() || !form.role.trim()) return;
    setSaving(true);
    setError("");
    try {
      const created = await addJobApplication(profile.id, {
        ...form,
        expected_salary: form.expected_salary ? Number(form.expected_salary) : null,
      });
      setApps((prev) => [created, ...(prev || [])]);
      setForm(emptyForm());
      setShowForm(false);
    } catch (err) {
      console.error(err);
      setError(err.message || "Couldn't save that application.");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(app, status) {
    setError("");
    try {
      await updateJobApplicationStatus(app.id, status);
      setApps((prev) => prev.map((a) => (a.id === app.id ? { ...a, status } : a)));
    } catch (err) {
      console.error(err);
      setError("Couldn't update status.");
    }
  }

  async function remove(app) {
    setError("");
    try {
      await deleteJobApplication(app.id);
      setApps((prev) => prev.filter((a) => a.id !== app.id));
    } catch (err) {
      console.error(err);
      setError("Couldn't delete that.");
    }
  }

  const counts = STATUSES.reduce((acc, s) => {
    acc[s] = (apps || []).filter((a) => a.status === s).length;
    return acc;
  }, {});

  return (
    <div className="border border-line rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3"
      >
        <span className="flex items-center gap-2 text-sm text-cream">
          <Briefcase size={14} className="text-clay" />
          Job applications
        </span>
        {apps && apps.length > 0 && (
          <span className="text-xs text-muted">
            {apps.length} logged · {counts.interviewing} interviewing · {counts.offer} offer{counts.offer !== 1 ? "s" : ""}
          </span>
        )}
      </button>

      {open && (
        <div className="border-t border-line p-4 flex flex-col gap-3">
          {profile?.core_goals?.toLowerCase().includes("salary") && (
            <p className="text-xs text-muted italic">Working toward the salary goal in your Blueprint.</p>
          )}

          {!showForm && (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="self-start flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full bg-clay text-ink font-medium"
            >
              <Plus size={14} />
              Log application
            </button>
          )}

          {showForm && (
            <form onSubmit={handleAdd} className="flex flex-col gap-2 border border-line rounded-xl p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-[0.2em] text-muted">New application</span>
                <button type="button" onClick={() => setShowForm(false)} className="text-muted hover:text-cream">
                  <X size={14} />
                </button>
              </div>
              <input
                value={form.company}
                onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                placeholder="Company"
                className="bg-transparent border-b border-line focus:border-clay outline-none text-sm py-1 placeholder:text-muted/60"
              />
              <input
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                placeholder="Role"
                className="bg-transparent border-b border-line focus:border-clay outline-none text-sm py-1 placeholder:text-muted/60"
              />
              <div className="flex gap-2">
                <input
                  type="date"
                  value={form.applied_date}
                  onChange={(e) => setForm((f) => ({ ...f, applied_date: e.target.value }))}
                  className="flex-1 bg-transparent border-b border-line focus:border-clay outline-none text-sm py-1 text-cream"
                />
                <input
                  type="number"
                  value={form.expected_salary}
                  onChange={(e) => setForm((f) => ({ ...f, expected_salary: e.target.value }))}
                  placeholder="Salary ($, optional)"
                  className="flex-1 bg-transparent border-b border-line focus:border-clay outline-none text-sm py-1 placeholder:text-muted/60"
                />
              </div>
              <input
                value={form.job_url}
                onChange={(e) => setForm((f) => ({ ...f, job_url: e.target.value }))}
                placeholder="Job posting link (optional)"
                className="bg-transparent border-b border-line focus:border-clay outline-none text-sm py-1 placeholder:text-muted/60"
              />
              <textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Notes (optional)"
                rows={2}
                className="bg-transparent border border-line rounded-lg p-2 focus:border-clay outline-none text-sm resize-none placeholder:text-muted/60"
              />
              <button
                type="submit"
                disabled={saving || !form.company.trim() || !form.role.trim()}
                className="self-start px-4 py-1.5 rounded-full bg-clay text-ink text-sm font-medium disabled:opacity-40"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </form>
          )}

          {error && <p className="text-sm text-fire">{error}</p>}

          {apps === null && <p className="text-sm text-muted">Loading…</p>}
          {apps?.length === 0 && <p className="text-sm text-muted italic">No applications logged yet.</p>}

          {apps && apps.length > 0 && (
            <div className="flex flex-col divide-y divide-line">
              {apps.map((app) => (
                <div key={app.id} className="py-2.5 flex flex-col gap-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm text-cream">{app.role}</p>
                      <p className="text-xs text-muted">
                        {app.company}
                        {app.expected_salary ? ` · $${Number(app.expected_salary).toLocaleString()}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {app.job_url && (
                        <a href={app.job_url} target="_blank" rel="noreferrer" className="text-muted hover:text-clay">
                          <ExternalLink size={13} />
                        </a>
                      )}
                      <button type="button" onClick={() => remove(app)} className="text-muted hover:text-fire">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted">{app.applied_date}</span>
                    <select
                      value={app.status}
                      onChange={(e) => changeStatus(app, e.target.value)}
                      className={`text-xs bg-transparent border border-line rounded-full px-2 py-0.5 ${STATUS_COLOR[app.status] || "text-muted"}`}
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s} className="bg-panel text-cream">
                          {STATUS_LABEL[s]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
