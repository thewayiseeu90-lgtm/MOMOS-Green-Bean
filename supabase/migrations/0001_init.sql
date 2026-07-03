-- ============================================================
-- 모모스 생두 계약 대시보드 — 초기 스키마
-- 적용 방법: Supabase 프로젝트 SQL Editor에 이 파일 내용을 붙여넣고 실행
-- 또는: supabase db push (Supabase CLI 사용 시)
-- ============================================================

-- ---------- 0. 확장 ----------
create extension if not exists "pgcrypto";

-- ---------- 1. 사용자 프로필 / 역할 ----------
-- Supabase Auth의 auth.users와 1:1로 연결되는 프로필 테이블.
-- 역할(role)이 모든 권한 제어의 기준이 된다.
create type public.user_role as enum ('buyer', 'logistics', 'finance', 'admin');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  role public.user_role not null default 'buyer',
  created_at timestamptz not null default now()
);

-- 로그인한 사용자의 역할을 조회하는 헬퍼 함수 (RLS와 트리거에서 공용으로 사용)
create or replace function public.current_user_role() returns public.user_role as $$
  select role from public.profiles where id = auth.uid();
$$ language sql stable security definer;

-- 신규 가입 시 profiles 행을 자동 생성 (역할은 기본 buyer, admin이 추후 변경)
create or replace function public.handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id, name, email, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', new.email), new.email, 'buyer');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- 2. 공급자 마스터 ----------
create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country text,
  country_code text, -- 예: ETH, COL, GUA (Contract ID 생성에 사용)
  region text,
  contact_name text,
  contact_phone text,
  contact_whatsapp text,
  contact_email text,
  bank_name text,
  swift text,
  notes text,
  created_at timestamptz not null default now()
);

-- ---------- 3. 계약 상태 enum (20단계) ----------
create type public.contract_status as enum (
  '소싱후보','샘플요청','샘플수령','커핑평가','조건협상',
  '계약서대기','계약서검토','계약수정요청','계약확정',
  '물류인계','선적준비','결제준비','선적확정','선적완료',
  '입항예정','통관진행','입고완료','계약종결','보류','취소'
);

create type public.purchase_decision as enum (
  '품질승인','조건부승인','재샘플요청','구매보류','구매거절'
);

create type public.payment_method as enum (
  'T/T','L/C at Sight','Usance L/C','CAD','DP','기타'
);

create type public.priority_level as enum ('높음','중간','낮음');

-- ---------- 4. 계약 (핵심 테이블) ----------
create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  contract_code text unique, -- 예: 2026-ETH-BENCHMAJI-001, insert 트리거가 자동 생성

  -- 기본정보
  crop_year int not null,
  contract_name text,
  supplier_id uuid references public.suppliers(id) not null,
  farm_name text not null,
  washing_station text,
  harvest_period text,
  buyer_id uuid references public.profiles(id) not null,
  status public.contract_status not null default '소싱후보',
  priority public.priority_level default '중간',
  next_action text,
  next_action_owner_id uuid references public.profiles(id),
  next_action_due date,

  -- 품질
  variety text,
  process text,
  grade text,
  lot text,
  cup_score numeric,
  internal_cupping_date date,
  cupping_result text,
  purchase_decision public.purchase_decision,
  quality_owner_id uuid references public.profiles(id),
  preshipment_sample_needed boolean default false,
  arrival_sample_needed boolean default false,

  -- 상업조건
  contract_quantity numeric,
  quantity_unit text default 'kg',
  bag_count int,
  bag_weight numeric,
  currency text default 'USD',
  unit_price numeric,
  price_basis text,
  incoterm text,
  contract_total_amount numeric generated always as (contract_quantity * unit_price) stored,
  est_extra_cost numeric default 0,
  est_landed_cost numeric generated always as (contract_quantity * unit_price + coalesce(est_extra_cost,0)) stored,
  fx_basis text,
  price_valid_until date,
  contract_date date,
  contract_number text,
  contract_file_path text, -- Supabase Storage 경로
  signed_status text,

  -- 결제조건
  payment_method public.payment_method,
  payment_terms_detail text,
  advance_ratio numeric,
  balance_ratio numeric,
  deposit_due_date date,
  balance_terms text,
  payment_due_date date,
  payment_completed_date date,
  beneficiary_bank text,
  beneficiary_name text,
  swift text,
  intermediary_bank text,
  finance_owner_id uuid references public.profiles(id),
  payment_approval_status text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on public.contracts (status);
create index on public.contracts (buyer_id);
create index on public.contracts (supplier_id);

-- updated_at 자동 갱신
create or replace function public.touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_contracts_touch before update on public.contracts
  for each row execute function public.touch_updated_at();

