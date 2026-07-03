"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function DecisionLogForm({
  contractId,
  userId,
}: {
  contractId: string;
  userId: string;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function handleSubmit(formData: FormData) {
    await supabase.from("decision_log").insert({
      contract_id: contractId,
      decision_type: formData.get("decision_type"),
      content: formData.get("content"),
      decided_with: formData.get("decided_with"),
      channel: formData.get("channel"),
      recorded_by: userId,
      follow_up: formData.get("follow_up") || null,
      due_date: formData.get("due_date") || null,
    });
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-sm text-clay border border-clay px-3 py-1">
        + 결정 기록 추가
      </button>
    );
  }

  return (
    <form action={handleSubmit} className="border border-sand p-4 space-y-3 bg-parchment">
      <div className="grid grid-cols-2 gap-3">
        <select name="decision_type" className="input" required>
          <option value="">결정 유형</option>
          <option>가격합의</option><option>수량변경</option><option>품질조건변경</option>
          <option>선적일정변경</option><option>결제조건변경</option><option>계약해석</option>
          <option>비용부담</option><option>클레임가능약속</option>
        </select>
        <select name="channel" className="input" required>
          <option value="">채널</option>
          <option>WhatsApp</option><option>이메일</option><option>전화</option>
        </select>
      </div>
      <textarea name="content" placeholder="결정 내용" required rows={2} className="input" />
      <div className="grid grid-cols-2 gap-3">
        <input name="decided_with" placeholder="결정 당사자 (예: 공급자 담당자명)" className="input" />
        <input name="due_date" type="date" className="input" />
      </div>
      <input name="follow_up" placeholder="후속 행동 (예: 공급자가 계약서 발송)" className="input" />
      <div className="flex gap-2">
        <button type="submit" className="bg-ink text-parchment px-4 py-1.5 text-sm">저장</button>
        <button type="button" onClick={() => setOpen(false)} className="px-4 py-1.5 text-sm">취소</button>
      </div>
    </form>
  );
}
