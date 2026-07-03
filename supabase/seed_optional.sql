-- ============================================================
-- 선택 사항: 데모/테스트용 샘플 데이터
-- 실제 운영 데이터를 입력하기 전 화면이 어떻게 보이는지 확인하고 싶을 때만 실행
-- ============================================================

insert into public.suppliers (name, country, country_code, region, contact_name, contact_phone, contact_email)
values
  ('ABC Coffee Export', 'Ethiopia', 'ETH', 'Benchmaji', '아베베', '+251-911-000-000', 'abebe@abccoffee.example'),
  ('La Loma Estate', 'Colombia', 'COL', 'Huila', '카를로스', '+57-300-000-0000', 'carlos@laloma.example'),
  ('El Injerto', 'Guatemala', 'GUA', 'Huehuetenango', '마리오', '+502-5500-0000', 'mario@elinjerto.example');

insert into public.lc_banks (bank_name, currency, total_limit, limit_renewal_date)
values
  ('KEB하나은행', 'USD', 1000000, '2027-01-01'),
  ('신한은행', 'USD', 800000, '2027-01-01');

-- 참고: 계약(contracts) 샘플 데이터는 buyer_id가 실제 로그인 계정(auth.users)을 참조해야 하므로
-- 여기서는 만들지 않습니다. 첫 계정 생성 후 앱의 "신규 계약" 화면에서 직접 입력해 테스트하세요.
