"use client";

import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { useMyProfile } from "@/lib/hooks";
import NextcloudBanner from "./NextcloudBanner";
import Tutorial from "./tutorial/Tutorial";

export default function Nav() {
  const me = useMyProfile();

  async function logout() {
    await supabase().auth.signOut();
    window.location.href = "/login";
  }

  return (
    <>
      <nav className="nav">
        <Link href="/" className="brand">
          Challengemon
        </Link>
        <Link href="/" data-tour="runs">
          Runs
        </Link>
        <Link href="/library" data-tour="bibliothek">
          Bibliothek
        </Link>
        <Link href="/speicher" data-tour="speicher">
          Speicher
        </Link>
        <Link href="/spiele" data-tour="spiele">
          Spiele
        </Link>
        <Link href="/statistik" data-tour="statistik">
          Statistik
        </Link>
        <Link href="/konto" className="muted small">
          {me?.name ?? ""}
        </Link>
        <button onClick={logout}>Logout</button>
        <Tutorial />
      </nav>
      <NextcloudBanner />
    </>
  );
}
