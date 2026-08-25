import ContentEngine from "../components/ContentEngine.jsx";

export default function ContentEngineTab({ onSaved }) {
  return (
    <div className="flex flex-col gap-6">
      <p className="text-xs uppercase tracking-[0.2em] text-muted">Content Engine</p>
      <ContentEngine onSaved={onSaved} />
    </div>
  );
}
