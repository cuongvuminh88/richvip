-- RichVip — schema trên Supabase (docs/04-quy-tac-du-lieu.html §6–§9).
-- Cách dùng: Supabase → SQL Editor → dán toàn bộ file này → Run.
-- Chạy lại nhiều lần vẫn an toàn: không xoá dữ liệu người chơi, chỉ cập nhật ràng buộc, hàm và quyền.
--
-- Nguyên tắc bảo mật:
--   * Bảng public.rv_tien_do bật Row Level Security, trình duyệt chỉ được ĐỌC dòng của mình.
--   * Mọi thay đổi đi qua các hàm rv_* (SECURITY DEFINER). Người dùng được xác định bằng auth.uid(),
--     hàm không nhận user_id từ trình duyệt. Kết quả tung xu do random() của Postgres quyết định.

begin;

-- ---------------------------------------------------------------------------
-- 1. Bảng tiến độ: mỗi tài khoản một dòng
-- ---------------------------------------------------------------------------
create table if not exists public.rv_tien_do (
  user_id      uuid        primary key references auth.users (id) on delete cascade,
  trang_thai   text        not null default 'dang-choi',
  so_du        bigint      not null default 1000000,
  so_lan_vay   smallint    not null default 0,
  no_van_nay   bigint      not null default 0,
  no_cu        bigint      not null default 0,
  so_van_thua  integer     not null default 0,
  lua_chon     text,
  mat_xu_cuoi  text,
  so_luot      integer     not null default 0,
  so_thang     integer     not null default 0,
  so_thua      integer     not null default 0,
  lich_su      jsonb       not null default '[]'::jsonb,
  tao_luc      timestamptz not null default now(),
  cap_nhat_luc timestamptz not null default now()
);

comment on table public.rv_tien_do is 'RichVip: tiến độ và nợ (ảo) của mỗi người chơi. Chỉ sửa qua các hàm rv_*.';

-- Ràng buộc hợp lệ (docs/04 §7). Các con số khớp rv_cau_hinh() bên dưới:
-- mức cược 500.000; nợ sau 0/1/2/3 lần vay = 0 / 3tr / 8tr / 18tr; nợ mỗi ván thua = 18tr.
alter table public.rv_tien_do drop constraint if exists rv_trang_thai_hop_le;
alter table public.rv_tien_do add  constraint rv_trang_thai_hop_le
  check (trang_thai in ('dang-choi', 'cho-vay', 'ket-thuc'));

alter table public.rv_tien_do drop constraint if exists rv_mat_hop_le;
alter table public.rv_tien_do add  constraint rv_mat_hop_le
  check ((lua_chon is null or lua_chon in ('sap', 'ngua'))
     and (mat_xu_cuoi is null or mat_xu_cuoi in ('sap', 'ngua')));

alter table public.rv_tien_do drop constraint if exists rv_tien_hop_le;
alter table public.rv_tien_do add  constraint rv_tien_hop_le
  check (so_du >= 0 and no_van_nay >= 0 and no_cu >= 0
     and so_du % 500000 = 0 and no_van_nay % 500000 = 0 and no_cu % 500000 = 0);

alter table public.rv_tien_do drop constraint if exists rv_so_lan_vay_hop_le;
alter table public.rv_tien_do add  constraint rv_so_lan_vay_hop_le
  check (so_lan_vay between 0 and 3);

alter table public.rv_tien_do drop constraint if exists rv_no_van_nay_hop_le;
alter table public.rv_tien_do add  constraint rv_no_van_nay_hop_le
  check (no_van_nay = case when trang_thai = 'ket-thuc' then 0
                           else (array[0, 3000000, 8000000, 18000000]::bigint[])[so_lan_vay + 1] end);

alter table public.rv_tien_do drop constraint if exists rv_no_cu_hop_le;
alter table public.rv_tien_do add  constraint rv_no_cu_hop_le
  check (so_van_thua >= 0 and no_cu = so_van_thua::bigint * 18000000);

alter table public.rv_tien_do drop constraint if exists rv_trang_thai_khop_tien;
alter table public.rv_tien_do add  constraint rv_trang_thai_khop_tien
  check ((trang_thai <> 'dang-choi' or so_du > 0)
     and (trang_thai <> 'cho-vay'   or (so_du = 0 and so_lan_vay < 3))
     and (trang_thai <> 'ket-thuc'  or (so_du = 0 and so_lan_vay = 3)));

alter table public.rv_tien_do drop constraint if exists rv_thong_ke_hop_le;
alter table public.rv_tien_do add  constraint rv_thong_ke_hop_le
  check (so_luot >= 0 and so_thang >= 0 and so_thua >= 0 and so_thang + so_thua = so_luot);

alter table public.rv_tien_do drop constraint if exists rv_lich_su_hop_le;
alter table public.rv_tien_do add  constraint rv_lich_su_hop_le
  check (jsonb_typeof(lich_su) = 'array' and jsonb_array_length(lich_su) <= 10);

-- ---------------------------------------------------------------------------
-- 2. Row Level Security: chỉ đọc được dòng của mình, không ghi thẳng được
-- ---------------------------------------------------------------------------
alter table public.rv_tien_do enable row level security;