-- ---------- 5. 계약 ID 자동 생성 ----------
create or replace function public.generate_contract_code() returns trigger as $$
declare
  v_country_code text;
  v_seq int;
begin
  if new.contract_code is not null then
    return new;
  end if;

  select country_code into v_country_code from public.suppliers where id = new.supplier_id;
  v_country_code := coalesce(upper(v_country_code), 'XXX');

  select count(*) + 1 into v_seq
  from public.contracts
  where crop_year = new.crop_year and supplier_id = new.supplier_id;

  new.contract_code := new.crop_year::text || '-' || v_country_code || '-' ||
    upper(regexp_replace(coalesce(new.farm_name,'FARM'), '\s+', '', 'g')) || '-' ||
    lpad(v_seq::text, 3, '0');

  return new;
end;
$$ language plpgsql;

create trigger trg_generate_contract_code before insert on public.contracts
  for each row execute function public.generate_contract_code();

-- ---------- 6. 선적 ----------
create type public.shipment_status as enum (
  '선적준비','Booking완료','선적확정','선적완료','입항완료'
);

create table public.shipments (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid references public.contracts(id) on delete cascade not null,
  shipment_seq int not null default 1,
  quantity numeric,
  origin_port text,
  dest_port text,
  forwarder text,
  shipping_line text,
  booking_status text,
  stuffing_date date,
  etd date,
  eta date,
  actual_etd date,
  actual_eta date,
  container_no text,
  bl_no text,
  vessel text,
  voyage text,
  logistics_owner_id uuid references public.profiles(id),
  status public.shipment_status default '선적준비',
  created_at timestamptz not null default now(),
  unique (contract_id, shipment_seq)
);

create view public.shipment_codes as
select s.*, c.contract_code || '-S' || lpad(s.shipment_seq::text, 2, '0') as shipment_code
from public.shipments s join public.contracts c on c.id = s.contract_id;

-- ---------- 7. 수입서류 ----------
create type public.doc_type as enum (
  'Commercial Invoice','Packing List','Bill of Lading','Certificate of Origin',
  'Phytosanitary Certificate','Fumigation Certificate','Weight Certificate',
  'ICO Certificate','Insurance Certificate','품질서류','기타'
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid references public.shipments(id) on delete cascade not null,
  doc_type public.doc_type not null,
  required boolean default true,
  draft_received boolean default false,
  draft_reviewed boolean default false,
  revision_requested boolean default false,
  original_received boolean default false,
  final_approved boolean default false,
  owner_id uuid references public.profiles(id),
  received_date date,
  file_path text,
  issue_note text,
  revision_due date,
  created_at timestamptz not null default now()
);

-- ---------- 8. 결제 실행 ----------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid references public.contracts(id) on delete cascade not null,
  payment_seq int not null default 1,
  payment_method public.payment_method,
  planned_amount numeric,
  due_date date,
  actual_amount numeric,
  approved_date date,
  remitted_date date,
  proof_file_path text,
  finance_owner_id uuid references public.profiles(id),
  status text default '승인대기',
  created_at timestamptz not null default now()
);

