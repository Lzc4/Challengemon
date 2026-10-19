"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useProfiles, useUser } from "@/lib/hooks";
import { PLAYER_COLORS } from "./TownMap";

interface Message {
  id: number;
  user_id: string;
  body: string;
  created_at: string;
}

function readSeen(key: string) {
  try {
    return Number(localStorage.getItem(key)) || 0;
  } catch {
    return 0;
  }
}

export default function ChatDock({ runId, inGame }: { runId: string; inGame?: boolean }) {
  const seenKey = `chat-seen:${runId}`;
  const user = useUser();
  const profiles = useProfiles();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [seen, setSeen] = useState(0);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSeen(readSeen(seenKey));
    const client = supabase();
    client
      .from("chat_messages")
      .select("*")
      .eq("run_id", runId)
      .order("created_at", { ascending: false })
      .limit(60)
      .then(({ data }: { data: Message[] | null }) => setMessages((data ?? []).reverse()));
    const channel = client
      .channel(`chat-${runId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `run_id=eq.${runId}` }, (payload: { new: Message }) =>
        setMessages((cur) => (cur.some((m) => m.id === payload.new.id) ? cur : [...cur.slice(-59), payload.new])),
      )
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [runId, seenKey]);

  const lastId = messages.at(-1)?.id ?? 0;

  useEffect(() => {
    if (!open || !lastId) return;
    setSeen(lastId);
    try {
      localStorage.setItem(seenKey, String(lastId));
    } catch {}
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [open, lastId, seenKey]);

  const unread = messages.filter((m) => m.id > seen && m.user_id !== user?.id).length;
  const nameOf = (id: string) => profiles.find((p) => p.id === id)?.name ?? "?";
  const colorOf = (id: string) => PLAYER_COLORS[Math.max(0, profiles.findIndex((p) => p.id === id)) % PLAYER_COLORS.length];

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || !user) return;
    setText("");
    const { data } = await supabase().from("chat_messages").insert({ body, run_id: runId }).select().single();
    if (data) setMessages((cur) => (cur.some((m) => m.id === (data as Message).id) ? cur : [...cur.slice(-59), data as Message]));
  }

  if (!user) return null;

  return (
    <div className={`chat-dock${inGame ? " in-game" : ""}`}>
      {open && (
        <div className="chat-panel">
          <div className="chat-head">
            <strong>Chat</strong>
            <button onClick={() => setOpen(false)}>✕</button>
          </div>
          <div className="chat-list" ref={list}>
            {!messages.length && <span className="muted small">Noch keine Nachrichten.</span>}
            {messages.map((m) => (
              <div key={m.id} className={`chat-msg${m.user_id === user.id ? " mine" : ""}`}>
                <span className="chat-meta">
                  <b style={{ color: colorOf(m.user_id) }}>{nameOf(m.user_id)}</b>{" "}
                  {new Date(m.created_at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
                </span>
                <span className="chat-body">{m.body}</span>
              </div>
            ))}
          </div>
          <form className="chat-form" onSubmit={send}>
            <input
              value={text}
              maxLength={1000}
              placeholder="Nachricht…"
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              onKeyUp={(e) => e.stopPropagation()}
            />
            <button className="primary" type="submit">
              ➤
            </button>
          </form>
        </div>
      )}
      {!open && (
        <button className="chat-toggle" onClick={() => setOpen(true)}>
          💬{unread > 0 && <span className="chat-badge">{unread}</span>}
        </button>
      )}
    </div>
  );
}