drop policy if exists rv_doc_cua_minh on public.rv_tien_do;
create policy rv_doc_cua_minh on public.rv_tien_do
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- Supabase mặc định cấp mọi quyền trên bảng cho anon/authenticated; thu hồi, chỉ để lại SELECT.
revoke all on table public.rv_tien_do from public, anon, authenticated;
grant select on table public.rv_tien_do to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Hằng số cấu hình (docs/04 §1) — bản chuẩn; app/game.js có bản sao cho chế độ cục bộ
-- ---------------------------------------------------------------------------
create or replace function public.rv_cau_hinh()
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'SO_DU_DAU',         1000000,
    'MUC_CUOC',          500000,
    'CAC_MUC_VAY',       jsonb_build_array(3000000, 5000000, 10000000),
    'SO_LAN_VAY_TOI_DA', 3,
    'SO_DONG_LICH_SU',   10,
    'TI_LE_THEO_LUOT',   jsonb_build_array(0.8, 0.6, 0.4, 0.2, 0),
    'TI_LE_THEO_VAY',    jsonb_build_array(1, 0.3, 0.15, 0)
  );
$$;

-- ---------------------------------------------------------------------------
-- 4. Hàm nội bộ (schema riêng, trình duyệt không gọi được)
-- ---------------------------------------------------------------------------
create schema if not exists rv_noi_bo;
revoke all on schema rv_noi_bo from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on schema rv_noi_bo from anon, authenticated';
  end if;
end $$;

-- Dòng trong bảng → JSON đúng dạng state mà app/game.js dùng (docs/04 §6).
create or replace function rv_noi_bo.thanh_json(r public.rv_tien_do)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'version',    1,
    'trangThai',  r.trang_thai,
    'soDu',       r.so_du,
    'soLanVay',   r.so_lan_vay,
    'noVanNay',   r.no_van_nay,
    'noCu',       r.no_cu,
    'soVanThua',  r.so_van_thua,
    'luaChon',    r.lua_chon,
    'matXuCuoi',  r.mat_xu_cuoi,
    'thongKe',    jsonb_build_object('soLuot', r.so_luot, 'soThang', r.so_thang, 'soThua', r.so_thua),
    'lichSu',     r.lich_su
  );
$$;

