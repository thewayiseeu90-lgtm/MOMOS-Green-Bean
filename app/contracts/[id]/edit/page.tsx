import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import ContractEditForm from "./ContractEditForm";

export default async function EditContractPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const [{ data: contract }, { data: lots }, { data: suppliers }] = await Promise.all([
    supabase
      .from("contracts")
      .select("*, suppliers(id, name, country, country_code)")
      .eq("id", params.id)
      .single(),
    supabase
      .from("contract_lots")
      .select("*")
      .eq("contract_id", params.id)
      .order("lot_seq"),
    supabase
      .from("suppliers")
      .select("id, name, country, country_code")
      .order("name"),
  ]);

  if (!contract) notFound();

  return (
    <div className="max-w-4xl">
      <Link href={`/contracts/${params.id}`} className="text-sm text-bark/50 hover:text-clay">
        ← 계약 상세로 돌아가기
      </Link>
      <div className="flex items-center justify-between mt-2 mb-6">
        <div>
          <p className="label-eyebrow">{contract.contract_code}</p>
          <h1 className="font-display text-3xl">계약 수정</h1>
        </div>
        <div className="text-sm text-bark/50 border border-sand px-3 py-2">
          <span className="label-eyebrow block">최초 등록일</span>
          {new Date(contract.created_at).toLocaleString("ko-KR", {
            year: "numeric", month: "2-digit", day: "2-digit",
            hour: "2-digit", minute: "2-digit",
          })}
        </div>
      </div>

      <ContractEditForm
        contractId={params.id}
        suppliers={suppliers ?? []}
        initialData={{
          id: contract.id,
          crop_year: contract.crop_year,
          origin: contract.origin,
          supplier_id: contract.supplier_id,
          payment_method: contract.payment_method,
          payment_terms_detail: contract.payment_terms_detail,
          lots: (lots ?? []).map((l: any) => ({
            id: l.id,
            lot_description: l.lot_description ?? "",
            price_per_lb: String(l.price_per_lb ?? ""),
            unit_type: l.unit_type as "bag" | "box",
            quantity: String(l.quantity ?? ""),
            weight_per_unit_kg: String(l.weight_per_unit_kg ?? "60"),
          })),
        }}
      />
    </div>
  );
}
