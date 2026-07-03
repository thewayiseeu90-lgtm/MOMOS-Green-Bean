"use client";

/**
 * 수정 폼은 신규 폼과 완전히 동일한 UI를 공유하되,
 * submit 시 updateContractWithLots를 호출하는 thin wrapper입니다.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  LotDraft, computeLotTotals,
  COFFEE_ORIGINS, PAYMENT_METHOD_OPTIONS,
} from "@/lib/types";
import { createSupplier, updateContractFilePath } from "@/app/contracts/new/actions";
import { updateContractWithLots } from "./actions";

interface Supplier { id: string; name: string; country: string | null; country_code: string | null; }

interface Props {
  contractId: string;
  suppliers: Supplier[];
  initialData: {
    id: string;
    crop_year: number;
    origin: string | null;
    supplier_id: string;
    payment_method: string | null;
    payment_terms_detail: string | null;
    lots: LotDraft[];
  };
}

const CURRENT_YEAR = new Date().getFullYear();

function fmtNum(n: number, d = 2) {
  return n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}

function emptyLot(): LotDraft {
  return { id: crypto.randomUUID(), lot_description: "", price_per_lb: "", unit_type: "bag", quantity: "", weight_per_unit_kg: "60" };
}

export default function ContractEditForm({ contractId, suppliers: initSuppliers, initialData }: Props) {
  const router = useRouter();
  const supabase = createClient();

  const seedYears = [...new Set([CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1, initialData.crop_year])].sort((a, b) => a - b);

  const [availableYears, setAvailableYears] = useState(seedYears);
  const [selectedYear, setSelectedYear] = useState(initialData.crop_year);
  const [customYearInput, setCustomYearInput] = useState("");
  const [showYearInput, setShowYearInput] = useState(false);

  const [origin, setOrigin] = useState(initialData.origin ?? "");
  const [suppliers, setSuppliers] = useState(initSuppliers);
  const [supplierId, setSupplierId] = useState(initialData.supplier_id);
  const [paymentMethod, setPaymentMethod] = useState(initialData.payment_method ?? "");
  const [paymentTermsDetail, setPaymentTermsDetail] = useState(initialData.payment_terms_detail ?? "");

  const [showNewSupplier, setShowNewSupplier] = useState(false);
  const [newS, setNewS] = useState({ name: "", country: "", code: "", contact: "", phone: "", email: "" });
  const [addingSupplier, setAddingSupplier] = useState(false);

  const [lots, setLots] = useState<LotDraft[]>(initialData.lots.length ? initialData.lots : [emptyLot()]);
  const [contractFile, setContractFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const grandTotals = lots.reduce(
    (acc, lot) => {
      const t = computeLotTotals(lot);
      return { bags: acc.bags + (parseInt(lot.quantity) || 0), weight_kg: acc.weight_kg + t.total_weight_kg, weight_lbs: acc.weight_lbs + t.total_weight_lbs, price_usd: acc.price_usd + t.total_price_usd };
    },
    { bags: 0, weight_kg: 0, weight_lbs: 0, price_usd: 0 }
  );

  function addCustomYear() {
    const y = parseInt(customYearInput);
    if (!y || y < 2000 || y > 2100) return;
    if (!availableYears.includes(y)) setAvailableYears((p) => [...p, y].sort((a, b) => a - b));
    setSelectedYear(y); setCustomYearInput(""); setShowYearInput(false);
  }

  async function handleAddSupplier() {
    if (!newS.name) return;
    setAddingSupplier(true);
    try {
      const s = await createSupplier({ name: newS.name, country: newS.country, country_code: newS.code, contact_name: newS.contact, contact_phone: newS.phone, contact_email: newS.email });
      setSuppliers((p) => [...p, { id: s.id, name: s.name, country: newS.country, country_code: newS.code }]);
      setSupplierId(s.id); setShowNewSupplier(false);
      setNewS({ name: "", country: "", code: "", contact: "", phone: "", email: "" });
    } catch (e: any) { setError(e.message); } finally { setAddingSupplier(false); }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supplierId || !origin || !paymentMethod) { setError("필수 항목을 모두 선택해주세요"); return; }
    setLoading(true); setError(null);
    try {
      await updateContractWithLots(contractId, {
        crop_year: selectedYear, origin, supplier_id: supplierId,
        payment_method: paymentMethod, payment_terms_detail: paymentTermsDetail || undefined,
        lots: lots.map((l, i) => ({ lot_seq: i + 1, lot_description: l.lot_description, price_per_lb: parseFloat(l.price_per_lb) || 0, unit_type: l.unit_type, quantity: parseInt(l.quantity) || 0, weight_per_unit_kg: parseFloat(l.weight_per_unit_kg) || 60 })),
      });
      if (contractFile) {
        const path = `${contractId}/contract-${Date.now()}-${contractFile.name}`;
        const { error: up } = await supabase.storage.from("contract-files").upload(path, contractFile);
        if (!up) await updateContractFilePath(contractId, path);
      }
      router.push(`/contracts/${contractId}`);
      router.refresh();
    } catch (err: any) { setError(err.message); setLoading(false); }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Crop Year */}
      <Sec title="Crop Year">
        <div className="flex flex-wrap gap-2 items-center">
          {availableYears.map((y) => (
            <button key={y} type="button" onClick={() => setSelectedYear(y)}
              className={`px-4 py-1.5 text-sm border transition ${selectedYear === y ? "bg-ink text-parchment border-ink" : "border-sand hover:border-bark"}`}>
              {y}
            </button>
          ))}
          {showYearInput ? (
            <div className="flex gap-1">
              <input type="number" value={customYearInput} onChange={(e) => setCustomYearInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustomYear())} placeholder="연도" className="input w-24" autoFocus />
              <button type="button" onClick={addCustomYear} className="px-3 py-1.5 bg-moss text-white text-sm">추가</button>
              <button type="button" onClick={() => setShowYearInput(false)} className="px-3 py-1.5 border border-sand text-sm">취소</button>
            </div>
          ) : (
            <button type="button" onClick={() => setShowYearInput(true)} className="px-3 py-1.5 border border-dashed border-sand text-sm hover:border-bark">+ 연도 추가</button>
          )}
        </div>
      </Sec>

      {/* 기본 정보 */}
      <Sec title="기본 정보">
        <div className="grid grid-cols-2 gap-4">
          <Fld label="산지 *">
            <select value={origin} onChange={(e) => setOrigin(e.target.value)} className="input">
              <option value="">산지 선택</option>
              {COFFEE_ORIGINS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </Fld>
          <Fld label="수출회사 *">
            <div className="flex gap-2">
              <select value={supplierId} onChange={(e) => { setSupplierId(e.target.value); setShowNewSupplier(false); }} className="input flex-1">
                <option value="">선택</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}{s.country ? ` (${s.country})` : ""}</option>)}
              </select>
              <button type="button" onClick={() => setShowNewSupplier((v) => !v)} className="px-3 border border-sand text-sm hover:border-bark">{showNewSupplier ? "취소" : "+ 신규"}</button>
            </div>
            {showNewSupplier && (
              <div className="mt-2 p-3 border border-sand bg-parchment space-y-2">
                <p className="label-eyebrow">신규 수출회사</p>
                <div className="grid grid-cols-2 gap-2">
                  <input placeholder="회사명 *" value={newS.name} onChange={(e) => setNewS({ ...newS, name: e.target.value })} className="input col-span-2" />
                  <input placeholder="국가" value={newS.country} onChange={(e) => setNewS({ ...newS, country: e.target.value })} className="input" />
                  <input placeholder="코드 (ETH...)" value={newS.code} onChange={(e) => setNewS({ ...newS, code: e.target.value })} className="input" />
                  <input placeholder="담당자" value={newS.contact} onChange={(e) => setNewS({ ...newS, contact: e.target.value })} className="input" />
                  <input placeholder="전화" value={newS.phone} onChange={(e) => setNewS({ ...newS, phone: e.target.value })} className="input" />
                  <input placeholder="이메일" value={newS.email} onChange={(e) => setNewS({ ...newS, email: e.target.value })} className="input col-span-2" />
                </div>
                <button type="button" onClick={handleAddSupplier} disabled={addingSupplier || !newS.name} className="bg-ink text-parchment px-4 py-1.5 text-sm disabled:opacity-50">{addingSupplier ? "저장 중..." : "저장"}</button>
              </div>
            )}
          </Fld>
          <Fld label="결제 방식 *" wide>
            <div className="flex flex-wrap gap-2">
              {PAYMENT_METHOD_OPTIONS.map((pm) => (
                <button key={pm} type="button" onClick={() => setPaymentMethod(pm)}
                  className={`px-3 py-1 text-sm border transition ${paymentMethod === pm ? "bg-ink text-parchment border-ink" : "border-sand hover:border-bark"}`}>
                  {pm}
                </button>
              ))}
            </div>
          </Fld>
          <Fld label="결제 조건 상세" wide>
            <input value={paymentTermsDetail} onChange={(e) => setPaymentTermsDetail(e.target.value)} placeholder="예: 선적 전 30%, B/L 사본 수령 후 70%" className="input" />
          </Fld>
        </div>
      </Sec>

      {/* Lot 명세 */}
      <Sec title="Lot 명세">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="label-eyebrow text-left border-b border-sand">
              <tr>
                <th className="py-2 pr-2 w-6">#</th>
                <th className="py-2 pr-2">Lot Description</th>
                <th className="py-2 pr-2 w-28">Price/lb</th>
                <th className="py-2 pr-2 w-24">형태</th>
                <th className="py-2 pr-2 w-20">수량</th>
                <th className="py-2 pr-2 w-24">kg/unit</th>
                <th className="py-2 pr-2 w-28 text-right">총 중량(kg)</th>
                <th className="py-2 pr-2 w-28 text-right">총 금액(USD)</th>
                <th className="py-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {lots.map((lot, idx) => {
                const t = computeLotTotals(lot);
                return (
                  <tr key={lot.id} className="border-b border-sand/60">
                    <td className="py-2 pr-2 text-bark/40 text-xs">{idx + 1}</td>
                    <td className="py-2 pr-2"><input value={lot.lot_description} onChange={(e) => setLots((p) => p.map((l) => l.id === lot.id ? { ...l, lot_description: e.target.value } : l))} placeholder="Lot 설명" className="input" /></td>
                    <td className="py-2 pr-2"><input type="number" step="0.001" value={lot.price_per_lb} onChange={(e) => setLots((p) => p.map((l) => l.id === lot.id ? { ...l, price_per_lb: e.target.value } : l))} placeholder="0.000" className="input text-right" /></td>
                    <td className="py-2 pr-2"><select value={lot.unit_type} onChange={(e) => setLots((p) => p.map((l) => l.id === lot.id ? { ...l, unit_type: e.target.value as "bag" | "box" } : l))} className="input"><option value="bag">Bag</option><option value="box">Box</option></select></td>
                    <td className="py-2 pr-2"><input type="number" value={lot.quantity} onChange={(e) => setLots((p) => p.map((l) => l.id === lot.id ? { ...l, quantity: e.target.value } : l))} placeholder="0" className="input text-right" /></td>
                    <td className="py-2 pr-2"><input type="number" step="0.1" value={lot.weight_per_unit_kg} onChange={(e) => setLots((p) => p.map((l) => l.id === lot.id ? { ...l, weight_per_unit_kg: e.target.value } : l))} className="input text-right" /></td>
                    <td className="py-2 pr-2 text-right font-mono text-xs">{t.total_weight_kg > 0 ? fmtNum(t.total_weight_kg, 1) : "—"}</td>
                    <td className="py-2 pr-2 text-right font-mono text-xs">{t.total_price_usd > 0 ? `$${fmtNum(t.total_price_usd)}` : "—"}</td>
                    <td className="py-2">{lots.length > 1 && <button type="button" onClick={() => setLots((p) => p.filter((l) => l.id !== lot.id))} className="text-clay hover:text-bark text-lg">×</button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <button type="button" onClick={() => setLots((p) => [...p, emptyLot()])} className="mt-3 px-4 py-1.5 border border-dashed border-sand text-sm hover:border-bark">+ Lot 추가</button>
        {grandTotals.bags > 0 && (
          <div className="mt-4 flex gap-6 py-3 border-t border-sand text-sm">
            <span className="label-eyebrow self-center">합계</span>
            <div><p className="label-eyebrow">총 수량</p><p className="font-display">{grandTotals.bags.toLocaleString()} units</p></div>
            <div><p className="label-eyebrow">총 중량</p><p className="font-display">{fmtNum(grandTotals.weight_kg, 1)} kg</p></div>
            <div><p className="label-eyebrow">합계 금액</p><p className="font-display text-clay">USD {fmtNum(grandTotals.price_usd)}</p></div>
          </div>
        )}
      </Sec>

      {/* 계약서 */}
      <Sec title="계약서 파일 교체 (선택)">
        <label className="block text-sm">
          <span className="block mb-1 text-bark/70">새 파일 업로드 (기존 파일이 있다면 교체됩니다)</span>
          <input type="file" accept=".pdf,.doc,.docx" onChange={(e) => setContractFile(e.target.files?.[0] ?? null)} className="input" />
        </label>
      </Sec>

      {error && <p className="text-clay text-sm border border-clay/30 bg-clay/5 px-4 py-2">{error}</p>}

      <div className="flex gap-3">
        <button type="submit" disabled={loading} className="bg-ink text-parchment px-6 py-2.5 disabled:opacity-50">{loading ? "저장 중..." : "수정 저장"}</button>
        <button type="button" onClick={() => router.back()} className="px-6 py-2.5 border border-sand hover:border-bark">취소</button>
      </div>
    </form>
  );
}

function Sec({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="border border-sand bg-white p-5"><h2 className="font-display text-lg mb-4">{title}</h2>{children}</div>;
}
function Fld({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return <label className={`block text-sm ${wide ? "col-span-2" : ""}`}><span className="block mb-1 text-bark/70">{label}</span>{children}</label>;
}
