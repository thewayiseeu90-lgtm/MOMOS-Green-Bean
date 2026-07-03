"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CONTRACT_STATUSES, ContractStatus } from "@/lib/types";
import { useState } from "react";

export default function StatusSelector({
  contractId,
  currentStatus,
}: {
  contractId: string;
  currentStatus: ContractStatus;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [value, setValue] = useState(currentStatus);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleChange(newStatus: ContractStatus) {
    setSaving(true);
    setError(null);
    const { error } = await supabase
      .from("contracts")
      .update({ status: newStatus })
      .eq("id", contractId);
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setValue(newStatus);
    router.refresh();
  }

  return (
    <div>
      <select
        value={value}
        disabled={saving}
        onChange={(e) => handleChange(e.target.value as ContractStatus)}
        className="input font-medium"
      >
        {CONTRACT_STATUSES.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
      {error && <p className="text-clay text-xs mt-1">{error}</p>}
      {value === "계약확정" && (
        <p className="text-xs text-moss mt-1">
          계약확정으로 변경 시 필수정보가 모두 입력되어 있어야 하며, 자동으로 물류 인계 알림과
          수입서류 체크리스트가 생성됩니다.
        </p>
      )}
    </div>
  );
}
