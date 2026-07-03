"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  LotDraft, computeLotTotals,
  COFFEE_ORIGINS, PAYMENT_METHOD_OPTIONS,
} from "@/lib/types";
import {
  createContractWithLots, createSupplier,
  updateContractFilePath,
} from "./actions";

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────
const CURRENT_YEAR = new Date().getFullYear();

function fmtNum(n: number, decimals = 2) {
  if (!n) return "—";
  return n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function emptyLot(): LotDraft {
  return {
    id: crypto.randomUUID(),
    lot_description: "",
    price_per_lb: "",
    unit_type: "bag",
    quantity: "",
    weight_per_unit_kg: "60",
  };
}

// ──────────────────────────────────────────────────────────
// Props
// ──────────────────────────────────────────────────────────
interface Supplier { id: string; name: string; country: string | null; country_code: string | null; }

interface Props {
  suppliers: Supplier[];
  /** 수정 모드에서 사용 — 기존 값을 초기값으로 주입 */
  initialData?: {
    id: string;
    crop_year: number;
    origin: string | null;
    supplier_id: string;
    payment_method: string | null;
    payment_terms_detail: string | null;
    lots: LotDraft[];
  };
}

// ──────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────
export default function ContractForm({ suppliers: initialSuppliers, initialData }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const isEdit = !!initialData;

  // ── Crop Year ──────────────────────────────────────────
  const [availableYears, setAvailableYears] = useState<number[]>([
    CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1,
  ]);
  const [selectedYear, setSelectedYear] = useState<number>(
    initialData?.crop_year ?? CURRENT_YEAR
  );
  const [customYearInput, setCustomYearInput] = useState("");
  const [showYearInput, setShowYearInput] = useState(false);

  // ── Basic info ─────────────────────────────────────────
  const [origin, setOrigin] = useState(initialData?.origin ?? "");
  const [suppliers, setSuppliers] = useState(initialSuppliers);
  const [supplierId, setSupplierId] = useState(initialData?.supplier_id ?? "");
  const [paymentMethod, setPaymentMethod] = useState<string>(
    initialData?.payment_method ?? ""
  );
  const [paymentTermsDetail, setPaymentTermsDetail] = useState(
    initialData?.payment_terms_detail ?? ""
  );

  // ── New supplier inline form ───────────────────────────
  const [showNewSupplier, setShowNewSupplier] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState("");
  const [newSupplierCountry, setNewSupplierCountry] = useState("");
  const [newSupplierCode, setNewSupplierCode] = useState("");
  const [newSupplierContact, setNewSupplierContact] = useState("");
  const [newSupplierPhone, setNewSupplierPhone] = useState("");
  const [newSupplierEmail, setNewSupplierEmail] = useState("");
  const [addingSupplier, setAddingSupplier] = useState(false);

  // ── Lots ───────────────────────────────────────────────
  const [lots, setLots] = useState<LotDraft[]>(
    initialData?.lots.length ? initialData.lots : [emptyLot()]
  );

  // ── File ───────────────────────────────────────────────
  const [contractFile, setContractFile] = useState<File | null>(null);

  // ── Submit ─────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Computed totals ────────────────────────────────────
  const grandTotals = lots.reduce(
    (acc, lot) => {
      const t = computeLotTotals(lot);
      return {
        bags:       acc.bags + (parseInt(lot.quantity) || 0),
        weight_kg:  acc.weight_kg  + t.total_weight_kg,
        weight_lbs: acc.weight_lbs + t.total_weight_lbs,
        price_usd:  acc.price_usd  + t.total_price_usd,
      };
    },
    { bags: 0, weight_kg: 0, weight_lbs: 0, price_usd: 0 }
  );

  // ──────────────────────────────────────────────────────
  // Lot handlers
  // ──────────────────────────────────────────────────────
  function addLot() {
    setLots((prev) => [...prev, emptyLot()]);
  }

  function removeLot(id: string) {
    if (lots.length === 1) return; // 최소 1개 유지
    setLots((prev) => prev.filter((l) => l.id !== id));
  }

  function updateLot(id: string, field: keyof LotDraft, value: string) {
    setLots((prev) =>
      prev.map((l) => (l.id === id ? { ...l, [field]: value } : l))
    );
  }

  // ──────────────────────────────────────────────────────
  // Crop year handlers
  // ──────────────────────────────────────────────────────
  function addCustomYear() {
    const y = parseInt(customYearInput);
    if (!y || y < 2000 || y > 2100) return;
    if (!availableYears.includes(y)) {
      setAvailableYears((prev) => [...prev, y].sort((a, b) => a - b));
    }
    setSelectedYear(y);
    setCustomYearInput("");
    setShowYearInput(false);
  }

  // ──────────────────────────────────────────────────────
  // New supplier inline save
  // ──────────────────────────────────────────────────────
  async function handleAddSupplier() {
    if (!newSupplierName) return;
    setAddingSupplier(true);
    try {
      const s = await createSupplier({
        name:          newSupplierName,
        country:       newSupplierCountry,
        country_code:  newSupplierCode,
        contact_name:  newSupplierContact,
        contact_phone: newSupplierPhone,
        contact_email: newSupplierEmail,
      });
      setSuppliers((prev) => [...prev, { id: s.id, name: s.name, country: newSupplierCountry, country_code: newSupplierCode }]);
      setSupplierId(s.id);
      setShowNewSupplier(false);
      setNewSupplierName(""); setNewSupplierCountry(""); setNewSupplierCode("");
      setNewSupplierContact(""); setNewSupplierPhone(""); setNewSupplierEmail("");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setAddingSupplier(false);
    }
  }

  // ──────────────────────────────────────────────────────
  // Submit
  // ──────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supplierId)     { setError("수출회사를 선택해주세요"); return; }
    if (!origin)         { setError("산지를 선택해주세요"); return; }
    if (!paymentMethod)  { setError("결제 방식을 선택해주세요"); return; }
    if (lots.some((l) => !l.price_per_lb || !l.quantity)) {
      setError("모든 Lot의 Price/lb와 수량을 입력해주세요");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { id } = await createContractWithLots({
        crop_year:            selectedYear,
        origin,
        supplier_id:          supplierId,
        payment_method:       paymentMethod,
        payment_terms_detail: paymentTermsDetail || undefined,
        lots: lots.map((l, idx) => ({
          lot_seq:            idx + 1,
          lot_description:    l.lot_description,
          price_per_lb:       parseFloat(l.price_per_lb) || 0,
          unit_type:          l.unit_type,
          quantity:           parseInt(l.quantity) || 0,
          weight_per_unit_kg: parseFloat(l.weight_per_unit_kg) || 60,
        })),
      });

      // 파일 업로드 (별도 처리)
      if (contractFile) {
        const path = `${id}/contract-${Date.now()}-${contractFile.name}`;
        const { error: uploadErr } = await supabase.storage
          .from("contract-files")
          .upload(path, contractFile);
        if (!uploadErr) {
          await updateContractFilePath(id, path);
        }
      }

      router.push(`/contracts/${id}`);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  }

  // ──────────────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* ── 1. Crop Year ──────────────────────────────── */}
      <Section title="Crop Year">
        <div className="flex flex-wrap gap-2 items-center">
          {availableYears.map((y) => (
            <button
              key={y}
              type="button"
              onClick={() => setSelectedYear(y)}
              className={`px-4 py-1.5 text-sm border transition ${
                selectedYear === y
                  ? "bg-ink text-parchment border-ink"
                  : "border-sand hover:border-bark"
              }`}
            >
              {y}
            </button>
          ))}

          {showYearInput ? (
            <div className="flex gap-1">
              <input
                type="number"
                value={customYearInput}
                onChange={(e) => setCustomYearInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustomYear())}
                placeholder="연도 입력"
                className="input w-28"
                autoFocus
              />
              <button type="button" onClick={addCustomYear} className="px-3 py-1.5 bg-moss text-white text-sm">추가</button>
              <button type="button" onClick={() => setShowYearInput(false)} className="px-3 py-1.5 border border-sand text-sm">취소</button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowYearInput(true)}
              className="px-3 py-1.5 border border-dashed border-sand text-sm hover:border-bark"
            >
              + 연도 추가
            </button>
          )}
        </div>
      </Section>

      {/* ── 2. 기본 정보 ──────────────────────────────── */}
      <Section title="기본 정보">
        <div className="grid grid-cols-2 gap-4">
          {/* 산지 */}
          <Field label="산지 *">
            <select
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              className="input"
            >
              <option value="">산지 선택</option>
              {COFFEE_ORIGINS.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </Field>

          {/* 수출회사 */}
          <Field label="수출회사 *">
            <div className="flex gap-2">
              <select
                value={supplierId}
                onChange={(e) => {
                  setSupplierId(e.target.value);
                  setShowNewSupplier(false);
                }}
                className="input flex-1"
              >
                <option value="">선택</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}{s.country ? ` (${s.country})` : ""}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowNewSupplier((v) => !v)}
                className="px-3 border border-sand text-sm whitespace-nowrap hover:border-bark"
              >
                {showNewSupplier ? "취소" : "+ 신규"}
              </button>
            </div>

            {showNewSupplier && (
              <div className="mt-2 p-3 border border-sand bg-parchment space-y-2">
                <p className="label-eyebrow">신규 수출회사 입력</p>
                <div className="grid grid-cols-2 gap-2">
                  <input placeholder="회사명 *" value={newSupplierName} onChange={(e) => setNewSupplierName(e.target.value)} className="input col-span-2" />
                  <input placeholder="국가 (예: Ethiopia)" value={newSupplierCountry} onChange={(e) => setNewSupplierCountry(e.target.value)} className="input" />
                  <input placeholder="국가코드 (예: ETH)" value={newSupplierCode} onChange={(e) => setNewSupplierCode(e.target.value)} className="input" />
                  <input placeholder="담당자명" value={newSupplierContact} onChange={(e) => setNewSupplierContact(e.target.value)} className="input" />
                  <input placeholder="전화/WhatsApp" value={newSupplierPhone} onChange={(e) => setNewSupplierPhone(e.target.value)} className="input" />
                  <input placeholder="이메일" type="email" value={newSupplierEmail} onChange={(e) => setNewSupplierEmail(e.target.value)} className="input col-span-2" />
                </div>
                <button
                  type="button"
                  onClick={handleAddSupplier}
                  disabled={addingSupplier || !newSupplierName}
                  className="bg-ink text-parchment px-4 py-1.5 text-sm disabled:opacity-50"
                >
                  {addingSupplier ? "저장 중..." : "저장"}
                </button>
              </div>
            )}
          </Field>

          {/* 결제 방식 */}
          <Field label="결제 방식 *" wide>
            <div className="flex flex-wrap gap-2">
              {PAYMENT_METHOD_OPTIONS.map((pm) => (
                <button
                  key={pm}
                  type="button"
                  onClick={() => setPaymentMethod(pm)}
                  className={`px-3 py-1 text-sm border transition ${
                    paymentMethod === pm
                      ? "bg-ink text-parchment border-ink"
                      : "border-sand hover:border-bark"
                  }`}
                >
                  {pm}
                </button>
              ))}
            </div>
          </Field>

          {/* 결제 조건 상세 */}
          <Field label="결제 조건 상세" wide>
            <input
              value={paymentTermsDetail}
              onChange={(e) => setPaymentTermsDetail(e.target.value)}
              placeholder="예: 선적 전 30%, B/L 사본 수령 후 70%"
              className="input"
            />
          </Field>
        </div>
      </Section>

      {/* ── 3. Lot 명세 ───────────────────────────────── */}
      <Section title="Lot 명세">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="label-eyebrow text-left border-b border-sand">
              <tr>
                <th className="py-2 pr-2 w-6">#</th>
                <th className="py-2 pr-2">Lot Description</th>
                <th className="py-2 pr-2 w-28">Price/lb (USD)</th>
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
                    <td className="py-2 pr-2">
                      <input
                        value={lot.lot_description}
                        onChange={(e) => updateLot(lot.id, "lot_description", e.target.value)}
                        placeholder="예: Yirgacheffe G1 Natural"
                        className="input"
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        type="number"
                        step="0.001"
                        value={lot.price_per_lb}
                        onChange={(e) => updateLot(lot.id, "price_per_lb", e.target.value)}
                        placeholder="0.000"
                        className="input text-right"
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <select
                        value={lot.unit_type}
                        onChange={(e) => updateLot(lot.id, "unit_type", e.target.value as "bag" | "box")}
                        className="input"
                      >
                        <option value="bag">Bag</option>
                        <option value="box">Box</option>
                      </select>
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        type="number"
                        value={lot.quantity}
                        onChange={(e) => updateLot(lot.id, "quantity", e.target.value)}
                        placeholder="0"
                        className="input text-right"
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        type="number"
                        step="0.1"
                        value={lot.weight_per_unit_kg}
                        onChange={(e) => updateLot(lot.id, "weight_per_unit_kg", e.target.value)}
                        className="input text-right"
                      />
                    </td>
                    <td className="py-2 pr-2 text-right font-mono text-xs">
                      {t.total_weight_kg > 0 ? fmtNum(t.total_weight_kg, 1) : "—"}
                    </td>
                    <td className="py-2 pr-2 text-right font-mono text-xs">
                      {t.total_price_usd > 0 ? `$${fmtNum(t.total_price_usd)}` : "—"}
                    </td>
                    <td className="py-2">
                      {lots.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeLot(lot.id)}
                          className="text-clay hover:text-bark text-lg leading-none"
                          title="삭제"
                        >
                          ×
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <button
          type="button"
          onClick={addLot}
          className="mt-3 px-4 py-1.5 border border-dashed border-sand text-sm hover:border-bark"
        >
          + Lot 추가
        </button>

        {/* 합계 */}
        {grandTotals.bags > 0 && (
          <div className="mt-4 flex gap-6 py-3 border-t border-sand text-sm">
            <span className="label-eyebrow self-center">합계</span>
            <Stat label="총 수량" value={`${grandTotals.bags.toLocaleString()} units`} />
            <Stat label="총 중량" value={`${fmtNum(grandTotals.weight_kg, 1)} kg`} />
            <Stat label="총 중량 (lbs)" value={`${fmtNum(grandTotals.weight_lbs, 1)} lbs`} />
            <Stat
              label="합계 금액"
              value={`USD ${fmtNum(grandTotals.price_usd)}`}
              highlight
            />
          </div>
        )}
      </Section>

      {/* ── 4. 계약서 파일 ───────────────────────────── */}
      <Section title="계약서 파일">
        <Field label="계약서 업로드 (PDF / Word)">
          <input
            type="file"
            accept=".pdf,.doc,.docx"
            onChange={(e) => setContractFile(e.target.files?.[0] ?? null)}
            className="input"
          />
        </Field>
        {contractFile && (
          <p className="text-sm text-moss mt-1">
            ✓ {contractFile.name} ({(contractFile.size / 1024).toFixed(0)} KB)
          </p>
        )}
      </Section>

      {/* ── Error / Submit ────────────────────────────── */}
      {error && (
        <p className="text-clay text-sm border border-clay/30 bg-clay/5 px-4 py-2">{error}</p>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="bg-ink text-parchment px-6 py-2.5 disabled:opacity-50"
        >
          {loading ? "저장 중..." : isEdit ? "수정 저장" : "계약 등록"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-6 py-2.5 border border-sand hover:border-bark"
        >
          취소
        </button>
      </div>
    </form>
  );
}

// ──────────────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-sand bg-white p-5">
      <h2 className="font-display text-lg mb-4">{title}</h2>
      {children}
    </div>
  );
}

function Field({
  label, children, wide,
}: {
  label: string; children: React.ReactNode; wide?: boolean;
}) {
  return (
    <label className={`block text-sm ${wide ? "col-span-2" : ""}`}>
      <span className="block mb-1 text-bark/70">{label}</span>
      {children}
    </label>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="label-eyebrow">{label}</p>
      <p className={`font-display text-base ${highlight ? "text-clay" : ""}`}>{value}</p>
    </div>
  );
}
