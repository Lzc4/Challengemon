import Nav from "@/components/Nav";
import LegalFooter from "@/components/LegalFooter";
import { CHANGELOG, type ChangeKind } from "@/lib/changelog";

const KIND: Record<ChangeKind, { label: string; badge: string }> = {
  neu: { label: "Neu", badge: "good" },
  besser: { label: "Besser", badge: "info" },
  fix: { label: "Fix", badge: "warn" },
};

export default function ChangelogPage() {
  return (
    <>
      <Nav />
      <main className="container stack">
        <h1 style={{ margin: 0 }}>Changelog</h1>
        {CHANGELOG.map((r) => (
          <section key={r.version} className="card stack">
            <div className="row">
              <span className="badge">v{r.version}</span>
              <strong style={{ marginRight: "auto" }}>{r.title}</strong>
              <span className="muted small">{new Date(r.date).toLocaleDateString("de-DE")}</span>
            </div>
            <ul className="changelog">
              {r.changes.map((c, i) => (
                <li key={i}>
                  <span className={`badge ${KIND[c.kind].badge}`}>{KIND[c.kind].label}</span>
                  <span>{c.text}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </main>
      <LegalFooter />
    </>
  );
}
