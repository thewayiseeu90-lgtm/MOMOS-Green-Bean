-- ============================================================
-- Migration 0002: contract_lots, origin 컬럼, created_at 불변 강제
-- Supabase SQL Editor에서 0001_init.sql 이후 실행
-- ============================================================

-- 1. contracts 테이블: origin 추가, farm_name nullable
alter table public.contracts add column if not exists origin text;
alter table public.contracts alter column farm_name drop not null;

-- 2. created_at 불변 트리거: update 시 항상 기존 값으로 덮어씀
create or replace function public.prevent_created_at_update() returns trigger as $$
begin
  new.created_at = old.created_at;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_contracts_immutable_created_at on public.contracts;
create trigger trg_contracts_immutable_created_at
  before update on public.contracts
  for each row execute function public.prevent_created_at_update();

-- 3. contract_lots 테이블
--    total_weight_kg, total_weight_lbs, total_price_usd는 generated column
create table if not exists public.contract_lots (
  id                   uuid    primary key default gen_random_uuid(),
  contract_id          uuid    references public.contracts(id) on delete cascade not null,
  lot_seq              int     not null default 1,
  lot_description      text,
  price_per_lb         numeric not null default 0,
  unit_type            text    not null default 'bag',  -- 'bag' | 'box'
  quantity             int     not null default 0,
  weight_per_unit_kg   numeric not null default 60,
  total_weight_kg      numeric generated always as (quantity::numeric * weight_per_unit_kg) stored,
  total_weight_lbs     numeric generated always as (quantity::numeric * weight_per_unit_kg * 2.20462) stored,
  total_price_usd      numeric generated always as (quantity::numeric * weight_per_unit_kg * 2.20462 * price_per_lb) stored,
  created_at           timestamptz not null default now(),
  unique (contract_id, lot_seq)
);

-- 4. RLS
alter table public.contract_lots enable row level security;

create policy "lots 전체조회" on public.contract_lots
  for select using (true);

create policy "lots 작성수정_바이어이상" on public.contract_lots
  for all using (public.current_user_role() in ('buyer','logistics','finance','admin'));

-- 5. 물류 담당자는 lot 가격 수정 불가 (계약 필드 권한과 동일한 원칙 적용)
create or replace function public.enforce_lot_field_permissions() returns trigger as $$
begin
  if public.current_user_role() = 'logistics' then
    if new.price_per_lb is distinct from old.price_per_lb then
      raise exception '물류 담당자 권한으로는 Lot 단가를 수정할 수 없습니다';
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_lot_field_permissions before update on public.contract_lots
  for each row execute function public.enforce_lot_field_permissions();

-- 6. 계약 총액 집계 view (contract_lots 기준)
create or replace view public.contract_lot_totals as
select
  contract_id,
  count(*)::int                         as lot_count,
  sum(quantity)                         as total_bags,
  sum(total_weight_kg)                  as total_weight_kg,
  sum(total_weight_lbs)                 as total_weight_lbs,
  round(sum(total_price_usd)::numeric, 2) as total_price_usd
from public.contract_lots
group by contract_id;
