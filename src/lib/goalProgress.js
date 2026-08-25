const EDUCATION_MILESTONES = ["Applied", "Accepted", "Enrolled", "Coursework in progress", "Graduated"];

export function defaultMilestones() {
  return EDUCATION_MILESTONES.map((label) => ({ label, done: false }));
}

function clamp(n) {
  return Math.max(0, Math.min(100, n));
}

// Returns { percent, isComplete, detailText } for any goal type. jobApps is
// only needed for 'salary' goals — pass [] otherwise.
export function computeProgress(goal, jobApps = []) {
  switch (goal.type) {
    case "debt": {
      const start = Number(goal.starting_amount) || 0;
      const current = Number(goal.current_amount) || 0;
      if (start <= 0) return { percent: 0, isComplete: current <= 0, detailText: `$${current.toLocaleString()} remaining` };
      const percent = clamp(((start - current) / start) * 100);
      return {
        percent,
        isComplete: current <= 0,
        detailText: `$${Math.max(0, current).toLocaleString()} left of $${start.toLocaleString()}`,
      };
    }
    case "savings": {
      const target = Number(goal.target_amount) || 0;
      const current = Number(goal.current_amount) || 0;
      if (target <= 0) return { percent: 0, isComplete: false, detailText: `$${current.toLocaleString()} saved` };
      const percent = clamp((current / target) * 100);
      return {
        percent,
        isComplete: current >= target,
        detailText: `$${current.toLocaleString()} of $${target.toLocaleString()}`,
      };
    }
    case "salary": {
      const target = Number(goal.target_amount) || 0;
      const offers = jobApps.filter((a) => a.status === "offer" && a.expected_salary);
      const others = jobApps.filter((a) => a.status !== "offer" && a.expected_salary);
      const best = offers.length
        ? Math.max(...offers.map((a) => Number(a.expected_salary)))
        : others.length
          ? Math.max(...others.map((a) => Number(a.expected_salary)))
          : 0;
      if (target <= 0) return { percent: 0, isComplete: false, detailText: "Set a target salary" };
      const percent = clamp((best / target) * 100);
      const label = offers.length ? "best offer" : best ? "closest application" : "no applications yet";
      return {
        percent,
        isComplete: best >= target,
        detailText: best ? `$${best.toLocaleString()} (${label}) of $${target.toLocaleString()}` : `Target: $${target.toLocaleString()}`,
      };
    }
    case "education": {
      const milestones = goal.milestones?.length ? goal.milestones : defaultMilestones();
      const done = milestones.filter((m) => m.done).length;
      const percent = milestones.length ? clamp((done / milestones.length) * 100) : 0;
      return { percent, isComplete: done === milestones.length && milestones.length > 0, detailText: `${done}/${milestones.length} milestones` };
    }
    default:
      return { percent: 0, isComplete: false, detailText: "" };
  }
}

export function milestoneBadge(percent) {
  if (percent >= 100) return "🎉 Goal complete!";
  if (percent >= 75) return "Almost there";
  if (percent >= 50) return "Halfway there";
  if (percent >= 25) return "Off to a start";
  return null;
}

const TYPE_LABEL_FOR_SUMMARY = { debt: "Debt payoff", savings: "Savings", salary: "Salary", education: "Education" };

// Short per-goal lines for feeding into the coach's context — real numbers,
// not just the goal titles, so responses can reference actual progress.
export function summarizeGoalsProgress(goals = [], jobApps = []) {
  const active = goals.filter((g) => g.status !== "completed");
  if (!active.length) return "";
  return active
    .map((g) => {
      const { percent, detailText } = computeProgress(g, jobApps);
      const label = TYPE_LABEL_FOR_SUMMARY[g.type] || g.type;
      return `${g.title} (${label}): ${Math.round(percent)}% — ${detailText}`;
    })
    .join("; ");
}
