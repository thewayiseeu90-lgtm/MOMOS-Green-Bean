"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export interface LotPayload {
  lot_seq: number;
  lot_description: string;
  price_per_lb: number;
  unit_type: string;
  quantity: number;
  weight_per_unit_kg: number;
}

export interface ContractCreatePayload {
  crop_year: number;
  origin: string;
  supplier_id: string;
  payment_method: string;
  payment_terms_detail?: string;
  lots: LotPayload[];
}

/**
 * 계약 + Lot 일괄 생성. 성공 시 계약 ID 반환.
 * 파일 업로드는 클라이언트에서 별도 처리.
 */
export async function createContractWithLots(
  data: ContractCreatePayload
): Promise<{ id: string; contract_code: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요합니다");

  const { data: contract, error: contractError } = await supabase
    .from("contracts")
    .insert({
      crop_year:            data.crop_year,
      origin:               data.origin || null,
      supplier_id:          data.supplier_id,
      buyer_id:             user.id,
      status:               "소싱후보" as const,
      payment_method:       data.payment_method || null,
      payment_terms_detail: data.payment_terms_detail || null,
    })
    .select("id, contract_code")
    .single();

  if (contractError || !contract) {
    throw new Error(contractError?.message ?? "계약 생성 실패");
  }

  if (data.lots.length > 0) {
    const { error: lotsError } = await supabase
      .from("contract_lots")
      .insert(
        data.lots.map((l) => ({
          contract_id:        contract.id,
          lot_seq:            l.lot_seq,
          lot_description:    l.lot_description || null,
          price_per_lb:       l.price_per_lb,
          unit_type:          l.unit_type,
          quantity:           l.quantity,
          weight_per_unit_kg: l.weight_per_unit_kg,
        }))
      );
    if (lotsError) throw new Error(lotsError.message);
  }

  return { id: contract.id, contract_code: contract.contract_code };
}

/** 계약서 파일 경로 업데이트 (클라이언트 측 Storage 업로드 후 호출) */
export async function updateContractFilePath(contractId: string, filePath: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("contracts")
    .update({ contract_file_path: filePath })
    .eq("id", contractId);
  if (error) throw new Error(error.message);
}

/** Supplier 신규 생성 (폼 내 인라인 추가용) */
export async function createSupplier(formData: {
  name: string;
  country: string;
  country_code: string;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
}): Promise<{ id: string; name: string }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("suppliers")
    .insert({
      name:         formData.name,
      country:      formData.country || null,
      country_code: formData.country_code?.toUpperCase() || null,
      contact_name: formData.contact_name || null,
      contact_phone: formData.contact_phone || null,
      contact_email: formData.contact_email || null,
    })
    .select("id, name")
    .single();
  if (error || !data) throw new Error(error?.message ?? "공급자 생성 실패");
  return data;
}
