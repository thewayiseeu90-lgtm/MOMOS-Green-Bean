export type UserRole = "buyer" | "logistics" | "finance" | "admin";

export const CONTRACT_STATUSES = [
  "소싱후보","샘플요청","샘플수령","커핑평가","조건협상",
  "계약서대기","계약서검토","계약수정요청","계약확정",
  "물류인계","선적준비","결제준비","선적확정","선적완료",
  "입항예정","통관진행","입고완료","계약종결","보류","취소",
] as const;
export type ContractStatus = typeof CONTRACT_STATUSES[number];

// 칸반에서 보여줄 6단계 상위 그룹 매핑
export const STAGE_GROUP: Record<ContractStatus, string> = {
  "소싱후보": "소싱", "샘플요청": "소싱", "샘플수령": "소싱", "커핑평가": "소싱",
  "조건협상": "협상",
  "계약서대기": "계약검토", "계약서검토": "계약검토", "계약수정요청": "계약검토",
  "계약확정": "계약확정",
  "물류인계": "물류인계",
  "선적준비": "선적과결제", "결제준비": "선적과결제", "선적확정": "선적과결제", "선적완료": "선적과결제",
  "입항예정": "입항과종결", "통관진행": "입항과종결", "입고완료": "입항과종결", "계약종결": "입항과종결",
  "보류": "보류/취소", "취소": "보류/취소",
};
export const STAGE_GROUPS = ["소싱","협상","계약검토","계약확정","물류인계","선적과결제","입항과종결","보류/취소"];

export type PaymentMethod = "T/T" | "L/C at Sight" | "Usance L/C" | "CAD" | "DP" | "기타";

export interface Profile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface Supplier {
  id: string;
  name: string;
  country: string | null;
  country_code: string | null;
  region: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_whatsapp: string | null;
  contact_email: string | null;
}

export interface Contract {
  id: string;
  contract_code: string;
  crop_year: number;
  contract_name: string | null;
  supplier_id: string;
  farm_name: string;
  washing_station: string | null;
  harvest_period: string | null;
  buyer_id: string;
  status: ContractStatus;
  priority: "높음" | "중간" | "낮음" | null;
  next_action: string | null;
  next_action_owner_id: string | null;
  next_action_due: string | null;

  variety: string | null;
  process: string | null;
  grade: string | null;
  lot: string | null;
  cup_score: number | null;
  purchase_decision: string | null;

  contract_quantity: number | null;
  quantity_unit: string | null;
  currency: string | null;
  unit_price: number | null;
  incoterm: string | null;
  contract_total_amount: number | null;
  contract_date: string | null;
  contract_file_path: string | null;

  origin: string | null;
  payment_method: PaymentMethod | null;
  payment_terms_detail: string | null;
  payment_due_date: string | null;

  created_at: string;
  updated_at: string;

  // join 결과로 채워지는 필드 (선택적)
  suppliers?: Supplier;
}

export type DocType =
  | "Commercial Invoice" | "Packing List" | "Bill of Lading" | "Certificate of Origin"
  | "Phytosanitary Certificate" | "Fumigation Certificate" | "Weight Certificate"
  | "ICO Certificate" | "Insurance Certificate" | "품질서류" | "기타";

export interface DocumentRow {
  id: string;
  shipment_id: string;
  doc_type: DocType;
  required: boolean;
  draft_received: boolean;
  original_received: boolean;
  final_approved: boolean;
  owner_id: string | null;
  received_date: string | null;
  file_path: string | null;
  issue_note: string | null;
}

// ──────────────────────────────────────────
// Lot
// ──────────────────────────────────────────

export interface ContractLot {
  id: string;
  contract_id: string;
  lot_seq: number;
  lot_description: string | null;
  price_per_lb: number;
  unit_type: "bag" | "box";
  quantity: number;
  weight_per_unit_kg: number;
  total_weight_kg: number;
  total_weight_lbs: number;
  total_price_usd: number;
}

/** 클라이언트 폼에서만 사용하는 임시 상태 타입 */
export interface LotDraft {
  id: string;
  lot_description: string;
  price_per_lb: string;
  unit_type: "bag" | "box";
  quantity: string;
  weight_per_unit_kg: string;
}

export function computeLotTotals(lot: LotDraft) {
  const qty    = parseFloat(lot.quantity)            || 0;
  const weight = parseFloat(lot.weight_per_unit_kg) || 0;
  const price  = parseFloat(lot.price_per_lb)       || 0;
  const total_weight_kg  = qty * weight;
  const total_weight_lbs = total_weight_kg * 2.20462;
  const total_price_usd  = total_weight_lbs * price;
  return { total_weight_kg, total_weight_lbs, total_price_usd };
}

// ──────────────────────────────────────────
// Coffee origins 표준 목록
// ──────────────────────────────────────────
export const COFFEE_ORIGINS = [
  "Ethiopia", "Colombia", "Brazil", "Guatemala", "Honduras",
  "Costa Rica", "El Salvador", "Nicaragua", "Mexico", "Panama",
  "Kenya", "Tanzania", "Rwanda", "Burundi", "DR Congo",
  "Uganda", "Zambia", "Indonesia", "Papua New Guinea", "Vietnam",
  "Myanmar", "India", "Yemen", "Bolivia", "Peru", "Ecuador",
  "Timor-Leste",
] as const;

export const PAYMENT_METHOD_OPTIONS = [
  "T/T", "L/C at Sight", "Usance L/C", "CAD", "DP", "기타",
] as const;
