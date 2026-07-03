"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

interface Notification {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
}

export default function NotificationBell({ userId }: { userId: string }) {
  const supabase = createClient();
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("notifications")
        .select("id, title, body, link, read, created_at")
        .eq("recipient_id", userId)
        .order("created_at", { ascending: false })
        .limit(10);
      setItems(data ?? []);
    }
    load();
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const unreadCount = items.filter((n) => !n.read).length;

  async function markRead(id: string) {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} className="relative hover:text-clay">
        알림
        {unreadCount > 0 && (
          <span className="absolute -top-2 -right-3 bg-clay text-white text-[10px] rounded-full px-1.5">
            {unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white border border-sand text-bark shadow-lg z-50">
          {items.length === 0 && <p className="p-4 text-sm text-bark/50">알림이 없습니다.</p>}
          {items.map((n) => (
            <Link
              key={n.id}
              href={n.link ?? "#"}
              onClick={() => markRead(n.id)}
              className={`block p-3 border-b border-sand text-sm hover:bg-parchment ${
                n.read ? "opacity-50" : ""
              }`}
            >
              <p className="font-medium">{n.title}</p>
              {n.body && <p className="text-xs mt-1 text-bark/70">{n.body}</p>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
