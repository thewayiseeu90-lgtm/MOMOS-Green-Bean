"use server";

import { createClient } from "@/lib/supabase/server";
import { LotPayload } from "@/app/contracts/new/actions";

export async function updateContractWithLots(
  contractId: string,
  data: {
    crop_year: number;
    origin: string;
    supplier_id: string;
    payment_method: string;
    payment_terms_detail?: string;
    lots: LotPayload[];
  }
) {
  const supabase = createClient();

  const { error: contractError } = await supabase
    .from("contracts")
    .update({
      crop_year:            data.crop_year,
      origin:               data.origin || null,
      supplier_id:          data.supplier_id,
      payment_method:       data.payment_method || null,
      payment_terms_detail: data.payment_terms_detail || null,
      // created_at는 DB 트리거가 불변 보호
    })
    .eq("id", contractId);

  if (contractError) throw new Error(contractError.message);

  // Lots: 기존 전체 삭제 후 재삽입 (full replacement)
  const { error: deleteError } = await supabase
    .from("contract_lots")
    .delete()
    .eq("contract_id", contractId);
  if (deleteError) throw new Error(deleteError.message);

  if (data.lots.length > 0) {
    const { error: lotsError } = await supabase
      .from("contract_lots")
      .insert(
        data.lots.map((l) => ({
          contract_id:        contractId,
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
}
