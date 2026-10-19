"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Nav from "@/components/Nav";
import NewRunForm from "@/components/NewRunForm";

function NewRun() {
  const router = useRouter();
  const params = useSearchParams();
  return <NewRunForm initialCode={params.get("code")} onCancel={() => router.back()} />;
}

export default function NewRunPage() {
  return (
    <>
      <Nav />
      <main className="container stack">
        <h1 style={{ margin: 0 }}>Neuer Run</h1>
        <Suspense fallback={<p className="muted">Lädt…</p>}>
          <NewRun />
        </Suspense>
      </main>
    </>
  );
}