-- ---------- 9. 신용장 은행 한도 / 원장 ----------
create table public.lc_banks (
  id uuid primary key default gen_random_uuid(),
  bank_name text not null,
  currency text default 'USD',
  total_limit numeric not null default 0,
  limit_renewal_date date,
  finance_owner_id uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create type public.lc_status as enum (
  '개설요청','승인대기','개설완료','상환대기','상환완료','취소'
);

create table public.lc_ledger (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid references public.contracts(id),
  shipment_id uuid references public.shipments(id),
  bank_id uuid references public.lc_banks(id) not null,
  lc_amount numeric not null,
  currency text default 'USD',
  request_date date,
  planned_open_date date,
  actual_open_date date,
  expiry_date date,
  latest_shipment_date date,
  beneficiary text,
  tenor text,
  planned_repay_date date,
  actual_repay_date date,
  status public.lc_status default '개설요청',
  limit_release_date date,
  amendment boolean default false,
  amendment_amount numeric,
  created_at timestamptz not null default now()
);

-- 은행별 실시간 가용한도 뷰 (Airtable에서는 Scripting 없이 불가능했던 부분 — Postgres에서는 그냥 SQL로 풀린다)
create view public.lc_bank_limits as
select
  b.*,
  coalesce((select sum(lc_amount) from public.lc_ledger
            where bank_id = b.id and status in ('개설완료','상환대기')), 0) as current_used,
  coalesce((select sum(lc_amount) from public.lc_ledger
            where bank_id = b.id and status in ('개설요청','승인대기')), 0) as planned_open,
  b.total_limit
    - coalesce((select sum(lc_amount) from public.lc_ledger
                where bank_id = b.id and status in ('개설완료','상환대기')), 0)
    - coalesce((select sum(lc_amount) from public.lc_ledger
                where bank_id = b.id and status in ('개설요청','승인대기')), 0) as available_limit
from public.lc_banks b;

-- 미래 특정 날짜 기준 예상 가용한도 시뮬레이션 함수
-- 예: select * from simulate_available_limit('<bank_id>', '2026-07-15');
create or replace function public.simulate_available_limit(p_bank_id uuid, p_date date)
returns numeric as $$
  select b.total_limit
    - coalesce((
        select sum(lc_amount) from public.lc_ledger
        where bank_id = p_bank_id
          and status not in ('취소')
          and actual_open_date is not null and actual_open_date <= p_date
          and (actual_repay_date is null or actual_repay_date > p_date)
      ), 0)
    - coalesce((
        select sum(lc_amount) from public.lc_ledger
        where bank_id = p_bank_id
          and status in ('개설요청','승인대기')
          and planned_open_date <= p_date
      ), 0)
  from public.lc_banks b where b.id = p_bank_id;
$$ language sql stable;

-- ---------- 10. 위험 관리 ----------
create table public.risks (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid references public.contracts(id) on delete cascade,
  risk_type text,
  risk_level text default '중간',
  content text,
  action_plan text,
  owner_id uuid references public.profiles(id),
  due_date date,
  status text default '진행중',
  created_at timestamptz not null default now()
);

-- ---------- 11. 커뮤니케이션 결정 기록 ----------
create table public.decision_log (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid references public.contracts(id) on delete cascade,
  decision_date date default current_date,
  decision_type text,
  content text,
  decided_with text,
  channel text,
  capture_file_path text,
  recorded_by uuid references public.profiles(id),
  follow_up text,
  follow_up_owner_id uuid references public.profiles(id),
  due_date date,
  email_confirmed boolean default false,
  created_at timestamptz not null default now()
);

-- ---------- 12. 알림 ----------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid references public.profiles(id) not null,
  contract_id uuid references public.contracts(id),
  title text not null,
  body text,
  link text,
  read boolean default false,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 13. 계약확정 자동화 (원문서 15장)
-- 상태가 '계약확정'으로 바뀌는 순간: 필수값 체크 → 선적 초안 생성
-- → 서류 체크리스트 9종 생성 → 물류 담당자 전원에게 알림 → 다음행동 갱신
-- ============================================================
create or replace function public.on_contract_confirmed() returns trigger as $$
declare
  v_shipment_id uuid;
begin
  if new.status = '계약확정' and (old.status is distinct from new.status) then

    if new.contract_file_path is null
       or new.contract_total_amount is null
       or new.contract_quantity is null
       or new.payment_method is null
       or (select contact_name from public.suppliers where id = new.supplier_id) is null then
      raise exception '필수 정보(계약서, 계약금액, 계약수량, 결제조건, 공급자 연락처)가 모두 입력되어야 계약을 확정할 수 있습니다';
    end if;

    insert into public.shipments (contract_id, shipment_seq, quantity, status)
    values (new.id, 1, new.contract_quantity, '선적준비')
    returning id into v_shipment_id;

    insert into public.documents (shipment_id, doc_type, required)
    select v_shipment_id, doc_type, true
    from unnest(array[
      'Commercial Invoice','Packing List','Bill of Lading','Certificate of Origin',
      'Phytosanitary Certificate','Fumigation Certificate','Weight Certificate',
      'ICO Certificate','Insurance Certificate'
    ]::public.doc_type[]) as doc_type;

    insert into public.notifications (recipient_id, contract_id, title, body, link)
    select p.id, new.id,
           '신규 생두 계약 인계: ' || new.contract_code,
           '공급자 ' || (select name from public.suppliers where id = new.supplier_id) ||
           '와의 계약(' || new.contract_total_amount || ' ' || new.currency ||
           ')이 확정되었습니다. 선적 가능일과 필수서류를 확인해주세요.',
           '/contracts/' || new.id
    from public.profiles p where p.role = 'logistics';

    new.next_action := '공급자와 선적 가능일 및 필수서류 확인';
    new.next_action_due := current_date + interval '3 days';
    new.status := '물류인계';
  end if;

  return new;
end;
$$ language plpgsql security definer;

create trigger trg_contract_confirmed before update on public.contracts
  for each row execute function public.on_contract_confirmed();

-- ============================================================
-- 14. 역할별 필드 권한 강제 (Airtable로는 못 했던 부분)
-- 물류 담당자(logistics)는 가격/수량/통화/결제방식을 수정할 수 없다.
-- 관리팀(finance)은 품질 정보를 수정할 수 없다.
-- ============================================================
create or replace function public.enforce_contract_field_permissions() returns trigger as $$
begin
  if public.current_user_role() = 'logistics' then
    if new.unit_price is distinct from old.unit_price
       or new.contract_quantity is distinct from old.contract_quantity
       or new.currency is distinct from old.currency
       or new.payment_method is distinct from old.payment_method then
      raise exception '물류 담당자 권한으로는 가격, 수량, 통화, 결제방식을 수정할 수 없습니다';
    end if;
  end if;

  if public.current_user_role() = 'finance' then
    if new.variety is distinct from old.variety
       or new.process is distinct from old.process
       or new.cup_score is distinct from old.cup_score
       or new.purchase_decision is distinct from old.purchase_decision then
      raise exception '관리팀 권한으로는 품질 정보를 수정할 수 없습니다';
    end if;
  end if;

  return new;
end;
$$ language plpgsql security definer;

create trigger trg_contract_field_permissions before update on public.contracts
  for each row execute function public.enforce_contract_field_permissions();

-- ============================================================
-- 15. Row Level Security
-- 기본 원칙: 로그인한 모든 내부 직원은 전체 계약을 읽을 수 있다(부서간 가시성 확보가 원래 목적).
-- 쓰기 권한만 역할별로 분리한다. 더 세밀한 컬럼 단위 통제는 14번 트리거가 담당한다.
-- ============================================================
alter table public.profiles enable row level security;
alter table public.suppliers enable row level security;
alter table public.contracts enable row level security;
alter table public.shipments enable row level security;
alter table public.documents enable row level security;
alter table public.payments enable row level security;
alter table public.lc_banks enable row level security;
alter table public.lc_ledger enable row level security;
alter table public.risks enable row level security;
alter table public.decision_log enable row level security;
alter table public.notifications enable row level security;

create policy "본인 프로필 조회" on public.profiles for select using (true);
create policy "본인 프로필 수정" on public.profiles for update using (id = auth.uid());

create policy "공급자 전체조회" on public.suppliers for select using (true);
create policy "공급자 작성" on public.suppliers for insert with check (public.current_user_role() in ('buyer','admin'));
create policy "공급자 수정" on public.suppliers for update using (public.current_user_role() in ('buyer','admin'));

create policy "계약 전체조회" on public.contracts for select using (true);
create policy "계약 생성_바이어" on public.contracts for insert with check (public.current_user_role() in ('buyer','admin'));
create policy "계약 수정_관계자" on public.contracts for update using (public.current_user_role() in ('buyer','logistics','finance','admin'));

create policy "선적 전체조회" on public.shipments for select using (true);
create policy "선적 작성수정_물류이상" on public.shipments for all using (public.current_user_role() in ('logistics','buyer','admin'));

create policy "서류 전체조회" on public.documents for select using (true);
create policy "서류 작성수정_물류이상" on public.documents for all using (public.current_user_role() in ('logistics','buyer','admin'));

create policy "결제 전체조회" on public.payments for select using (true);
create policy "결제 작성수정_관리팀이상" on public.payments for all using (public.current_user_role() in ('finance','admin'));

create policy "신용장은행 전체조회" on public.lc_banks for select using (true);
create policy "신용장은행 작성수정_관리팀이상" on public.lc_banks for all using (public.current_user_role() in ('finance','admin'));

create policy "신용장원장 전체조회" on public.lc_ledger for select using (true);
create policy "신용장원장 작성수정_관리팀이상" on public.lc_ledger for all using (public.current_user_role() in ('finance','admin'));

create policy "위험 전체조회" on public.risks for select using (true);
create policy "위험 작성수정_전체직원" on public.risks for all using (public.current_user_role() in ('buyer','logistics','finance','admin'));

create policy "결정기록 전체조회" on public.decision_log for select using (true);
create policy "결정기록 작성수정_전체직원" on public.decision_log for all using (public.current_user_role() in ('buyer','logistics','finance','admin'));

create policy "알림 본인조회" on public.notifications for select using (recipient_id = auth.uid());
create policy "알림 본인수정" on public.notifications for update using (recipient_id = auth.uid());
create policy "알림 시스템생성" on public.notifications for insert with check (true);

-- ---------- 16. Storage 버킷 (계약서, 서류, 증빙 파일) ----------
insert into storage.buckets (id, name, public) values ('contract-files', 'contract-files', false)
  on conflict (id) do nothing;

create policy "로그인 사용자 파일 업로드" on storage.objects
  for insert with check (bucket_id = 'contract-files' and auth.role() = 'authenticated');
create policy "로그인 사용자 파일 조회" on storage.objects
  for select using (bucket_id = 'contract-files' and auth.role() = 'authenticated');
