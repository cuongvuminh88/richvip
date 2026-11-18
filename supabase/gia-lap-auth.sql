-- CHỈ DÙNG KHI TEST trên Postgres thường (scripts/test-sql.sh). KHÔNG chạy trên Supabase.
-- Giả lập những gì Supabase có sẵn mà schema.sql cần: vai trò anon / authenticated,
-- schema auth với bảng users và hàm auth.uid() đọc user id từ cấu hình phiên
-- (Supabase đặt request.jwt.claim.sub từ JWT của người dùng).

create role anon nologin;
create role authenticated nologin;

create schema auth;
create table auth.users (id uuid primary key);

create function auth.uid() returns uuid
language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
grant usage on schema public to anon, authenticated;

-- Supabase cấp sẵn mọi quyền cho anon/authenticated trên đối tượng mới trong schema public.
-- Làm giống vậy để kiểm tra schema.sql đã tự thu hồi đúng.
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;
