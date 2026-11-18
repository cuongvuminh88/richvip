/* RichVip — cấu hình kết nối Supabase (docs/04-quy-tac-du-lieu.html §9, §11).
 *
 * Lấy hai giá trị trong Supabase → Project Settings → API (hoặc Connect):
 *   supabaseUrl      Project URL, dạng https://xxxx.supabase.co
 *   supabaseAnonKey  khoá "anon" / "publishable" — ĐƯỢC PHÉP công khai, an toàn nhờ RLS và quyền hàm.
 *
 * TUYỆT ĐỐI KHÔNG dán "service_role" / "secret" key vào đây.
 * Để trống supabaseUrl → game chạy ở CHẾ ĐỘ CỤC BỘ (không đăng nhập, lưu trên trình duyệt, chỉ để phát triển).
 */
window.RICHVIP_CONFIG = {
  supabaseUrl: '',
  supabaseAnonKey: '',
};