-- Thêm một dòng lên đầu lịch sử, giữ tối đa SO_DONG_LICH_SU dòng.
create or replace function rv_noi_bo.them_lich_su(ls jsonb, dong jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(jsonb_agg(x.e order by x.i), '[]'::jsonb)
  from jsonb_array_elements(jsonb_build_array(dong) || ls) with ordinality as x(e, i)
  where x.i <= (public.rv_cau_hinh() ->> 'SO_DONG_LICH_SU')::int;
$$;

-- Ghi toàn bộ dòng r xuống bảng.
create or replace function rv_noi_bo.ghi(r public.rv_tien_do)
returns void
language sql
set search_path = ''
as $$
  update public.rv_tien_do t set
    trang_thai = r.trang_thai, so_du = r.so_du, so_lan_vay = r.so_lan_vay,
    no_van_nay = r.no_van_nay, no_cu = r.no_cu, so_van_thua = r.so_van_thua,
    lua_chon = r.lua_chon, mat_xu_cuoi = r.mat_xu_cuoi,
    so_luot = r.so_luot, so_thang = r.so_thang, so_thua = r.so_thua,
    lich_su = r.lich_su, cap_nhat_luc = now()
  where t.user_id = r.user_id;
$$;

-- Lấy dòng của người đang đăng nhập và khoá lại cho tới hết giao dịch.
create or replace function rv_noi_bo.lay_va_khoa()
returns public.rv_tien_do
language plpgsql
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  r public.rv_tien_do;
begin
  if v_uid is null then
    raise exception 'Chưa đăng nhập' using errcode = '28000';
  end if;
  insert into public.rv_tien_do (user_id) values (v_uid) on conflict (user_id) do nothing;
  select * into r from public.rv_tien_do where user_id = v_uid for update;
  return r;
end;
$$;

revoke all on all functions in schema rv_noi_bo from public;

-- ---------------------------------------------------------------------------
-- 5. Hàm trình duyệt gọi qua supabase.rpc(...) (docs/04 §8)
-- ---------------------------------------------------------------------------

-- Lấy tiến độ; lần đầu thì tạo ván mới.
create or replace function public.rv_lay_tien_do()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.rv_tien_do := rv_noi_bo.lay_va_khoa();
begin
  return rv_noi_bo.thanh_json(r);
end;
$$;

-- Tung xu. Trả về { state, ketQua, dung }.
create or replace function public.rv_tung_xu(p_chon text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  ch      jsonb := public.rv_cau_hinh();
  r       public.rv_tien_do;
  bang    jsonb := ch -> 'TI_LE_THEO_LUOT';
  n       int;
  ti_le   numeric;
  dung    boolean;
  ket_qua text;
  cuoc    bigint := (ch ->> 'MUC_CUOC')::bigint;
begin
  if p_chon is null or p_chon not in ('sap', 'ngua') then
    raise exception 'Lựa chọn không hợp lệ: phải là sap hoặc ngua' using errcode = '22023';
  end if;
  r := rv_noi_bo.lay_va_khoa();
  if r.trang_thai <> 'dang-choi' or r.so_du <= 0 then
    raise exception 'Không tung xu được lúc này (trạng thái %)', r.trang_thai using errcode = 'P0001';
  end if;

  -- Độ khó tăng dần (docs/04 §3): tỉ lệ = min(theo lượt, theo số lần vay)
  n := r.so_luot + 1;
  ti_le := least(
    (bang ->> least((n - 1) / 5, jsonb_array_length(bang) - 1))::numeric,
    (ch -> 'TI_LE_THEO_VAY' ->> r.so_lan_vay)::numeric
  );
  dung := random() < ti_le;
  ket_qua := case when dung then p_chon when p_chon = 'sap' then 'ngua' else 'sap' end;

  r.so_du       := r.so_du + case when dung then cuoc else -cuoc end;
  r.so_luot     := r.so_luot + 1;
  r.so_thang    := r.so_thang + case when dung then 1 else 0 end;
  r.so_thua     := r.so_thua  + case when dung then 0 else 1 end;
  r.lua_chon    := p_chon;
  r.mat_xu_cuoi := ket_qua;
  r.lich_su     := rv_noi_bo.them_lich_su(r.lich_su, jsonb_build_object(
                     'loai', 'tung', 'chon', p_chon, 'ketQua', ket_qua, 'dung', dung, 'soDuSau', r.so_du));

  if r.so_du = 0 then
    if r.so_lan_vay < (ch ->> 'SO_LAN_VAY_TOI_DA')::int then
      r.trang_thai := 'cho-vay';
    else
      -- Kết thúc ván: cộng nợ ván này vào nợ cũ
      r.no_cu       := r.no_cu + r.no_van_nay;
      r.no_van_nay  := 0;
      r.so_van_thua := r.so_van_thua + 1;
      r.trang_thai  := 'ket-thuc';
    end if;
  end if;

  perform rv_noi_bo.ghi(r);
  return jsonb_build_object('state', rv_noi_bo.thanh_json(r), 'ketQua', ket_qua, 'dung', dung);
end;
$$;

-- Vay: chỉ khi đang chờ vay.
create or replace function public.rv_vay()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  ch   jsonb := public.rv_cau_hinh();
  r    public.rv_tien_do := rv_noi_bo.lay_va_khoa();
  tien bigint;
begin
  if r.trang_thai <> 'cho-vay' then
    raise exception 'Chưa được vay lúc này (trạng thái %)', r.trang_thai using errcode = 'P0001';
  end if;
  tien := (ch -> 'CAC_MUC_VAY' ->> r.so_lan_vay)::bigint;
  r.so_du      := r.so_du + tien;
  r.no_van_nay := r.no_van_nay + tien;
  r.so_lan_vay := r.so_lan_vay + 1;
  r.trang_thai := 'dang-choi';
  r.lich_su    := rv_noi_bo.them_lich_su(r.lich_su, jsonb_build_object(
                    'loai', 'vay', 'soTien', tien, 'soDuSau', r.so_du));
  perform rv_noi_bo.ghi(r);
  return rv_noi_bo.thanh_json(r);
end;
$$;

-- Chơi lại: ván mới, giữ nợ cũ và số ván đã thua.
create or replace function public.rv_choi_lai()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.rv_tien_do := rv_noi_bo.lay_va_khoa();
begin
  if r.trang_thai <> 'ket-thuc' then
    raise exception 'Ván chưa kết thúc (trạng thái %)', r.trang_thai using errcode = 'P0001';
  end if;
  r.trang_thai  := 'dang-choi';
  r.so_du       := (public.rv_cau_hinh() ->> 'SO_DU_DAU')::bigint;
  r.so_lan_vay  := 0;
  r.no_van_nay  := 0;
  r.mat_xu_cuoi := null;
  r.so_luot     := 0;
  r.so_thang    := 0;
  r.so_thua     := 0;
  r.lich_su     := '[]'::jsonb;
  perform rv_noi_bo.ghi(r);
  return rv_noi_bo.thanh_json(r);
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Quyền gọi hàm: chỉ người đã đăng nhập
-- ---------------------------------------------------------------------------
revoke all on function public.rv_lay_tien_do()   from public;
revoke all on function public.rv_tung_xu(text)   from public;
revoke all on function public.rv_vay()           from public;
revoke all on function public.rv_choi_lai()      from public;
revoke all on function public.rv_cau_hinh()      from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function public.rv_lay_tien_do(), public.rv_tung_xu(text), public.rv_vay(), public.rv_choi_lai() from anon';
    execute 'grant execute on function public.rv_lay_tien_do(), public.rv_tung_xu(text), public.rv_vay(), public.rv_choi_lai() to authenticated';
    execute 'grant execute on function public.rv_cau_hinh() to anon, authenticated';
  end if;
end $$;

commit;
