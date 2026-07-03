import { createClient } from "@/lib/supabase/server";
import { Contract } from "@/lib/types";
import StatusBadge from "@/components/StatusBadge";
import Link from "next/link";

export default async function ContractsPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user!.id).single();

  let query = supabase
    .from("contracts")
    .select("*, suppliers(name, country)")
    .order("updated_at", { ascending: false });

  if (searchParams.q) {
    query = query.or(
      `contract_code.ilike.%${searchParams.q}%,farm_name.ilike.%${searchParams.q}%`
    );
  }

  const { data } = await query;
  const list = (data ?? []) as unknown as Contract[];

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <p className="label-eyebrow">{profile?.role} 뷰</p>
          <h1 className="font-display text-3xl">계약 목록</h1>
        </div>
        <form className="flex gap-2">
          <input
            name="q"
            defaultValue={searchParams.q}
            placeholder="계약ID 또는 농장명 검색"
            className="border border-sand px-3 py-1.5 text-sm w-64"
          />
          <button className="border border-bark px-3 py-1.5 text-sm">검색</button>
        </form>
      </div>

      <div className="border border-sand bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-parchment label-eyebrow">
            <tr className="text-left">
              <th className="px-3 py-2">계약 ID</th>
              <th className="px-3 py-2">공급자</th>
              <th className="px-3 py-2">상태</th>
              <th className="px-3 py-2">수량</th>
              <th className="px-3 py-2">금액</th>
              <th className="px-3 py-2">다음 행동</th>
              <th className="px-3 py-2">기한</th>
            </tr>
          </thead>
          <tbody>
            {list.map((c) => {
              const overdue = c.next_action_due && new Date(c.next_action_due) < new Date();
              return (
                <tr key={c.id} className="border-t border-sand hover:bg-parchment/60">
                  <td className="px-3 py-2">
                    <Link href={`/contracts/${c.id}`} className="font-mono text-xs hover:text-clay">
                      {c.contract_code}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{c.suppliers?.name}</td>
                  <td className="px-3 py-2"><StatusBadge status={c.status} /></td>
                  <td className="px-3 py-2">{c.contract_quantity?.toLocaleString() ?? "-"} {c.quantity_unit}</td>
                  <td className="px-3 py-2">{c.contract_total_amount?.toLocaleString() ?? "-"} {c.currency}</td>
                  <td className="px-3 py-2 max-w-[200px] truncate">{c.next_action ?? "-"}</td>
                  <td className={`px-3 py-2 ${overdue ? "text-clay font-medium" : ""}`}>
                    {c.next_action_due ?? "-"}
                  </td>
                </tr>
              );
            })}
            {list.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-bark/50">계약이 없습니다.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
