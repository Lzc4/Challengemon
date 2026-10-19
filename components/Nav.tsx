"use client";

import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { useMyProfile } from "@/lib/hooks";

export default function Nav() {
  const me = useMyProfile();

  async function logout() {
    await supabase().auth.signOut();
    window.location.href = "/login";
  }

  return (
    <nav className="nav">
      <Link href="/" className="brand">
        Challengemon
      </Link>
      <Link href="/">Runs</Link>
      <Link href="/library">Bibliothek</Link>
      <Link href="/speicher">Speicher</Link>
      <Link href="/spiele">Spiele</Link>
      <Link href="/statistik">Statistik</Link>
      <Link href="/konto" className="muted small">
        {me?.name ?? ""}
      </Link>
      <button onClick={logout}>Logout</button>
    </nav>
  );
}
