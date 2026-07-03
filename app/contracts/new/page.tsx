import { createClient } from "@/lib/supabase/server";
import ContractForm from "./ContractForm";

export default async function NewContractPage() {
  const supabase = createClient();
  const { data: suppliers } = await supabase
    .from("suppliers")
    .select("id, name, country, country_code")
    .order("name");

  return (
    <div className="max-w-4xl">
      <p className="label-eyebrow">신규 계약</p>
      <h1 className="font-display text-3xl mb-6">계약 등록</h1>
      <ContractForm suppliers={suppliers ?? []} />
    </div>
  );
}
