import { ContractStatus } from "@/lib/types";

const COLOR_MAP: Record<string, string> = {
  "소싱후보": "bg-sand text-bark", "샘플요청": "bg-sand text-bark",
  "샘플수령": "bg-sand text-bark", "커핑평가": "bg-sand text-bark",
  "조건협상": "bg-amber-100 text-amber-900",
  "계약서대기": "bg-amber-100 text-amber-900", "계약서검토": "bg-amber-100 text-amber-900",
  "계약수정요청": "bg-clay/20 text-clay",
  "계약확정": "bg-moss/20 text-moss",
  "물류인계": "bg-blue-100 text-blue-900",
  "선적준비": "bg-blue-100 text-blue-900", "결제준비": "bg-blue-100 text-blue-900",
  "선적확정": "bg-blue-100 text-blue-900", "선적완료": "bg-blue-100 text-blue-900",
  "입항예정": "bg-moss/20 text-moss", "통관진행": "bg-moss/20 text-moss",
  "입고완료": "bg-moss/20 text-moss", "계약종결": "bg-moss text-white",
  "보류": "bg-gray-200 text-gray-700", "취소": "bg-gray-300 text-gray-600",
};

export default function StatusBadge({ status }: { status: ContractStatus }) {
  return (
    <span className={`inline-block px-2 py-0.5 text-xs rounded ${COLOR_MAP[status] ?? "bg-sand"}`}>
      {status}
    </span>
  );
}
