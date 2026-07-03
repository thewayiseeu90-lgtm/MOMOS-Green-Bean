import { createClient } from "@/lib/supabase/server";
import { Contract, STAGE_GROUPS, STAGE_GROUP, ContractStatus } from "@/lib/types";
import StatusBadge from "@/components/StatusBadge";
import Link from "next/link";

export default async function DashboardPage() {
  const supabase = createClient();

  const { data: contracts } = await supabase
    .from("contracts")
    .select("*, suppliers(name, country)")
    .order("updated_at", { ascending: false });

  const list = (contracts ?? []) as unknown as Contract[];

  const active = list.filter((c) => !["계약종결", "취소"].includes(c.status));
  const totalQty = active.reduce((s, c) => s + (c.contract_quantity ?? 0), 0);
  const totalAmount = active.reduce((s, c) => s + (c.contract_total_amount ?? 0), 0);

  const { count: missingOwnerCount } = await supabase
    .from("contracts")
    .select("id", { count: "exact", head: true })
    .is("next_action_owner_id", null)
    .not("status", "in", '("계약종결","취소")');

  const { data: payments } = await supabase
    .from("payments")
    .select("planned_amount, due_date")
    .gte("due_date", new Date().toISOString().slice(0, 10))
    .lte("due_date", new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10));
  const paymentsDue30 = (payments ?? []).reduce((s, p) => s + (p.planned_amount ?? 0), 0);

  const { data: risks } = await supabase
    .from("risks")
    .select("*, contracts(contract_code)")
    .eq("status", "진행중")
    .order("due_date", { ascending: true })
    .limit(8);

  // 칸반 그룹핑
  const grouped: Record<string, Contract[]> = {};
  STAGE_GROUPS.forEach((g) => (grouped[g] = []));
  active.forEach((c) => grouped[STAGE_GROUP[c.status as ContractStatus]]?.push(c));

  // 위험 신호: 다음행동 기한이 지난 계약
  const overdue = active.filter(
    (c) => c.next_action_due && new Date(c.next_action_due) < new Date()
  );

  return (
    <div className="space-y-10">
      <div>
        <p className="label-eyebrow">대시보드</p>
        <h1 className="font-display text-3xl">진행 현황</h1>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard label="진행 중 계약" value={`${active.length}건`} />
        <SummaryCard label="총 계약 수량" value={`${totalQty.toLocaleString()} kg`} />
        <SummaryCard label="총 계약 금액" value={`USD ${totalAmount.toLocaleString()}`} />
        <SummaryCard label="향후 30일 결제예정액" value={`USD ${paymentsDue30.toLocaleString()}`} />
        <SummaryCard
          label="기한 경과 계약"
          value={`${overdue.length}건`}
          tone={overdue.length > 0 ? "warn" : "ok"}
        />
        <SummaryCard
          label="담당자 미지정"
          value={`${missingOwnerCount ?? 0}건`}
          tone={(missingOwnerCount ?? 0) > 0 ? "warn" : "ok"}
        />
      </div>

      {(overdue.length > 0 || (risks && risks.length > 0)) && (
        <section>
          <h2 className="font-display text-xl mb-3">위험 신호</h2>
          <div className="border border-clay/30 bg-clay/5">
            {overdue.map((c) => (
              <Link
                key={c.id}
                href={`/contracts/${c.id}`}
                className="flex justify-between px-4 py-2 border-b border-clay/20 hover:bg-clay/10 text-sm"
              >
                <span>{c.contract_code} · 다음 행동 기한 경과 — {c.next_action}</span>
                <span className="text-clay">{c.next_action_due}</span>
              </Link>
            ))}
            {(risks ?? []).map((r: any) => (
              <div key={r.id} className="flex justify-between px-4 py-2 border-b border-clay/20 text-sm">
                <span>
                  {r.contracts?.contract_code} · [{r.risk_type}] {r.content}
                </span>
                <span className="text-clay">{r.risk_level}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="font-display text-xl mb-3">계약 진행 칸반</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-8 gap-3">
          {STAGE_GROUPS.map((stage) => (
            <div key={stage} className="bg-white border border-sand min-h-[120px]">
              <div className="label-eyebrow px-3 py-2 border-b border-sand">
                {stage} ({grouped[stage].length})
              </div>
              <div className="p-2 space-y-2">
                {grouped[stage].map((c) => (
                  <Link
                    key={c.id}
                    href={`/contracts/${c.id}`}
                    className="block border border-sand p-2 text-xs hover:border-clay transition"
                  >
                    <p className="font-medium truncate">{c.contract_code}</p>
                    <p className="text-bark/60 truncate">{c.suppliers?.name}</p>
                    <StatusBadge status={c.status} />
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "warn" | "ok";
}) {
  const toneClass =
    tone === "warn" ? "border-clay text-clay" : tone === "ok" ? "border-moss text-moss" : "border-sand";
  return (
    <div className={`border ${toneClass} bg-white p-4`}>
      <p className="label-eyebrow mb-1">{label}</p>
      <p className="font-display text-2xl">{value}</p>
    </div>
  );
}
