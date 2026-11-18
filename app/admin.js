/* RichVip — trang admin, CHỈ XEM (docs/02 F-13, docs/03 S-04, docs/04 §12).
 * Quyền admin do máy chủ kiểm tra trong các hàm rv_admin_*; trang này chỉ hiển thị.
 * Mọi chữ lấy từ dữ liệu (email, tên) đều gán bằng textContent, không dùng innerHTML.
 */
(function () {
  'use strict';

  const MayChu = window.RichVipMayChu;
  const $ = (id) => document.getElementById(id);
  const el = {
    khuNguoiChoi: $('khu-nguoi-choi'), tenNguoiChoi: $('ten-nguoi-choi'), btnDangXuat: $('btn-dang-xuat'),
    dangNhap: $('ad-dang-nhap'), dnLoi: $('ad-dn-loi'), btnDangNhap: $('btn-dang-nhap'),
    thongBao: $('ad-thong-bao'), thongBaoChu: $('ad-thong-bao-chu'),
    noiDung: $('ad-noi-dung'),
    tkNguoiChoi: $('tk-nguoi-choi'), tk7Ngay: $('tk-7-ngay'), tkTongNo: $('tk-tong-no'), tkVanThua: $('tk-van-thua'), tkLuot: $('tk-luot'),
    tim: $('ad-tim'), sapXep: $('ad-sap-xep'), btnTaiLai: $('btn-tai-lai'),
    dem: $('ad-dem'), loi: $('ad-loi'), bang: $('ad-bang'),
  };

  const TEN_TRANG_THAI = { 'dang-choi': 'Đang chơi', 'cho-vay': 'Chờ vay', 'ket-thuc': 'Màn hình nợ' };
  const so = (n) => new Intl.NumberFormat('vi-VN').format(Number(n) || 0);
  const tien = (n) => so(n) + ' đ';
  const hai = (n) => String(n).padStart(2, '0');
  function gio(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d)) return '—';
    return hai(d.getDate()) + '/' + hai(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + hai(d.getHours()) + ':' + hai(d.getMinutes());
  }
  const boDau = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

  let phien = null;
  let danhSach = [];
  let dangTai = false;
  let dangXuatChuDong = false;

  /* ---------- Chuyển lớp hiển thị ---------- */
  function hienDangNhap({ ban = false, chu = '', loi = '' } = {}) {
    el.dangNhap.hidden = false;
    el.thongBao.hidden = true;
    el.noiDung.hidden = true;
    el.khuNguoiChoi.hidden = true;
    el.btnDangNhap.disabled = ban;
    el.btnDangNhap.textContent = chu || 'Đăng nhập bằng Google';
    el.dnLoi.hidden = !loi;
    el.dnLoi.textContent = loi;
  }

  function hienThongBao(chu, coNguoiChoi) {
    el.dangNhap.hidden = true;
    el.noiDung.hidden = true;
    el.thongBao.hidden = false;
    el.thongBaoChu.textContent = chu;
    el.khuNguoiChoi.hidden = !coNguoiChoi;
  }

  function hienNoiDung() {
    el.dangNhap.hidden = true;
    el.thongBao.hidden = true;
    el.noiDung.hidden = false;
    el.khuNguoiChoi.hidden = false;
  }

  /* ---------- Vẽ dữ liệu ---------- */
  function veTongQuan(tq) {
    el.tkNguoiChoi.textContent = so(tq.soNguoiChoi);
    el.tk7Ngay.textContent = so(tq.soNguoiChoi7Ngay);
    el.tkTongNo.textContent = tien(tq.tongNo);
    el.tkVanThua.textContent = so(tq.tongVanThua);
    el.tkLuot.textContent = so(tq.tongLuot);
  }

  function o(chu, lop) {
    const td = document.createElement('td');
    td.textContent = chu;
    if (lop) td.className = lop;
    return td;
  }

  function veBang() {
    const tu = boDau(el.tim.value.trim());
    const cach = el.sapXep.value;
    const loc = danhSach.filter((d) => !tu || boDau(d.email).includes(tu) || boDau(d.ten).includes(tu));
    const thoiGian = (x) => (x ? new Date(x).getTime() : 0);
    loc.sort((a, b) => {
      if (cach === 'no') return (b.tongNo - a.tongNo) || (thoiGian(b.capNhatLuc) - thoiGian(a.capNhatLuc));
      if (cach === 'luot') return (b.soLuot - a.soLuot) || (thoiGian(b.capNhatLuc) - thoiGian(a.capNhatLuc));
      return thoiGian(b.capNhatLuc) - thoiGian(a.capNhatLuc);
    });

    el.bang.textContent = '';
    for (const d of loc) {
      const tr = document.createElement('tr');
      const trangThai = o(TEN_TRANG_THAI[d.trangThai] || d.trangThai || '—');
      trangThai.dataset.trangThai = d.trangThai || '';
      tr.append(
        o(d.email || '—', 'cell-email'),
        o(d.ten || '—'),
        trangThai,
        o(tien(d.soDu), 'num money'),
        o(so(d.soLanVay) + ' / 3', 'num'),
        o(tien(d.tongNo), 'num money' + (d.tongNo > 0 ? ' debt' : '')),
        o(so(d.soVanThua), 'num'),
        o(so(d.soLuot), 'num'),
        o(gio(d.capNhatLuc), 'cell-time'),
        o(gio(d.dangNhapCuoi), 'cell-time'),
      );
      el.bang.appendChild(tr);
    }
    if (loc.length === 0) {
      const tr = document.createElement('tr');
      const td = o(danhSach.length ? 'Không có người chơi nào khớp.' : 'Chưa có người chơi nào.', 'cell-empty');
      td.colSpan = 10;
      tr.appendChild(td);
      el.bang.appendChild(tr);
    }
    el.dem.textContent = 'Hiển thị ' + so(loc.length) + ' / ' + so(danhSach.length) + ' người chơi';
  }

  /* ---------- Tải dữ liệu từ máy chủ ---------- */
  async function hetPhien() {
    dangXuatChuDong = true;
    phien = null;
    await MayChu.dangXuat();
    dangXuatChuDong = false;
    hienDangNhap({ loi: 'Phiên đăng nhập đã hết, vui lòng đăng nhập lại.' });
  }

  async function taiDuLieu() {
    if (dangTai) return;
    dangTai = true;
    el.btnTaiLai.disabled = true;
    el.btnTaiLai.textContent = 'Đang tải…';
    el.loi.hidden = true;
    try {
      const laQuanTri = await MayChu.adminLaQuanTri();
      if (laQuanTri !== true) {
        hienThongBao('Tài khoản này không có quyền admin.', true);
        return;
      }
      const [tq, ds] = await Promise.all([MayChu.adminTongQuan(), MayChu.adminDanhSach()]);
      danhSach = Array.isArray(ds) ? ds : [];
      veTongQuan(tq || {});
      veBang();
      hienNoiDung();
    } catch (e) {
      if (e && e.loai === 'phien') return hetPhien();
      if (!el.noiDung.hidden) {
        el.loi.textContent = 'Không tải được dữ liệu. Kiểm tra kết nối mạng rồi bấm Tải lại.';
        el.loi.hidden = false;
      } else {
        hienDangNhap({ loi: 'Không tải được dữ liệu. Kiểm tra kết nối mạng rồi tải lại trang.' });
        el.khuNguoiChoi.hidden = false;
      }
    } finally {
      dangTai = false;
      el.btnTaiLai.disabled = false;
      el.btnTaiLai.textContent = 'Tải lại';
    }
  }

  /* ---------- Sự kiện ---------- */
  el.btnDangNhap.addEventListener('click', async () => {
    hienDangNhap({ ban: true, chu: 'Đang đăng nhập…' });
    try {
      await MayChu.dangNhap(); // quay về đúng admin.html
    } catch (e) {
      hienDangNhap({ loi: 'Không mở được trang đăng nhập Google. Kiểm tra kết nối mạng rồi thử lại.' });
    }
  });
  el.btnDangXuat.addEventListener('click', async () => {
    dangXuatChuDong = true;
    phien = null;
    await MayChu.dangXuat();
    dangXuatChuDong = false;
    danhSach = [];
    el.bang.textContent = '';
    hienDangNhap({});
  });
  el.btnTaiLai.addEventListener('click', taiDuLieu);
  el.tim.addEventListener('input', veBang);
  el.sapXep.addEventListener('change', veBang);

  /* ---------- Khởi động ---------- */
  async function khoiDong() {
    if (!MayChu || !MayChu.coCauHinh) {
      hienThongBao('Trang admin cần kết nối Supabase (app/config.js đang để trống).', false);
      return;
    }
    try {
      phien = await MayChu.khoiTao();
    } catch (e) {
      if (e.loai === 'thu-vien') hienDangNhap({ ban: true, loi: 'Không tải được thư viện đăng nhập. Kiểm tra kết nối mạng rồi tải lại trang.' });
      else if (e.loai === 'dang-nhap') hienDangNhap({ loi: 'Đăng nhập chưa thành công (' + e.message + '). Bạn có thể thử lại.' });
      else hienDangNhap({ loi: 'Không khởi động được đăng nhập. Thử tải lại trang.' });
      return;
    }
    MayChu.khiDoiPhien((p, suKien) => {
      if (p) { phien = p; return; }
      if (suKien === 'SIGNED_OUT' && !dangXuatChuDong && phien) {
        phien = null;
        hienDangNhap({ loi: 'Phiên đăng nhập đã hết, vui lòng đăng nhập lại.' });
      }
    });
    if (!phien) { hienDangNhap({}); return; }
    el.tenNguoiChoi.textContent = MayChu.tenHienThi(phien);
    el.tenNguoiChoi.title = el.tenNguoiChoi.textContent;
    hienDangNhap({ ban: true, chu: 'Đang tải…' });
    await taiDuLieu();
  }

  khoiDong();
})();
