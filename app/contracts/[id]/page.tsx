import { createClient } from "@/lib/supabase/server";
import StatusSelector from "@/components/StatusSelector";
import DocumentChecklist from "@/components/DocumentChecklist";
import DecisionLogForm from "@/components/DecisionLogForm";
import { Contract } from "@/lib/types";
import Link from "next/link";

function fmtNum(n: number | null | undefined, d = 2) {
  if (!n) return "—";
  return n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}

export default async function ContractDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user!.id).single();

  const { data: contract } = await supabase
    .from("contracts")
    .select("*, suppliers(*)")
    .eq("id", params.id)
    .single();

  if (!contract) return <p>계약을 찾을 수 없습니다.</p>;
  const c = contract as unknown as Contract & { suppliers: any };

  const [{ data: lots }, { data: shipments }, { data: documents }, { data: decisions }, { data: risks }] = await Promise.all([
    supabase.from("contract_lots").select("*").eq("contract_id", params.id).order("lot_seq"),
    supabase.from("shipments").select("*").eq("contract_id", params.id).order("shipment_seq"),
    supabase.from("documents").select("*").in(
      "shipment_id",
      ((await supabase.from("shipments").select("id").eq("contract_id", params.id)).data ?? []).map((s: any) => s.id)
    ),
    supabase.from("decision_log").select("*, profiles(name)").eq("contract_id", params.id).order("decision_date", { ascending: false }),
    supabase.from("risks").select("*").eq("contract_id", params.id),
  ]);

  // Lot 합계
  const lotTotals = (lots ?? []).reduce(
    (acc: any, l: any) => ({
      bags: acc.bags + (l.quantity ?? 0),
      weight_kg: acc.weight_kg + (l.total_weight_kg ?? 0),
      price_usd: acc.price_usd + (l.total_price_usd ?? 0),
    }),
    { bags: 0, weight_kg: 0, price_usd: 0 }
  );

  const contractFileUrl = c.contract_file_path
    ? supabase.storage.from("contract-files").getPublicUrl(c.contract_file_path).data.publicUrl
    : null;

  const canEdit = ["buyer", "admin"].includes(profile?.role ?? "");

  return (
    <div className="space-y-8">
      {/* ── Header ───────────────────────────────── */}
      <div>
        <Link href="/contracts" className="text-sm text-bark/50 hover:text-clay">← 계약 목록</Link>
        <div className="flex items-start justify-between mt-2">
          <div>
            <p className="label-eyebrow">{c.contract_code}</p>
            <h1 className="font-display text-3xl">
              {c.suppliers?.name}{c.origin ? ` · ${c.origin}` : ""}
            </h1>
          </div>
          <div className="flex items-start gap-3">
            {canEdit && (
              <Link
                href={`/contracts/${c.id}/edit`}
                className="border border-sand px-4 py-2 text-sm hover:border-bark"
              >
                수정
              </Link>
            )}
            <div className="w-56">
              <StatusSelector contractId={c.id} currentStatus={c.status} />
            </div>
          </div>
        </div>
      </div>

      {/* ── 최초 등록일 + 현재상태 헤더 카드 ─────── */}
      <div className="grid grid-cols-4 gap-4 border border-sand bg-white p-4">
        <div>
          <p className="label-eyebrow">최초 등록일</p>
          <p className="font-mono text-sm mt-1">
            {new Date(c.created_at).toLocaleString("ko-KR", {
              year: "numeric", month: "2-digit", day: "2-digit",
              hour: "2-digit", minute: "2-digit",
            })}
          </p>
          <p className="text-xs text-bark/40 mt-0.5">변경 불가</p>
        </div>
        <Info label="현재 상태" value={c.status} />
        <Info label="다음 행동" value={c.next_action ?? "—"} />
        <Info label="마감일" value={c.next_action_due ?? "—"} />
      </div>

      {/* ── 계약 기본 정보 ────────────────────────── */}
      <Section title="계약 기본 정보">
        <div className="grid grid-cols-3 gap-4 text-sm">
          <Info label="Crop Year" value={String(c.crop_year)} />
          <Info label="산지 (Origin)" value={(c as any).origin ?? "—"} />
          <Info label="수출회사" value={c.suppliers?.name ?? "—"} />
          <Info label="결제 방식" value={c.payment_method ?? "—"} />
          <Info label="결제 조건 상세" value={c.payment_terms_detail ?? "—"} wide />
          <Info label="계약서" value={
            contractFileUrl
              ? <a href={contractFileUrl} className="text-clay underline" target="_blank" rel="noreferrer">파일 보기</a> as any
              : "미업로드"
          } />
        </div>
      </Section>

      {/* ── Lot 명세 ──────────────────────────────── */}
      <Section title="Lot 명세">
        {(lots ?? []).length === 0 ? (
          <p className="text-sm text-bark/50">등록된 Lot이 없습니다.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="label-eyebrow text-left border-b border-sand">
                  <tr>
                    <th className="py-2 pr-3">#</th>
                    <th className="py-2 pr-3">Lot Description</th>
                    <th className="py-2 pr-3 text-right">Price/lb</th>
                    <th className="py-2 pr-3">형태</th>
                    <th className="py-2 pr-3 text-right">수량</th>
                    <th className="py-2 pr-3 text-right">kg/unit</th>
                    <th className="py-2 pr-3 text-right">총 중량(kg)</th>
                    <th className="py-2 text-right">총 금액(USD)</th>
                  </tr>
                </thead>
                <tbody>
                  {(lots ?? []).map((l: any) => (
                    <tr key={l.id} className="border-b border-sand/60">
                      <td className="py-2 pr-3 text-bark/40">{l.lot_seq}</td>
                      <td className="py-2 pr-3">{l.lot_description ?? "—"}</td>
                      <td className="py-2 pr-3 text-right font-mono">${fmtNum(l.price_per_lb, 3)}</td>
                      <td className="py-2 pr-3 capitalize">{l.unit_type}</td>
                      <td className="py-2 pr-3 text-right">{l.quantity}</td>
                      <td className="py-2 pr-3 text-right">{fmtNum(l.weight_per_unit_kg, 1)}</td>
                      <td className="py-2 pr-3 text-right font-mono">{fmtNum(l.total_weight_kg, 1)}</td>
                      <td className="py-2 text-right font-mono">${fmtNum(l.total_price_usd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex gap-8 mt-4 pt-3 border-t border-sand text-sm">
              <span className="label-eyebrow self-center">합계</span>
              <div>
                <p className="label-eyebrow">총 수량</p>
                <p className="font-display text-lg">{lotTotals.bags.toLocaleString()} units</p>
              </div>
              <div>
                <p className="label-eyebrow">총 중량</p>
                <p className="font-display text-lg">{fmtNum(lotTotals.weight_kg, 1)} kg</p>
              </div>
              <div>
                <p className="label-eyebrow">합계 금액</p>
                <p className="font-display text-lg text-clay">USD {fmtNum(lotTotals.price_usd)}</p>
              </div>
            </div>
          </>
        )}
      </Section>

      {/* ── 선적 현황 ─────────────────────────────── */}
      <Section title="선적 현황">
        {(shipments ?? []).length === 0 ? (
          <p className="text-sm text-bark/50">계약확정 시 선적 1회차가 자동으로 생성됩니다.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="label-eyebrow text-left border-b border-sand">
              <tr><th className="py-2">회차</th><th>ETD</th><th>ETA</th><th>상태</th><th>B/L</th></tr>
            </thead>
            <tbody>
              {(shipments ?? []).map((s: any) => (
                <tr key={s.id} className="border-b border-sand">
                  <td className="py-2">{s.shipment_seq}</td>
                  <td>{s.etd ?? "—"}</td>
                  <td>{s.eta ?? "—"}</td>
                  <td>{s.status}</td>
                  <td>{s.bl_no ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {/* ── 수입서류 체크리스트 ───────────────────── */}
      <Section title="수입서류 체크리스트">
        <DocumentChecklist initialDocs={(documents ?? []) as any} />
      </Section>

      {/* ── 위험 항목 ─────────────────────────────── */}
      {(risks ?? []).length > 0 && (
        <Section title="위험 항목">
          <ul className="text-sm space-y-1">
            {(risks ?? []).map((r: any) => (
              <li key={r.id} className="flex justify-between border-b border-sand py-1">
                <span>[{r.risk_type}] {r.content}</span>
                <span className="text-clay">{r.risk_level}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* ── 커뮤니케이션 결정 기록 ───────────────── */}
      <Section title="커뮤니케이션 결정 기록">
        <div className="space-y-3">
          {(decisions ?? []).map((d: any) => (
            <div key={d.id} className="border-b border-sand pb-2 text-sm">
              <p className="text-bark/50">{d.decision_date} · {d.channel} · {d.profiles?.name}</p>
              <p className="font-medium">[{d.decision_type}] {d.content}</p>
              {d.follow_up && <p className="text-bark/70">→ {d.follow_up}</p>}
            </div>
          ))}
          <DecisionLogForm contractId={c.id} userId={user!.id} />
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border border-sand bg-white p-5">
      <h2 className="font-display text-lg mb-4">{title}</h2>
      {children}
    </section>
  );
}

function Info({ label, value, wide }: { label: string; value: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "col-span-3" : ""}>
      <p className="label-eyebrow">{label}</p>
      <p className="mt-0.5">{value}</p>
    </div>
  );
}
