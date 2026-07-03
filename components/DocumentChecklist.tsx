"use client";

import { createClient } from "@/lib/supabase/client";
import { useState } from "react";

interface DocRow {
  id: string;
  doc_type: string;
  required: boolean;
  draft_received: boolean;
  original_received: boolean;
  final_approved: boolean;
  issue_note: string | null;
  revision_due: string | null;
}

export default function DocumentChecklist({ initialDocs }: { initialDocs: DocRow[] }) {
  const supabase = createClient();
  const [docs, setDocs] = useState(initialDocs);

  async function toggle(id: string, field: keyof DocRow, value: boolean) {
    setDocs((prev) => prev.map((d) => (d.id === id ? { ...d, [field]: value } : d)));
    await supabase.from("documents").update({ [field]: value }).eq("id", id);
  }

  if (docs.length === 0) {
    return <p className="text-sm text-bark/50">계약이 확정되면 서류 체크리스트가 자동으로 생성됩니다.</p>;
  }

  return (
    <table className="w-full text-sm">
      <thead className="label-eyebrow text-left border-b border-sand">
        <tr>
          <th className="py-2">문서명</th>
          <th className="py-2">초안 수령</th>
          <th className="py-2">원본 수령</th>
          <th className="py-2">최종 승인</th>
          <th className="py-2">문제 사항</th>
        </tr>
      </thead>
      <tbody>
        {docs.map((d) => {
          const blocked = d.required && !d.final_approved;
          return (
            <tr key={d.id} className={`border-b border-sand ${blocked ? "bg-clay/5" : ""}`}>
              <td className="py-2">{d.doc_type}</td>
              <td className="py-2">
                <input type="checkbox" checked={d.draft_received}
                  onChange={(e) => toggle(d.id, "draft_received", e.target.checked)} />
              </td>
              <td className="py-2">
                <input type="checkbox" checked={d.original_received}
                  onChange={(e) => toggle(d.id, "original_received", e.target.checked)} />
              </td>
              <td className="py-2">
                <input type="checkbox" checked={d.final_approved}
                  onChange={(e) => toggle(d.id, "final_approved", e.target.checked)} />
              </td>
              <td className="py-2 text-bark/60">{d.issue_note ?? "-"}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
