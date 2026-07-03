import type { Metadata } from "next";
import "./globals.css";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import NotificationBell from "@/components/NotificationBell";

export const metadata: Metadata = {
  title: "모모스 생두 계약 대시보드",
  description: "계약·물류·결제·신용장을 하나로 연결하는 내부 운영 시스템",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data } = await supabase.auth.getUser();

  let profile = null;
  if (data.user) {
    const { data: p } = await supabase
      .from("profiles")
      .select("id, name, role")
      .eq("id", data.user.id)
      .single();
    profile = p;
  }

  return (
    <html lang="ko">
      <body className="font-body min-h-screen">
        {profile && (
          <header className="border-b border-sand bg-ink text-parchment">
            <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
              <div className="flex items-center gap-6">
                <Link href="/dashboard" className="font-display text-lg tracking-tight">
                  모모스 · 생두 계약
                </Link>
                <nav className="flex gap-4 text-sm">
                  <Link href="/dashboard" className="hover:text-clay">대시보드</Link>
                  <Link href="/contracts" className="hover:text-clay">계약 목록</Link>
                  <Link href="/contracts/new" className="hover:text-clay">+ 신규 계약</Link>
                </nav>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <NotificationBell userId={profile.id} />
                <span className="label-eyebrow text-parchment/70">{profile.role}</span>
                <span>{profile.name}</span>
                <form action="/auth/sign-out" method="post">
                  <button className="text-parchment/60 hover:text-clay">로그아웃</button>
                </form>
              </div>
            </div>
          </header>
        )}
        <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
