-- RichVip — kiểm thử schema.sql trên Postgres thường (chạy bằng scripts/test-sql.sh).
-- Cần nạp trước: gia-lap-auth.sql rồi schema.sql. Biến psql :cau_hinh_js = JSON hằng số lấy từ app/game.js.
-- Mã ca test dẫn chiếu docs/05-ke-hoach-test.html.

\set ON_ERROR_STOP on
\o /dev/null
set client_min_messages = notice;

-- ---------------------------------------------------------------------------
-- Công cụ test
-- ---------------------------------------------------------------------------
create schema rv_test;
grant usage on schema rv_test to anon, authenticated;

create function rv_test.kiem(dk boolean, ten text) returns void
language plpgsql as $$
begin
  if dk is distinct from true then
    raise exception 'TRƯỢT: %', ten;
  end if;
  perform set_config('rv_test.so_dat', (coalesce(nullif(current_setting('rv_test.so_dat', true), ''), '0')::int + 1)::text, false);
  raise notice 'ĐẠT  %', ten;
end $$;

-- Chạy một câu SQL; trả về SQLSTATE nếu lỗi, null nếu chạy được. Lỗi không làm đổi dữ liệu.
create function rv_test.loi_khi(cau text) returns text
language plpgsql as $$
begin
  execute cau;
  return null;
exception when others then
  return sqlstate;
end $$;

create function rv_test.a() returns uuid language sql immutable as $$ select '00000000-0000-0000-0000-00000000000a'::uuid $$;
create function rv_test.b() returns uuid language sql immutable as $$ select '00000000-0000-0000-0000-00000000000b'::uuid $$;

