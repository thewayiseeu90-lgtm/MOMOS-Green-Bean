"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError("이메일 또는 비밀번호가 올바르지 않습니다.");
      return;
    }
    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-parchment">
      <div className="w-full max-w-sm border border-sand bg-white p-8">
        <p className="label-eyebrow mb-2">MOMOS GREEN BEAN OPS</p>
        <h1 className="font-display text-2xl mb-6">생두 계약 대시보드</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm mb-1">이메일</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-sand px-3 py-2 bg-white"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">비밀번호</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-sand px-3 py-2 bg-white"
            />
          </div>
          {error && <p className="text-clay text-sm">{error}</p>}
          <button
            disabled={loading}
            className="w-full bg-ink text-parchment py-2 hover:bg-bark transition"
          >
            {loading ? "확인 중..." : "로그인"}
          </button>
        </form>
        <p className="text-xs text-bark/50 mt-6">
          계정은 관리자가 발급합니다. 계정이 없다면 관리팀에 문의하세요.
        </p>
      </div>
    </div>
  );
}
