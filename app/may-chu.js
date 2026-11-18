/* RichVip — giao tiếp với Supabase: đăng nhập Google và gọi các hàm rv_* (docs/04 §8).
 * Không chứa luật chơi: mọi tính toán nằm trong supabase/schema.sql.
 * Xuất ra window.RichVipMayChu; game.js dùng khi app/config.js có supabaseUrl.
 */
(function () {
  'use strict';

  // Thư viện supabase-js v2, ghi rõ phiên bản và mã băm (SRI) để CDN không thể tráo nội dung.
  const THU_VIEN = {
    src: 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/dist/umd/supabase.js',
    integrity: 'sha384-rwykjmWNwVxboyFmvK9OXN0wj9hnMHA2aAHtits54DuACyCq0M2PrSNxhRb+hvXT',
  };

  // Các tham số OAuth Supabase/Google gắn vào URL khi quay về; xoá sau khi đọc.
  const THAM_SO_OAUTH = ['code', 'state', 'error', 'error_code', 'error_description'];

  const cfg = window.RICHVIP_CONFIG || {};
  const url = typeof cfg.supabaseUrl === 'string' ? cfg.supabaseUrl.trim() : '';
  const khoa = typeof cfg.supabaseAnonKey === 'string' ? cfg.supabaseAnonKey.trim() : '';
  let sb = null;

  /** Lỗi đã phân loại: loai = 'phien' (cần đăng nhập lại) | 'mang' | 'dieu-kien' | 'khac'. */
  class LoiMayChu extends Error {
    constructor(loai, thongDiep, goc) {
      super(thongDiep);
      this.name = 'LoiMayChu';
      this.loai = loai;
      this.goc = goc;
    }
  }

  function phanLoai(loi, status) {
    const ma = (loi && loi.code) || '';
    const tin = (loi && loi.message) || String(loi || '');
    if (status === 401 || /^PGRST30/.test(ma) || ma === '28000' || ma === '42501' || /jwt/i.test(tin)) return 'phien';
    if (ma === 'P0001' || ma === '22023') return 'dieu-kien';
    if (!ma || /fetch|network|load failed/i.test(tin)) return 'mang';
    return 'khac';
  }

  function napThuVien() {
    if (window.supabase && window.supabase.createClient) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = THU_VIEN.src;
      s.integrity = THU_VIEN.integrity;
      s.crossOrigin = 'anonymous';
      s.referrerPolicy = 'no-referrer';
      s.onload = () => (window.supabase && window.supabase.createClient ? resolve() : reject(new Error('Thư viện không hợp lệ')));
      s.onerror = () => reject(new Error('Không tải được thư viện'));
      document.head.appendChild(s);
    });
  }

  /** Đọc lỗi OAuth trên URL (ví dụ người chơi bấm Huỷ ở trang Google). Trả về chuỗi hoặc ''. */
  function docLoiTuUrl() {
    const q = new URLSearchParams(window.location.search);
    const h = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    return q.get('error_description') || h.get('error_description') || q.get('error') || h.get('error') || '';
  }

  /** Xoá tham số OAuth khỏi thanh địa chỉ, giữ các tham số khác. */
  function donUrl() {
    const u = new URL(window.location.href);
    let doi = false;
    for (const k of THAM_SO_OAUTH) if (u.searchParams.has(k)) { u.searchParams.delete(k); doi = true; }
    if (/(^#|&)(access_token|error)=/.test(u.hash)) { u.hash = ''; doi = true; }
    if (doi) window.history.replaceState(null, '', u.pathname + u.search + u.hash);
  }

  async function goi(ten, thamSo) {
    let kq;
    try {
      kq = await sb.rpc(ten, thamSo);
    } catch (e) {
      throw new LoiMayChu('mang', 'Không kết nối được máy chủ', e);
    }
    if (kq.error) {
      const loai = phanLoai(kq.error, kq.status);
      console.warn('[RichVip] ' + ten + ' lỗi (' + loai + '):', kq.error.code || '', kq.error.message || kq.error);
      throw new LoiMayChu(loai, kq.error.message || 'Lỗi máy chủ', kq.error);
    }
    return kq.data;
  }

  window.RichVipMayChu = {
    coCauHinh: url !== '',
    LoiMayChu,

    /** Nạp thư viện và tạo client. Trả về phiên hiện tại (hoặc null). */
    async khoiTao() {
      if (!url || !khoa) throw new LoiMayChu('khac', 'Thiếu supabaseUrl hoặc supabaseAnonKey trong app/config.js');
      try {
        await napThuVien();
      } catch (e) {
        throw new LoiMayChu('thu-vien', 'Không tải được thư viện đăng nhập', e);
      }
      sb = window.supabase.createClient(url, khoa, {
        auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true, autoRefreshToken: true },
      });
      const loiUrl = docLoiTuUrl();
      const { data, error } = await sb.auth.getSession(); // chờ cả bước đổi ?code= lấy phiên
      donUrl();
      if (loiUrl) throw new LoiMayChu('dang-nhap', loiUrl);
      if (error) throw new LoiMayChu(phanLoai(error, error.status), error.message, error);
      return data.session || null;
    },

    /** Gọi cb(phien) mỗi khi đăng nhập / đăng xuất / phiên hết hạn. */
    khiDoiPhien(cb) {
      sb.auth.onAuthStateChange((suKien, phien) => cb(phien || null, suKien));
    },

    /** Tên hiển thị: tên Google, nếu không có thì phần trước @ của email. */
    tenHienThi(phien) {
      const u = (phien && phien.user) || {};
      const m = u.user_metadata || {};
      return m.full_name || m.name || (u.email ? u.email.split('@')[0] : 'Người chơi');
    },

    /** Chuyển sang trang đăng nhập Google; quay về đúng trang hiện tại. */
    async dangNhap() {
      const ve = window.location.origin + window.location.pathname;
      const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: ve } });
      if (error) throw new LoiMayChu(phanLoai(error, error.status), error.message, error);
    },

    async dangXuat() {
      try { await sb.auth.signOut(); } catch (e) { /* mất mạng: phiên trên trình duyệt vẫn bị xoá */ }
    },

    layTienDo: () => goi('rv_lay_tien_do'),
    tungXu: (chon) => goi('rv_tung_xu', { p_chon: chon }),
    vay: () => goi('rv_vay'),
    choiLai: () => goi('rv_choi_lai'),

    // Trang admin — chỉ xem (docs/04 §12). Máy chủ tự kiểm tra quyền admin.
    adminLaQuanTri: () => goi('rv_admin_la_quan_tri'),
    adminTongQuan: () => goi('rv_admin_tong_quan'),
    adminDanhSach: () => goi('rv_admin_danh_sach'),
  };
})();