-- Đăng nhập giả: đặt user id cho auth.uid()
create function rv_test.la(u uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', coalesce(u::text, ''), false);
$$;

-- Đặt thẳng trạng thái "đang chơi" mẫu (chạy bằng quyền superuser của script, không qua RLS).
create function rv_test.dat(u uuid, so_luot int, so_lan_vay int, so_du bigint) returns void
language sql as $$
  update public.rv_tien_do set
    trang_thai = 'dang-choi', so_du = dat.so_du, so_lan_vay = dat.so_lan_vay,
    no_van_nay = (array[0, 3000000, 8000000, 18000000]::bigint[])[dat.so_lan_vay + 1],
    so_luot = dat.so_luot, so_thang = dat.so_luot, so_thua = 0
  where user_id = u;
$$;

grant execute on all functions in schema rv_test to anon, authenticated;

insert into auth.users (id) values (rv_test.a()), (rv_test.b());

-- ---------------------------------------------------------------------------
-- Cấu hình & bảo vệ hàm
-- ---------------------------------------------------------------------------
select rv_test.kiem(public.rv_cau_hinh() = :'cau_hinh_js'::jsonb,
  'Hằng số trong app/game.js khớp rv_cau_hinh() trên máy chủ');

select rv_test.kiem(bool_and(p.prosecdef and 'search_path=""' = any(p.proconfig)),
  'Các hàm rv_* là SECURITY DEFINER với search_path rỗng')
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('rv_lay_tien_do', 'rv_tung_xu', 'rv_vay', 'rv_choi_lai');

-- ---------------------------------------------------------------------------
-- TC-33 / TC-01: lần đầu đăng nhập
-- ---------------------------------------------------------------------------
select rv_test.la(rv_test.a());
do $$
declare s jsonb := public.rv_lay_tien_do();
begin
  perform rv_test.kiem(s ->> 'trangThai' = 'dang-choi' and (s ->> 'soDu')::bigint = 1000000
    and (s ->> 'soLanVay')::int = 0 and (s ->> 'noVanNay')::bigint = 0 and (s ->> 'noCu')::bigint = 0
    and s -> 'lichSu' = '[]'::jsonb and s ->> 'matXuCuoi' is null,
    'TC-33: tài khoản mới có ván mới 1.000.000 đ, 0/3 lần vay, nợ 0');
  perform public.rv_lay_tien_do();
  perform rv_test.kiem((select count(*) from public.rv_tien_do where user_id = rv_test.a()) = 1,
    'Gọi rv_lay_tien_do() nhiều lần vẫn chỉ có một dòng');
end $$;

select rv_test.la(rv_test.b());
select public.rv_lay_tien_do();
select rv_test.la(rv_test.a());

-- ---------------------------------------------------------------------------
-- TC-40: gọi sai điều kiện / sai tham số
-- ---------------------------------------------------------------------------
do $$
declare s0 jsonb := public.rv_lay_tien_do();
begin
  perform rv_test.kiem(rv_test.loi_khi('select public.rv_vay()') = 'P0001', 'TC-40: rv_vay() khi đang chơi bị từ chối');
  perform rv_test.kiem(rv_test.loi_khi('select public.rv_choi_lai()') = 'P0001', 'TC-40: rv_choi_lai() khi chưa kết thúc bị từ chối');
  perform rv_test.kiem(rv_test.loi_khi($q$select public.rv_tung_xu('x')$q$) = '22023', 'TC-40: rv_tung_xu(''x'') bị từ chối');
  perform rv_test.kiem(rv_test.loi_khi('select public.rv_tung_xu(null)') = '22023', 'TC-40: rv_tung_xu(null) bị từ chối');
  perform rv_test.kiem(public.rv_lay_tien_do() = s0, 'TC-40: dữ liệu không đổi sau các lệnh sai');
end $$;

-- ---------------------------------------------------------------------------
-- TC-04 / TC-05 / TC-07d: cơ chế một lượt tung (200 lượt ngẫu nhiên ở nhiều mốc)
-- ---------------------------------------------------------------------------
do $$
declare
  i int; chon text; truoc bigint; kq jsonb; s jsonb; ok boolean := true; co_thang boolean := false; co_thua boolean := false;
begin
  for i in 1..200 loop
    perform rv_test.dat(rv_test.a(), i % 20, 0, 5000000);
    chon := case when i % 2 = 0 then 'sap' else 'ngua' end;
    truoc := 5000000;
    kq := public.rv_tung_xu(chon);
    s := kq -> 'state';
    if (kq ->> 'dung')::boolean then
      co_thang := true;
      ok := ok and kq ->> 'ketQua' = chon and (s ->> 'soDu')::bigint = truoc + 500000;
    else
      co_thua := true;
      ok := ok and kq ->> 'ketQua' <> chon and (s ->> 'soDu')::bigint = truoc - 500000;
    end if;
    ok := ok and (s -> 'thongKe' ->> 'soLuot')::int = i % 20 + 1
             and s ->> 'luaChon' = chon and s ->> 'matXuCuoi' = kq ->> 'ketQua'
             and s -> 'lichSu' -> 0 ->> 'loai' = 'tung'
             and s -> 'lichSu' -> 0 ->> 'ketQua' = kq ->> 'ketQua'
             and (s -> 'lichSu' -> 0 ->> 'soDuSau')::bigint = (s ->> 'soDu')::bigint;
  end loop;
  perform rv_test.kiem(ok and co_thang and co_thua,
    'TC-04/05: đúng thì +500.000 đ và ra mặt đã chọn; sai thì −500.000 đ và ra mặt còn lại; lịch sử, lượt cập nhật đúng');
end $$;

-- ---------------------------------------------------------------------------
-- TC-11 … TC-19: một ván từ lượt 21 (luôn thua) đến màn hình nợ, chơi lại, nợ cộng dồn
-- ---------------------------------------------------------------------------
do $$
declare s jsonb; i int;
begin
  perform rv_test.dat(rv_test.a(), 20, 0, 1000000);
  for i in 1..2 loop s := public.rv_tung_xu('sap') -> 'state'; end loop;
  perform rv_test.kiem(s ->> 'trangThai' = 'cho-vay' and (s ->> 'soDu')::bigint = 0, 'TC-11: thua 2 lượt từ 1.000.000 đ → số dư 0, chờ vay');
  perform rv_test.kiem(rv_test.loi_khi($q$select public.rv_tung_xu('sap')$q$) = 'P0001', 'TC-11: không tung được khi chưa vay');

  s := public.rv_vay();
  perform rv_test.kiem((s ->> 'soDu')::bigint = 3000000 and (s ->> 'soLanVay')::int = 1
    and (s ->> 'noVanNay')::bigint = 3000000 and s -> 'lichSu' -> 0 ->> 'loai' = 'vay'
    and (s -> 'lichSu' -> 0 ->> 'soTien')::bigint = 3000000,
    'TC-13: vay lần 1 → 3.000.000 đ, 1/3, nợ ván này 3.000.000 đ, có dòng Vay');
  perform rv_test.kiem(rv_test.loi_khi('select public.rv_vay()') = 'P0001', 'F-05: không vay được khi còn tiền');

  for i in 1..6 loop s := public.rv_tung_xu('ngua') -> 'state'; end loop;
  s := public.rv_vay();
  perform rv_test.kiem((s ->> 'soDu')::bigint = 5000000 and (s ->> 'noVanNay')::bigint = 8000000, 'TC-13b: vay lần 2 → 5.000.000 đ, nợ ván này 8.000.000 đ');
  for i in 1..10 loop s := public.rv_tung_xu('ngua') -> 'state'; end loop;
  s := public.rv_vay();
  perform rv_test.kiem((s ->> 'soDu')::bigint = 10000000 and (s ->> 'noVanNay')::bigint = 18000000 and (s ->> 'soLanVay')::int = 3,
    'TC-13b: vay lần 3 → 10.000.000 đ, nợ ván này 18.000.000 đ');

  for i in 1..20 loop s := public.rv_tung_xu('sap') -> 'state'; end loop;
  perform rv_test.kiem(s ->> 'trangThai' = 'ket-thuc' and (s ->> 'noCu')::bigint = 18000000
    and (s ->> 'noVanNay')::bigint = 0 and (s ->> 'soVanThua')::int = 1,
    'TC-14/15: vay đủ 3 lần rồi hết tiền → kết thúc, X = 18.000.000 đ');
  perform rv_test.kiem(rv_test.loi_khi('select public.rv_vay()') = 'P0001', 'F-05: không vay lần thứ 4');
  perform rv_test.kiem(rv_test.loi_khi($q$select public.rv_tung_xu('sap')$q$) = 'P0001', 'TC-23: ở màn hình nợ không tung được');
  perform rv_test.kiem(public.rv_lay_tien_do() = s, 'TC-23: tải lại tiến độ vẫn là màn hình nợ với cùng X');

  s := public.rv_choi_lai();
  perform rv_test.kiem(s ->> 'trangThai' = 'dang-choi' and (s ->> 'soDu')::bigint = 1000000
    and (s ->> 'soLanVay')::int = 0 and s -> 'lichSu' = '[]'::jsonb
    and (s -> 'thongKe' ->> 'soLuot')::int = 0 and (s ->> 'noCu')::bigint = 18000000,
    'TC-17: chơi lại → 1.000.000 đ, 0/3, lịch sử rỗng, nợ cũ giữ 18.000.000 đ');
end $$;

-- Ván 2 và 3 chơi tự nhiên theo bảng độ khó: vay khi được hỏi, tung tới khi kết thúc
do $$
declare s jsonb; van int; luot int; dai_nhat int := 0;
begin
  for van in 2..3 loop
    s := public.rv_lay_tien_do();
    luot := 0;
    while s ->> 'trangThai' <> 'ket-thuc' loop
      if s ->> 'trangThai' = 'cho-vay' then
        s := public.rv_vay();
      else
        s := public.rv_tung_xu(case when random() < 0.5 then 'sap' else 'ngua' end) -> 'state';
        luot := luot + 1;
      end if;
      if luot > 500 then raise exception 'Ván không kết thúc'; end if;
    end loop;
    dai_nhat := greatest(dai_nhat, luot);
    perform rv_test.kiem((s ->> 'noCu')::bigint = van * 18000000 and (s ->> 'soVanThua')::int = van,
      format('TC-%s: thua ván thứ %s → X = %s đ (ván dài %s lượt)', case van when 2 then '18' else '19' end, van, van * 18000000, luot));
    perform rv_test.kiem(jsonb_array_length(s -> 'lichSu') = 10 and (s -> 'thongKe' ->> 'soLuot')::int = luot,
      format('TC-10: lịch sử giữ 10 dòng, thống kê đúng %s lượt', luot));
    if van < 3 then perform public.rv_choi_lai(); end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- TC-24: ràng buộc CHECK từ chối dữ liệu sai (kể cả khi ghi bằng quyền quản trị)
-- ---------------------------------------------------------------------------
do $$
declare cau text; u text := quote_literal(rv_test.a());
begin
  foreach cau in array array[
    'update public.rv_tien_do set so_du = -500000 where user_id = ' || u,
    'update public.rv_tien_do set so_du = 123 where user_id = ' || u,
    'update public.rv_tien_do set no_cu = 500000 where user_id = ' || u,
    'update public.rv_tien_do set so_lan_vay = 4 where user_id = ' || u,
    $q$update public.rv_tien_do set trang_thai = 'abc' where user_id = $q$ || u,
    $q$update public.rv_tien_do set trang_thai = 'cho-vay', so_du = 1000000, so_lan_vay = 0, no_van_nay = 0 where user_id = $q$ || u,
    $q$update public.rv_tien_do set trang_thai = 'dang-choi', so_du = 0, so_lan_vay = 0, no_van_nay = 0 where user_id = $q$ || u,
    'update public.rv_tien_do set so_thang = so_thang + 1 where user_id = ' || u,
    $q$update public.rv_tien_do set lua_chon = 'canh' where user_id = $q$ || u,
    $q$update public.rv_tien_do set lich_su = (select jsonb_agg(g) from generate_series(1, 11) g) where user_id = $q$ || u
  ] loop
    perform rv_test.kiem(rv_test.loi_khi(cau) = '23514', 'TC-24: từ chối — ' || left(cau, 60) || '…');
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- TC-37 / TC-38: người đã đăng nhập chỉ đọc được dòng của mình, không ghi thẳng được
-- ---------------------------------------------------------------------------
begin;
set local role authenticated;
select rv_test.la(rv_test.a());
select rv_test.kiem((select count(*) from public.rv_tien_do) = 1
  and (select user_id from public.rv_tien_do) = rv_test.a(), 'TC-38: người A chỉ thấy đúng dòng của A');
select rv_test.kiem(rv_test.loi_khi('update public.rv_tien_do set so_du = 99000000') = '42501', 'TC-37: UPDATE thẳng vào bảng bị từ chối');
select rv_test.kiem(rv_test.loi_khi($q$insert into public.rv_tien_do (user_id) values ('00000000-0000-0000-0000-00000000000c')$q$) = '42501', 'TC-37: INSERT thẳng bị từ chối');
select rv_test.kiem(rv_test.loi_khi('delete from public.rv_tien_do') = '42501', 'TC-37: DELETE thẳng bị từ chối');
select rv_test.kiem(rv_test.loi_khi('select rv_noi_bo.thanh_json(null::public.rv_tien_do)') = '42501', 'Hàm nội bộ rv_noi_bo.* không gọi được từ trình duyệt');
select rv_test.kiem((public.rv_lay_tien_do() ->> 'noCu')::bigint = 54000000, 'Người A gọi được rv_lay_tien_do() bằng vai trò authenticated');
select rv_test.la(rv_test.b());
select rv_test.kiem((select count(*) from public.rv_tien_do) = 1
  and (public.rv_lay_tien_do() ->> 'noCu')::bigint = 0, 'TC-36: người B chỉ thấy dòng của B, nợ của B tách biệt với A');
select rv_test.la(null);
select rv_test.kiem(rv_test.loi_khi('select public.rv_lay_tien_do()') = '28000', 'Vai trò authenticated nhưng không có user id → từ chối');
commit;

-- ---------------------------------------------------------------------------
-- TC-39: chưa đăng nhập (anon) không gọi được hàm, không đọc được bảng
-- ---------------------------------------------------------------------------
begin;
set local role anon;
select rv_test.kiem(rv_test.loi_khi($q$select public.rv_tung_xu('sap')$q$) = '42501', 'TC-39: anon gọi rv_tung_xu bị từ chối');
select rv_test.kiem(rv_test.loi_khi('select public.rv_lay_tien_do()') = '42501', 'TC-39: anon gọi rv_lay_tien_do bị từ chối');
select rv_test.kiem(rv_test.loi_khi('select public.rv_vay()') = '42501' and rv_test.loi_khi('select public.rv_choi_lai()') = '42501', 'TC-39: anon gọi rv_vay / rv_choi_lai bị từ chối');
select rv_test.kiem(rv_test.loi_khi('select * from public.rv_tien_do') = '42501', 'TC-39: anon đọc bảng bị từ chối');
commit;

-- ---------------------------------------------------------------------------
-- TC-41 (= TC-07, 07b, 07c, 07d trên máy chủ): mô phỏng tỉ lệ thắng, 10.000 lượt mỗi mốc
-- ---------------------------------------------------------------------------
select rv_test.la(rv_test.a());
do $$
declare
  moc record; i int; thang int; thang_sap int; thang_ngua int; chon text; ti_le numeric;
begin
  for moc in select * from (values
      ('TC-07  lượt 1–5, chưa vay',    0, 0, 0.8),
      ('TC-07  lượt 6–10, chưa vay',   5, 0, 0.6),
      ('TC-07  lượt 11–15, chưa vay', 10, 0, 0.4),
      ('TC-07  lượt 16–20, chưa vay', 15, 0, 0.2),
      ('TC-07b lượt 1–5, đã vay 1',    0, 1, 0.3),
      ('TC-07b lượt 1–5, đã vay 2',    0, 2, 0.15),
      ('TC-07c lượt ≥ 21',            20, 0, 0),
      ('TC-07c sau lần vay thứ 3',     0, 3, 0)
    ) as t(ten, luot, vay, mong_doi)
  loop
    thang := 0; thang_sap := 0; thang_ngua := 0;
    for i in 1..10000 loop
      perform rv_test.dat(rv_test.a(), moc.luot + i % 5 + case when moc.luot = 20 then i % 40 else 0 end, moc.vay, 500000000);
      chon := case when i % 2 = 0 then 'sap' else 'ngua' end;
      if (public.rv_tung_xu(chon) ->> 'dung')::boolean then
        thang := thang + 1;
        if chon = 'sap' then thang_sap := thang_sap + 1; else thang_ngua := thang_ngua + 1; end if;
      end if;
      -- Cập nhật cùng một dòng hàng nghìn lần trong một giao dịch rất chậm: commit định kỳ.
      if i % 250 = 0 then commit; end if;
    end loop;
    ti_le := thang / 10000.0;
    if moc.mong_doi = 0 then
      perform rv_test.kiem(thang = 0, format('%s: 0 / 10.000 lượt thắng', moc.ten));
    else
      perform rv_test.kiem(abs(ti_le - moc.mong_doi) <= 0.02,
        format('%s: tỉ lệ thắng %s%% (mong đợi %s%% ± 2%%)', moc.ten, round(ti_le * 100, 1), moc.mong_doi * 100));
      perform rv_test.kiem(abs(thang_sap - thang_ngua) / 5000.0 <= 0.03,
        format('TC-07d %s: chọn Sấp %s%% / chọn Ngửa %s%%', moc.ten, round(thang_sap / 50.0, 1), round(thang_ngua / 50.0, 1)));
    end if;
  end loop;
end $$;

-- Trả dòng của A về đúng ván 3 đã thua (để script kiểm tra chạy lại schema.sql không làm mất dữ liệu)
update public.rv_tien_do set trang_thai = 'ket-thuc', so_du = 0, so_lan_vay = 3, no_van_nay = 0,
  so_luot = 0, so_thang = 0, so_thua = 0, lich_su = '[]'::jsonb
where user_id = rv_test.a();

do $$ begin raise notice '=== TẤT CẢ ĐẠT: % kiểm tra ===', current_setting('rv_test.so_dat'); end $$;
