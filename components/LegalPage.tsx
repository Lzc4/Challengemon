import Link from "next/link";
import LegalFooter from "./LegalFooter";

export const OPERATOR = {
  name: process.env.NEXT_PUBLIC_OPERATOR_NAME ?? "",
  address: process.env.NEXT_PUBLIC_OPERATOR_ADDRESS ?? "",
  email: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "",
};

export default function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <>
      <nav className="nav">
        <Link href="/" className="brand">
          Challengemon
        </Link>
      </nav>
      <main className="container stack legal">
        <h1 style={{ margin: 0 }}>{title}</h1>
        <span className="small muted">Stand: {updated}</span>
        <div className="card stack legal-body">{children}</div>
      </main>
      <LegalFooter />
    </>
  );
}
