/* RichVip — mini game đoán Sấp / Ngửa.
 * Tài liệu: docs/02-chuc-nang.html, docs/03-man-hinh.html, docs/04-quy-tac-du-lieu.html.
 *
 * Khi app/config.js có supabaseUrl: bắt buộc đăng nhập Google, luật chơi chạy trên máy chủ
 * (supabase/schema.sql, gọi qua app/may-chu.js). Khi để trống: chế độ cục bộ, luật chạy bằng
 * logic thuần dưới đây và lưu localStorage (docs/04 §11).
 *
 * Cấu trúc file:
 *   1. Hằng số cấu hình            (docs/04 §1 — bản sao của rv_cau_hinh() trên máy chủ)
 *   2. Logic thuần — không đụng DOM (docs/04 §2–§4, §7). Dùng cho chế độ cục bộ, kiểm tra dữ liệu và app/test.html.
 *   3. Lưu trữ localStorage        (docs/04 §6, §10)
 *   4. Âm thanh tổng hợp            (F-10)
 *   5. Giao diện                    (chỉ chạy khi trang có #game-root)
 *   6. Công cụ test ?test=1         (docs/05 §3 — chỉ ở chế độ cục bộ)
 */
(function () {
  'use strict';

  /* ======================================================================
   * 1. HẰNG SỐ CẤU HÌNH
   * ==================================================================== */
  const CAU_HINH = Object.freeze({
    SO_DU_DAU: 1000000,
    MUC_CUOC: 500000,
    CAC_MUC_VAY: Object.freeze([3000000, 5000000, 10000000]),
    SO_LAN_VAY_TOI_DA: 3,
    SO_TAI_KHOAN: 'ACB 99995886',
    GHI_CHU_NO_AO: '(Nợ ảo trong game, không cần chuyển tiền thật.)',
    SO_DONG_LICH_SU: 10,
    THOI_GIAN_XOAY: 1500,
    TI_LE_THEO_LUOT: Object.freeze([0.8, 0.6, 0.4, 0.2, 0]),
    TI_LE_THEO_VAY: Object.freeze([1, 0.3, 0.15, 0]),
  });

  const KHOA_STATE = 'richvip.state';
  const KHOA_AM_THANH = 'richvip.amThanh';
  const TRANG_THAI = ['dang-choi', 'cho-vay', 'ket-thuc'];
  const MAT = ['sap', 'ngua'];
  const TEN_MAT = { sap: 'SẤP', ngua: 'NGỬA' };
  const TEN_MAT_THUONG = { sap: 'Sấp', ngua: 'Ngửa' };

  // Nợ tích luỹ sau 0, 1, 2, 3 lần vay: [0, 3tr, 8tr, 18tr]
  const NO_SAU_LAN_VAY = CAU_HINH.CAC_MUC_VAY.reduce((acc, m) => acc.concat(acc[acc.length - 1] + m), [0]);
  const NO_MOI_VAN = NO_SAU_LAN_VAY[NO_SAU_LAN_VAY.length - 1];

  /* ======================================================================
   * 2. LOGIC THUẦN
   * ==================================================================== */
  const sao = (o) => JSON.parse(JSON.stringify(o));
  const matKhac = (m) => (m === 'sap' ? 'ngua' : 'sap');

  function dinhDangTien(so) {
    return new Intl.NumberFormat('vi-VN').format(so) + ' đ';
  }

  function taoVanMoi(noCu = 0, soVanThua = 0, luaChon = null) {
    return {
      version: 1,
      trangThai: 'dang-choi',
      soDu: CAU_HINH.SO_DU_DAU,
      soLanVay: 0,
      noVanNay: 0,
      noCu,
      soVanThua,
      luaChon,
      matXuCuoi: null,
      thongKe: { soLuot: 0, soThang: 0, soThua: 0 },
      lichSu: [],
    };
  }

  /** Tỉ lệ thắng của lượt sắp tung (docs/04 §3). */
  function tiLeThang(s) {
    const n = s.thongKe.soLuot + 1;
    const bang = CAU_HINH.TI_LE_THEO_LUOT;
    const tiLeTheoLuot = bang[Math.min(Math.floor((n - 1) / 5), bang.length - 1)];
    const tiLeTheoVay = CAU_HINH.TI_LE_THEO_VAY[s.soLanVay];
    return Math.min(tiLeTheoLuot, tiLeTheoVay);
  }

  function themLichSu(s, dong) {
    s.lichSu.unshift(dong);
    if (s.lichSu.length > CAU_HINH.SO_DONG_LICH_SU) s.lichSu.length = CAU_HINH.SO_DONG_LICH_SU;
  }

  function ketThucVan(s) {
    s.noCu += s.noVanNay;
    s.noVanNay = 0;
    s.soVanThua += 1;
    s.trangThai = 'ket-thuc';
  }

  /**
   * Tung xu. Trả về { state, ketQua, dung, tiLe } hoặc null nếu không được phép tung.
   * tuyChon.rand: hàm sinh số ngẫu nhiên [0,1) (để test); tuyChon.ep: 'sap' | 'ngua' ép kết quả (chế độ test).
   */
  function tungXu(s, tuyChon = {}) {
    if (s.trangThai !== 'dang-choi' || !MAT.includes(s.luaChon) || s.soDu <= 0) return null;
    const rand = tuyChon.rand || Math.random;
    const tiLe = tiLeThang(s);
    const ketQua = MAT.includes(tuyChon.ep) ? tuyChon.ep : (rand() < tiLe ? s.luaChon : matKhac(s.luaChon));
    const dung = ketQua === s.luaChon;

    const t = sao(s);
    t.soDu += dung ? CAU_HINH.MUC_CUOC : -CAU_HINH.MUC_CUOC;
    t.thongKe.soLuot += 1;
    if (dung) t.thongKe.soThang += 1; else t.thongKe.soThua += 1;
    t.matXuCuoi = ketQua;
    themLichSu(t, { loai: 'tung', chon: s.luaChon, ketQua, dung, soDuSau: t.soDu });

    if (t.soDu === 0) {
      if (t.soLanVay < CAU_HINH.SO_LAN_VAY_TOI_DA) t.trangThai = 'cho-vay';
      else ketThucVan(t);
    }
    return { state: t, ketQua, dung, tiLe };
  }

  /** Vay tiền. Trả về state mới hoặc null nếu không được phép vay. */
  function vay(s) {
    if (s.trangThai !== 'cho-vay' || s.soDu !== 0 || s.soLanVay >= CAU_HINH.SO_LAN_VAY_TOI_DA) return null;
    const t = sao(s);
    const tien = CAU_HINH.CAC_MUC_VAY[t.soLanVay];
    t.soDu += tien;
    t.noVanNay += tien;
    t.soLanVay += 1;
    t.trangThai = 'dang-choi';
    themLichSu(t, { loai: 'vay', soTien: tien, soDuSau: t.soDu });
    return t;
  }

  /** Số tiền của lần vay kế tiếp, hoặc null nếu đã vay đủ. */
  function mucVayKeTiep(s) {
    return s.soLanVay < CAU_HINH.SO_LAN_VAY_TOI_DA ? CAU_HINH.CAC_MUC_VAY[s.soLanVay] : null;
  }

  /** Chơi lại: ván mới, giữ nợ cũ và số ván đã thua. */
  function choiLai(s) {
    if (s.trangThai !== 'ket-thuc') return null;
    return taoVanMoi(s.noCu, s.soVanThua, s.luaChon);
  }

  function cauThongBaoNo(s) {
    return 'Bạn nợ số tiền là ' + dinhDangTien(s.noCu) + ', vui lòng chuyển khoản vào số tài khoản ' +
      CAU_HINH.SO_TAI_KHOAN + ' để trả nợ. ' + CAU_HINH.GHI_CHU_NO_AO;
  }

  /** Kiểm tra dữ liệu đọc lên (docs/04 §7). Trả về '' nếu hợp lệ, ngược lại là lý do. */
  function kiemTra(s) {
    const laSoNguyen = (x) => Number.isInteger(x) && x >= 0;
    const laTien = (x) => laSoNguyen(x) && x % CAU_HINH.MUC_CUOC === 0;
    const laMat = (x) => x === null || MAT.includes(x);

    if (!s || typeof s !== 'object' || Array.isArray(s)) return 'không phải object';
    if (s.version !== 1) return 'sai version';
    if (!TRANG_THAI.includes(s.trangThai)) return 'trangThai không hợp lệ';
    for (const k of ['soDu', 'noVanNay', 'noCu']) if (!laTien(s[k])) return k + ' không hợp lệ';
    if (!laSoNguyen(s.soLanVay) || s.soLanVay > CAU_HINH.SO_LAN_VAY_TOI_DA) return 'soLanVay không hợp lệ';
    if (!laSoNguyen(s.soVanThua)) return 'soVanThua không hợp lệ';
    const noMongDoi = s.trangThai === 'ket-thuc' ? 0 : NO_SAU_LAN_VAY[s.soLanVay];
    if (s.noVanNay !== noMongDoi) return 'noVanNay không khớp số lần vay';
    if (s.noCu !== s.soVanThua * NO_MOI_VAN) return 'noCu không khớp số ván đã thua';
    if (s.trangThai === 'cho-vay' && !(s.soDu === 0 && s.soLanVay < CAU_HINH.SO_LAN_VAY_TOI_DA)) return 'cho-vay sai điều kiện';
    if (s.trangThai === 'ket-thuc' && !(s.soDu === 0 && s.soLanVay === CAU_HINH.SO_LAN_VAY_TOI_DA)) return 'ket-thuc sai điều kiện';
    // Bổ sung ngoài docs/04 §7: đang chơi mà số dư 0 sẽ kẹt (không tung được, không có hộp thoại vay).
    if (s.trangThai === 'dang-choi' && s.soDu === 0) return 'dang-choi nhưng số dư bằng 0';
    if (!laMat(s.luaChon) || !laMat(s.matXuCuoi)) return 'luaChon/matXuCuoi không hợp lệ';
    const tk = s.thongKe;
    if (!tk || !laSoNguyen(tk.soLuot) || !laSoNguyen(tk.soThang) || !laSoNguyen(tk.soThua)) return 'thongKe không hợp lệ';
    if (tk.soThang + tk.soThua !== tk.soLuot) return 'thongKe không cộng đúng';
    if (!Array.isArray(s.lichSu) || s.lichSu.length > CAU_HINH.SO_DONG_LICH_SU) return 'lichSu không hợp lệ';
    for (const d of s.lichSu) {
      if (!d || typeof d !== 'object') return 'dòng lịch sử không hợp lệ';
      if (d.loai === 'tung') {
        if (!MAT.includes(d.chon) || !MAT.includes(d.ketQua) || typeof d.dung !== 'boolean' || !laTien(d.soDuSau)) return 'dòng tung không hợp lệ';
      } else if (d.loai === 'vay') {
        if (!CAU_HINH.CAC_MUC_VAY.includes(d.soTien) || !laTien(d.soDuSau)) return 'dòng vay không hợp lệ';
      } else return 'loại dòng lịch sử lạ';
    }
    return '';
  }

  const Logic = {
    CAU_HINH, NO_SAU_LAN_VAY, NO_MOI_VAN, TEN_MAT,
    dinhDangTien, taoVanMoi, tiLeThang, tungXu, vay, mucVayKeTiep, choiLai, cauThongBaoNo, kiemTra,
  };
  window.RichVipLogic = Logic;

  /* ======================================================================
   * 3. LƯU TRỮ — mọi lần đọc/ghi đều bọc try/catch
   * ==================================================================== */
  const LuuTru = {
    doc(khoa) { try { return window.localStorage.getItem(khoa); } catch (e) { return null; } },
    ghi(khoa, gt) { try { window.localStorage.setItem(khoa, gt); return true; } catch (e) { return false; } },
    xoa(khoa) { try { window.localStorage.removeItem(khoa); } catch (e) { /* bỏ qua */ } },
  };

  function docState() {
    const raw = LuuTru.doc(KHOA_STATE);
    if (raw === null) return taoVanMoi();
    let s;
    try { s = JSON.parse(raw); } catch (e) { s = undefined; }
    const loi = s === undefined ? 'JSON hỏng' : kiemTra(s);
    if (loi) {
      console.warn('[RichVip] Dữ liệu lưu không hợp lệ (' + loi + '). Đã xoá và tạo ván mới.');
      LuuTru.xoa(KHOA_STATE);
      return taoVanMoi();
    }
    return s;
  }

  /* ======================================================================
   * 4. ÂM THANH — tổng hợp bằng Web Audio API, không dùng file
   * ==================================================================== */
  const AmThanh = (function () {
    let ctx = null;
    let bat = true;

    function layCtx() {
      if (!bat) return null;
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        try { ctx = new AC(); } catch (e) { return null; }
      }
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return ctx;
    }

    function not(c, tanSo, batDau, dai, { kieu = 'sine', am = 0.18, truotDen = null } = {}) {
      const t0 = c.currentTime + batDau;
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = kieu;
      osc.frequency.setValueAtTime(tanSo, t0);
      if (truotDen) osc.frequency.exponentialRampToValueAtTime(truotDen, t0 + dai);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(am, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dai);
      osc.connect(g).connect(c.destination);
      osc.start(t0);
      osc.stop(t0 + dai + 0.02);
    }

    function nhieu(c, batDau, dai, { tanSo = 2500, q = 1.2, am = 0.15 } = {}) {
      const t0 = c.currentTime + batDau;
      const buf = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * dai)), c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const src = c.createBufferSource();
      src.buffer = buf;
      const f = c.createBiquadFilter();
      f.type = 'bandpass'; f.frequency.value = tanSo; f.Q.value = q;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(am, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dai);
      src.connect(f).connect(g).connect(c.destination);
      src.start(t0);
      src.stop(t0 + dai + 0.02);
    }

    return {
      // Không tạo AudioContext ở đây: chỉ tạo khi người chơi đã tương tác (mo() / lúc phát tiếng).
      datBat(gt) { bat = !!gt; if (!bat && ctx) ctx.suspend().catch(() => {}); },
      dangBat() { return bat; },
      mo() { layCtx(); },
      /** Tiếng xu xoay: chuỗi tiếng "tinh" thưa dần, dài bằng hiệu ứng. */
      xoay(ms) {
        const c = layCtx(); if (!c) return;
        let t = 0, buoc = 0.045;
        const tong = ms / 1000;
        while (t < tong - 0.05) {
          not(c, 2200 + Math.random() * 500, t, 0.05, { kieu: 'triangle', am: 0.06 });
          t += buoc;
          buoc *= 1.12;
        }
      },
      thang() {
        const c = layCtx(); if (!c) return;
        [784, 988, 1175, 1568].forEach((f, i) => not(c, f, i * 0.08, 0.28, { kieu: 'triangle', am: 0.16 }));
        not(c, 2637, 0.34, 0.5, { kieu: 'sine', am: 0.1 });
      },
      thua() {
        const c = layCtx(); if (!c) return;
        not(c, 220, 0, 0.42, { kieu: 'sine', am: 0.22, truotDen: 98 });
        not(c, 110, 0.02, 0.3, { kieu: 'square', am: 0.04 });
      },
      vay() {
        const c = layCtx(); if (!c) return;
        nhieu(c, 0, 0.09, { tanSo: 3200, am: 0.12 });
        nhieu(c, 0.12, 0.07, { tanSo: 2800, am: 0.1 });
        nhieu(c, 0.22, 0.12, { tanSo: 3500, am: 0.12 });
        not(c, 140, 0.4, 0.16, { kieu: 'sine', am: 0.28, truotDen: 70 });
      },
      ketThuc() {
        const c = layCtx(); if (!c) return;
        [392, 370, 349, 262].forEach((f, i) => not(c, f, i * 0.32, i === 3 ? 1.1 : 0.34, { kieu: 'triangle', am: 0.16 }));
      },
    };
  })();

  /* ======================================================================
   * 5. GIAO DIỆN
   * ==================================================================== */
  const goc = document.getElementById('game-root');
  if (!goc) return; // app/test.html chỉ dùng phần logic

  const $ = (id) => document.getElementById(id);
  const el = {
    btnAmThanh: $('btn-am-thanh'), daiCucBo: $('dai-cuc-bo'),
    khuNguoiChoi: $('khu-nguoi-choi'), tenNguoiChoi: $('ten-nguoi-choi'), btnDangXuat: $('btn-dang-xuat'),
    manDangNhap: $('man-dang-nhap'), dnTieuDe: $('dn-tieu-de'), dnLoi: $('dn-loi'), btnDangNhap: $('btn-dang-nhap'),
    manChoi: $('man-choi'), manNo: $('man-no'), hopVay: $('hop-vay'),
    soDu: $('so-du'), daVay: $('da-vay'), noVanNay: $('no-van-nay'), oNoCu: $('o-no-cu'), noCu: $('no-cu'),
    coinInner: $('coin-inner'), coinFront: $('coin-front'), coinBack: $('coin-back'),
    thongBao: $('thong-bao'),
    btnSap: $('btn-sap'), btnNgua: $('btn-ngua'), btnTung: $('btn-tung'),
    lichSu: $('lich-su'), lsTrong: $('ls-trong'), thongKe: $('thong-ke'),
    cauNo: $('cau-no'), noLuot: $('no-luot'), noThang: $('no-thang'), noThua: $('no-thua'), noSoVan: $('no-so-van'),
    btnChoiLai: $('btn-choi-lai'),
    vayCau: $('vay-cau'), vayCon: $('vay-con'), btnVay: $('btn-vay'),
  };

  const giamChuyenDong = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  const MayChu = window.RichVipMayChu;
  // Chế độ cục bộ (docs/04 §11): app/config.js chưa có supabaseUrl → không đăng nhập, luật chạy bằng game.js.
  const CHE_DO_CUC_BO = !MayChu || !MayChu.coCauHinh;
  const CHE_DO_TEST = CHE_DO_CUC_BO && new URLSearchParams(window.location.search).get('test') === '1';

  let state = null;           // null khi chưa đăng nhập / chưa tải xong
  let dangXoay = false;       // đang tung xu (chờ máy chủ + hiệu ứng)
  let dangGui = false;        // đang chờ máy chủ cho lệnh Vay / Chơi lại
  let soDuDangHien = 0;
  let hoatAnhSo = 0;
  let trangThaiPhuDangHien = null; // để biết lúc nào vừa mở hộp thoại / màn hình nợ
  let phienHienTai = null;
  let dangXuatChuDong = false;
  let nutDangNhapLa = 'dang-nhap'; // 'dang-nhap' | 'thu-lai'

  /* ---------- Nguồn dữ liệu: cục bộ hoặc máy chủ, cùng một giao diện bất đồng bộ ---------- */
  function luuCucBo() { LuuTru.ghi(KHOA_STATE, JSON.stringify(state)); }

  const NguonCucBo = {
    async layTienDo() { return docState(); },
    async tungXu(chon) {
      const kq = tungXu(Object.assign({}, state, { luaChon: chon }), { ep: CHE_DO_TEST ? CongCuTest.layEp() : null });
      if (!kq) throw Object.assign(new Error('Không tung được lúc này'), { loai: 'dieu-kien' });
      LuuTru.ghi(KHOA_STATE, JSON.stringify(kq.state)); // lưu NGAY, trước hiệu ứng
      return kq;
    },
    async vay() {
      const moi = vay(state);
      if (!moi) throw Object.assign(new Error('Chưa được vay'), { loai: 'dieu-kien' });
      LuuTru.ghi(KHOA_STATE, JSON.stringify(moi));
      return moi;
    },
    async choiLai() {
      const moi = choiLai(state);
      if (!moi) throw Object.assign(new Error('Ván chưa kết thúc'), { loai: 'dieu-kien' });
      LuuTru.ghi(KHOA_STATE, JSON.stringify(moi));
      return moi;
    },
  };

  /** Kiểm tra lại dữ liệu máy chủ trả về trước khi vẽ (phòng lệch phiên bản giữa SQL và game.js). */
  function hopLe(s) {
    const loi = kiemTra(s);
    if (loi) {
      console.warn('[RichVip] Dữ liệu máy chủ không hợp lệ (' + loi + ').', s);
      throw Object.assign(new Error('Dữ liệu máy chủ không hợp lệ'), { loai: 'khac' });
    }
    return s;
  }

  const NguonMayChu = {
    async layTienDo() { return hopLe(await MayChu.layTienDo()); },
    async tungXu(chon) {
      const kq = await MayChu.tungXu(chon);
      hopLe(kq && kq.state);
      return { state: kq.state, ketQua: kq.ketQua, dung: kq.dung };
    },
    async vay() { return hopLe(await MayChu.vay()); },
    async choiLai() { return hopLe(await MayChu.choiLai()); },
  };

  const nguon = CHE_DO_CUC_BO ? NguonCucBo : NguonMayChu;

  // ---------- Số dư nhảy số ----------
  function hienSoDu(gt, hieuUng) {
    cancelAnimationFrame(hoatAnhSo);
    const tu = soDuDangHien;
    soDuDangHien = gt;
    if (!hieuUng || giamChuyenDong.matches || tu === gt) {
      el.soDu.textContent = dinhDangTien(gt);
      return;
    }
    const batDau = performance.now(), dai = 450;
    const buoc = (now) => {
      const p = Math.min(1, (now - batDau) / dai);
      const e = 1 - Math.pow(1 - p, 3);
      const so = Math.round((tu + (gt - tu) * e) / 1000) * 1000;
      el.soDu.textContent = dinhDangTien(p === 1 ? gt : so);
      if (p < 1) hoatAnhSo = requestAnimationFrame(buoc);
    };
    hoatAnhSo = requestAnimationFrame(buoc);
    el.soDu.classList.remove('bump');
    void el.soDu.offsetWidth;
    el.soDu.classList.add('bump');
  }

  // ---------- Lịch sử ----------
  function veLichSu(v) {
    el.lichSu.textContent = '';
    for (const d of v.lichSu) {
      const li = document.createElement('li');
      const trai = document.createElement('span');
      trai.className = 'h-left';
      const phai = document.createElement('span');
      phai.className = 'h-right';
      const soDu = document.createElement('span');
      soDu.className = 'h-bal money';
      soDu.textContent = dinhDangTien(d.soDuSau);
      if (d.loai === 'vay') {
        li.className = 'loan';
        trai.textContent = 'Vay +' + dinhDangTien(d.soTien);
      } else {
        trai.textContent = TEN_MAT_THUONG[d.chon] + ' → ' + TEN_MAT_THUONG[d.ketQua];
        const badge = document.createElement('span');
        badge.className = 'badge ' + (d.dung ? 'badge-win' : 'badge-lose');
        badge.textContent = d.dung ? '+500K' : '−500K';
        badge.setAttribute('aria-label', d.dung ? 'đúng, cộng 500 nghìn' : 'sai, trừ 500 nghìn');
        phai.appendChild(badge);
      }
      phai.appendChild(soDu);
      li.append(trai, phai);
      el.lichSu.appendChild(li);
    }
    el.lsTrong.hidden = v.lichSu.length > 0;
    const tk = v.thongKe;
    el.thongKe.textContent = 'Lượt ' + tk.soLuot + ' · Thắng ' + tk.soThang + ' · Thua ' + tk.soThua;
  }

  /**
   * Vẽ giao diện game theo trạng thái v.
   * tuyChon.giuManChoi: giữ màn hình chơi (chưa mở hộp thoại / màn hình nợ) để người chơi kịp thấy kết quả.
   */
  function ve(v, tuyChon = {}) {
    const giu = !!tuyChon.giuManChoi;
    const phu = giu ? 'dang-choi' : v.trangThai;
    el.manDangNhap.hidden = true;

    hienSoDu(v.soDu, !!tuyChon.hieuUngSo);
    el.daVay.textContent = v.soLanVay + ' / ' + CAU_HINH.SO_LAN_VAY_TOI_DA;
    el.noVanNay.textContent = dinhDangTien(v.noVanNay);
    el.oNoCu.hidden = v.noCu === 0;
    el.noCu.textContent = dinhDangTien(v.noCu);

    if (!dangXoay) el.coinFront.textContent = v.matXuCuoi ? TEN_MAT[v.matXuCuoi] : '?';

    const khoa = dangXoay || v.trangThai !== 'dang-choi' || v.soDu === 0;
    for (const [btn, mat] of [[el.btnSap, 'sap'], [el.btnNgua, 'ngua']]) {
      btn.setAttribute('aria-pressed', String(v.luaChon === mat));
      btn.disabled = khoa;
    }
    el.btnTung.disabled = khoa || !v.luaChon;
    el.btnTung.textContent = dangXoay ? 'Đang tung…' : 'Tung xu';
    el.btnVay.disabled = dangGui;
    el.btnChoiLai.disabled = dangGui;
    el.btnDangXuat.disabled = dangXoay || dangGui;

    veLichSu(v);

    // Màn hình nợ (S-03)
    el.manChoi.hidden = phu === 'ket-thuc';
    el.manNo.hidden = phu !== 'ket-thuc';
    if (phu === 'ket-thuc') {
      el.cauNo.textContent = '';
      const truoc = document.createTextNode('Bạn nợ số tiền là ');
      const so = document.createElement('span');
      so.className = 'debt-amount';
      so.textContent = dinhDangTien(v.noCu);
      const sau = document.createTextNode(', vui lòng chuyển khoản vào số tài khoản ' + CAU_HINH.SO_TAI_KHOAN + ' để trả nợ. ');
      const ghiChu = document.createElement('span');
      ghiChu.className = 'debt-note';
      ghiChu.textContent = CAU_HINH.GHI_CHU_NO_AO;
      el.cauNo.append(truoc, so, sau, ghiChu);
      el.noLuot.textContent = v.thongKe.soLuot;
      el.noThang.textContent = v.thongKe.soThang;
      el.noThua.textContent = v.thongKe.soThua;
      el.noSoVan.textContent = v.soVanThua;
    }

    // Hộp thoại vay (S-02)
    const moVay = phu === 'cho-vay';
    el.hopVay.hidden = !moVay;
    if (moVay) {
      const tien = dinhDangTien(mucVayKeTiep(v));
      el.vayCau.textContent = 'Vay thêm ' + tien + ' để chơi tiếp?';
      el.vayCon.textContent = 'Còn được vay ' + (CAU_HINH.SO_LAN_VAY_TOI_DA - v.soLanVay) + ' / ' + CAU_HINH.SO_LAN_VAY_TOI_DA + ' lần trong ván này.';
      el.btnVay.textContent = dangGui ? 'Đang vay…' : 'Vay ' + tien;
    }
    goc.inert = moVay; // khoá mọi thứ phía sau hộp thoại

    // Đặt tiêu điểm khi vừa chuyển lớp hiển thị
    if (phu !== trangThaiPhuDangHien) {
      if (phu === 'cho-vay') el.btnVay.focus();
      else if (phu === 'ket-thuc') el.manNo.querySelector('#no-tieu-de').focus();
      else if (trangThaiPhuDangHien !== null && trangThaiPhuDangHien !== 'dang-nhap') (el.btnTung.disabled ? el.btnSap : el.btnTung).focus();
      trangThaiPhuDangHien = phu;
    }

    if (CHE_DO_TEST) CongCuTest.capNhat(v);
  }

  /**
   * Màn hình đăng nhập (S-00).
   * tuyChon: { ban: khoá nút, chu: chữ trên nút, loi: thông báo lỗi, thuLai: nút thành "Thử lại" }
   */
  function hienDangNhap(tuyChon = {}) {
    const tuGame = trangThaiPhuDangHien !== null && trangThaiPhuDangHien !== 'dang-nhap';
    state = tuyChon.giuState ? state : null;
    goc.inert = false;
    el.hopVay.hidden = true;
    el.manChoi.hidden = true;
    el.manNo.hidden = true;
    el.khuNguoiChoi.hidden = true;
    el.manDangNhap.hidden = false;
    nutDangNhapLa = tuyChon.thuLai ? 'thu-lai' : 'dang-nhap';
    el.btnDangNhap.disabled = !!tuyChon.ban;
    el.btnDangNhap.textContent = tuyChon.chu || (tuyChon.thuLai ? 'Thử lại' : 'Đăng nhập bằng Google');
    el.dnLoi.hidden = !tuyChon.loi;
    el.dnLoi.textContent = tuyChon.loi || '';
    if (tuGame) el.dnTieuDe.focus();
    trangThaiPhuDangHien = 'dang-nhap';
  }

  function hienThongBao(noiDung, loai) {
    el.thongBao.textContent = noiDung;
    el.thongBao.className = 'result-msg' + (loai ? ' ' + loai : '');
  }

  // ---------- Hiệu ứng tung xu ----------
  /** Xoay liên tục trong lúc chờ máy chủ. dung() chờ hết vòng đang dở (góc về 0°) rồi dừng. */
  function batDauQuayCho() {
    if (giamChuyenDong.matches || typeof el.coinInner.animate !== 'function') return { dung: () => Promise.resolve() };
    const VONG = 360;
    el.coinBack.textContent = '?';
    const anim = el.coinInner.animate(
      [{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(360deg)' }],
      { duration: VONG, iterations: Infinity });
    return {
      dung: () => new Promise((xong) => {
        const t = anim.currentTime;
        const con = typeof t === 'number' && t > 0 ? VONG - (t % VONG) : 0;
        setTimeout(() => { anim.cancel(); xong(); }, con);
      }),
    };
  }

  function quayXu(ketQua, xong) {
    el.coinBack.textContent = TEN_MAT[ketQua];
    const ketThuc = () => { el.coinFront.textContent = TEN_MAT[ketQua]; xong(); };
    if (giamChuyenDong.matches || typeof el.coinInner.animate !== 'function') {
      if (giamChuyenDong.matches) ketThuc();
      else setTimeout(ketThuc, CAU_HINH.THOI_GIAN_XOAY);
      return;
    }
    // 5,5 vòng → dừng ở mặt sau (mặt kết quả); sau đó gán mặt trước = kết quả và bỏ animation.
    const anim = el.coinInner.animate([
      { transform: 'translateY(0) rotateY(0deg)' },
      { transform: 'translateY(-56px) rotateY(990deg)', offset: 0.5 },
      { transform: 'translateY(0) rotateY(1980deg)' },
    ], { duration: CAU_HINH.THOI_GIAN_XOAY, easing: 'cubic-bezier(.3,.7,.4,1)' });
    anim.onfinish = ketThuc;
  }

  // ---------- Lỗi khi gọi máy chủ ----------
  async function xuLyLoi(e) {
    if (e && e.loai === 'phien') {
      dangXuatChuDong = true;
      if (MayChu) await MayChu.dangXuat();
      dangXuatChuDong = false;
      hienDangNhap({ loi: 'Phiên đăng nhập đã hết, vui lòng đăng nhập lại.' });
      return;
    }
    hienThongBao(e && e.loai === 'mang' ? 'Không kết nối được máy chủ, thử lại.' : 'Có lỗi xảy ra, đã tải lại tiến độ.', 'lose');
    if (state) ve(state);
    if (CHE_DO_CUC_BO) return;
    // Lệnh có thể đã được máy chủ thực hiện dù trình duyệt không nhận được trả lời: lấy lại trạng thái thật.
    try {
      const moi = await nguon.layTienDo();
      if (!state || dangXoay || dangGui) return;
      state = moi;
      ve(state, { hieuUngSo: true });
    } catch (e2) {
      if (e2 && e2.loai === 'phien') xuLyLoi(e2);
    }
  }

  // ---------- Sự kiện ----------
  function chonMat(mat) {
    if (!state || dangXoay || state.trangThai !== 'dang-choi') return;
    state = Object.assign({}, state, { luaChon: mat });
    if (CHE_DO_CUC_BO) luuCucBo(); // trên máy chủ, lựa chọn được lưu cùng lượt tung
    ve(state);
  }

  async function tung() {
    if (!state || dangXoay || dangGui || state.trangThai !== 'dang-choi' || !state.luaChon || state.soDu <= 0) return;
    const truoc = state;
    const dangDungPhim = document.activeElement === el.btnTung; // nút sắp bị khoá → nhớ để trả tiêu điểm
    dangXoay = true;
    hienThongBao('', '');
    ve(truoc);
    const quayCho = batDauQuayCho();

    let kq;
    try {
      kq = await nguon.tungXu(truoc.luaChon); // kết quả được quyết định và lưu TRƯỚC hiệu ứng
    } catch (e) {
      await quayCho.dung();
      dangXoay = false;
      if (state) ve(state);
      xuLyLoi(e);
      return;
    }
    await quayCho.dung();
    if (!state) return; // đã đăng xuất trong lúc chờ
    state = kq.state;
    AmThanh.xoay(giamChuyenDong.matches ? 300 : CAU_HINH.THOI_GIAN_XOAY);

    quayXu(kq.ketQua, () => {
      dangXoay = false;
      if (!state) return;
      const doi = state.trangThai !== 'dang-choi';
      ve(state, { hieuUngSo: true, giuManChoi: doi });
      if (dangDungPhim && !doi && !el.btnTung.disabled) el.btnTung.focus();
      const tienCuoc = dinhDangTien(CAU_HINH.MUC_CUOC);
      if (kq.dung) {
        hienThongBao('Ra ' + TEN_MAT[kq.ketQua] + ' — Bạn đoán đúng! +' + tienCuoc, 'win');
        AmThanh.thang();
      } else {
        hienThongBao('Ra ' + TEN_MAT[kq.ketQua] + ' — Bạn đoán sai! −' + tienCuoc, 'lose');
        AmThanh.thua();
      }
      if (doi) {
        setTimeout(() => {
          if (state !== kq.state) return; // trạng thái đã đổi (ví dụ công cụ test, đăng xuất)
          ve(state);
          if (state.trangThai === 'ket-thuc') AmThanh.ketThuc();
        }, giamChuyenDong.matches ? 300 : 1100);
      }
    });
  }

  /** Gửi lệnh Vay / Chơi lại; khoá nút trong lúc chờ để không gửi hai lần. */
  async function guiLenh(lenh, khiXong) {
    if (!state || dangXoay || dangGui) return;
    dangGui = true;
    ve(state);
    let moi;
    try {
      moi = await lenh();
    } catch (e) {
      dangGui = false;
      if (state) ve(state);
      xuLyLoi(e);
      return;
    }
    dangGui = false;
    if (!state) return;
    state = moi;
    khiXong();
  }

  function batDauVay() {
    if (!state || state.trangThai !== 'cho-vay') return;
    guiLenh(() => nguon.vay(), () => {
      AmThanh.vay();
      ve(state, { hieuUngSo: true });
      hienThongBao('Đã vay thêm ' + dinhDangTien(state.lichSu[0].soTien) + '.', 'info');
    });
  }

  function batDauChoiLai() {
    if (!state || state.trangThai !== 'ket-thuc') return;
    guiLenh(() => nguon.choiLai(), () => {
      hienThongBao('', '');
      ve(state);
    });
  }

  function veNutAmThanh() {
    const bat = AmThanh.dangBat();
    el.btnAmThanh.setAttribute('aria-pressed', String(bat));
    const nhan = bat ? 'Tắt âm thanh' : 'Bật âm thanh';
    el.btnAmThanh.setAttribute('aria-label', nhan);
    el.btnAmThanh.title = nhan;
  }

  // ---------- Đăng nhập / đăng xuất (F-11, F-12) ----------
  async function taiVaVaoGame() {
    hienDangNhap({ ban: true, chu: 'Đang tải…' });
    let s;
    try {
      s = await nguon.layTienDo();
    } catch (e) {
      if (e && e.loai === 'phien') return xuLyLoi(e);
      hienDangNhap({ thuLai: true, loi: 'Không tải được tiến độ. Kiểm tra kết nối mạng rồi thử lại.' });
      return;
    }
    if (!phienHienTai) return; // đã đăng xuất trong lúc tải
    el.tenNguoiChoi.textContent = MayChu.tenHienThi(phienHienTai);
    el.tenNguoiChoi.title = el.tenNguoiChoi.textContent;
    el.khuNguoiChoi.hidden = false;
    vaoGame(s);
  }

  function vaoGame(s) {
    state = s;
    soDuDangHien = state.soDu;
    hienThongBao('', '');
    ve(state);
  }

  async function bamDangNhap() {
    if (nutDangNhapLa === 'thu-lai') return taiVaVaoGame();
    hienDangNhap({ ban: true, chu: 'Đang đăng nhập…' });
    try {
      await MayChu.dangNhap(); // trình duyệt sẽ chuyển sang trang của Google
    } catch (e) {
      hienDangNhap({ loi: 'Không mở được trang đăng nhập Google. Kiểm tra kết nối mạng rồi thử lại.' });
    }
  }

  async function bamDangXuat() {
    if (dangXoay || dangGui) return;
    dangXuatChuDong = true;
    phienHienTai = null;
    await MayChu.dangXuat();
    dangXuatChuDong = false;
    hienThongBao('', '');
    hienDangNhap({});
  }

  el.btnSap.addEventListener('click', () => chonMat('sap'));
  el.btnNgua.addEventListener('click', () => chonMat('ngua'));
  el.btnTung.addEventListener('click', tung);
  el.btnVay.addEventListener('click', batDauVay);
  el.btnChoiLai.addEventListener('click', batDauChoiLai);
  el.btnDangNhap.addEventListener('click', bamDangNhap);
  el.btnDangXuat.addEventListener('click', bamDangXuat);
  el.btnAmThanh.addEventListener('click', () => {
    AmThanh.datBat(!AmThanh.dangBat());
    AmThanh.mo();
    LuuTru.ghi(KHOA_AM_THANH, AmThanh.dangBat() ? 'bat' : 'tat');
    veNutAmThanh();
  });

  // Hộp thoại vay: không đóng bằng Esc, giữ tiêu điểm bên trong.
  el.hopVay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') e.preventDefault();
    if (e.key === 'Tab') { e.preventDefault(); el.btnVay.focus(); }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !el.hopVay.hidden) e.preventDefault();
  });

  // Âm thanh chỉ phát sau lần tương tác đầu tiên (quy định của trình duyệt).
  const moAmThanh = () => { AmThanh.mo(); };
  window.addEventListener('pointerdown', moAmThanh, { once: true, capture: true });
  window.addEventListener('keydown', moAmThanh, { once: true, capture: true });

  /* ======================================================================
   * 6. CÔNG CỤ TEST — chỉ khi mở với ?test=1 ở chế độ cục bộ
   * ==================================================================== */
  const CongCuTest = (function () {
    if (!CHE_DO_TEST) return null;
    let ep = null;
    const panel = document.createElement('details');
    panel.className = 'test-panel';
    panel.open = window.innerWidth >= 700; // màn hình hẹp: thu gọn để không che nút chơi
    panel.innerHTML =
      '<summary>Công cụ test</summary>' +
      '<p class="t-info" id="t-info"></p>' +
      '<div class="t-row">' +
      '<button type="button" class="btn btn-ghost btn-sm" data-ep="sap" aria-pressed="false">Ép SẤP</button>' +
      '<button type="button" class="btn btn-ghost btn-sm" data-ep="ngua" aria-pressed="false">Ép NGỬA</button>' +
      '<button type="button" class="btn btn-ghost btn-sm" data-ep="" aria-pressed="true">Bỏ ép</button>' +
      '</div>' +
      '<label><input type="checkbox" id="t-giu"> Giữ ép cho các lượt sau</label>' +
      '<div class="t-row">' +
      '<button type="button" class="btn btn-ghost btn-sm" data-mau="vay2">Đã vay 2 · số dư 500.000 đ</button>' +
      '<button type="button" class="btn btn-ghost btn-sm" data-mau="vay3">Đã vay 3 · số dư 500.000 đ</button>' +
      '<button type="button" class="btn btn-ghost btn-sm" data-mau="thua1">Đã thua 1 ván</button>' +
      '<button type="button" class="btn btn-ghost btn-sm" data-mau="xoa">Xoá dữ liệu</button>' +
      '</div>';
    document.body.appendChild(panel);
    const info = panel.querySelector('#t-info');
    const giu = panel.querySelector('#t-giu');
    const nutEp = panel.querySelectorAll('[data-ep]');

    function veEp() { nutEp.forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.ep || null) === ep))); }

    nutEp.forEach((b) => b.addEventListener('click', () => { ep = b.dataset.ep || null; veEp(); capNhat(state); }));

    function napMau(loai) {
      if (dangXoay) return;
      const giuLuaChon = state.luaChon;
      let s;
      if (loai === 'xoa') {
        LuuTru.xoa(KHOA_STATE);
        s = taoVanMoi();
      } else if (loai === 'thua1') {
        s = taoVanMoi(NO_MOI_VAN, 1, giuLuaChon);
      } else {
        const lan = loai === 'vay2' ? 2 : 3;
        s = taoVanMoi(state.noCu, state.soVanThua, giuLuaChon);
        s.soLanVay = lan;
        s.noVanNay = NO_SAU_LAN_VAY[lan];
        s.soDu = CAU_HINH.MUC_CUOC;
        s.thongKe = { soLuot: 30, soThang: 10, soThua: 20 };
      }
      state = s;
      if (loai !== 'xoa') luuCucBo();
      soDuDangHien = state.soDu;
      hienThongBao('Đã nạp trạng thái mẫu.', 'info');
      ve(state);
    }
    panel.querySelectorAll('[data-mau]').forEach((b) => b.addEventListener('click', () => napMau(b.dataset.mau)));

    function capNhat(v) {
      if (!v) return;
      const tl = v.trangThai === 'dang-choi' ? Math.round(tiLeThang(v) * 100) + '%' : '—';
      info.textContent = 'Lượt tới: ' + (v.thongKe.soLuot + 1) + ' · tỉ lệ thắng theo bảng: ' + tl +
        ' · ép: ' + (ep ? TEN_MAT[ep] : 'không');
    }

    return {
      layEp() {
        const kq = ep;
        if (ep && !giu.checked) { ep = null; veEp(); }
        return kq;
      },
      capNhat,
    };
  })();

  /* ---------- Khởi động ---------- */
  async function khoiDong() {
    AmThanh.datBat(LuuTru.doc(KHOA_AM_THANH) !== 'tat');
    veNutAmThanh();

    if (CHE_DO_CUC_BO) {
      el.daiCucBo.hidden = false;
      vaoGame(await NguonCucBo.layTienDo());
      return;
    }

    hienDangNhap({ ban: true, chu: 'Đang tải…' });
    try {
      phienHienTai = await MayChu.khoiTao();
    } catch (e) {
      if (e.loai === 'thu-vien') {
        hienDangNhap({ ban: true, loi: 'Không tải được thư viện đăng nhập. Kiểm tra kết nối mạng rồi tải lại trang.' });
      } else if (e.loai === 'dang-nhap') {
        hienDangNhap({ loi: 'Đăng nhập chưa thành công (' + e.message + '). Bạn có thể thử lại.' });
      } else {
        hienDangNhap({ loi: 'Không khởi động được đăng nhập. Thử tải lại trang.' });
      }
      return;
    }

    MayChu.khiDoiPhien((phien, suKien) => {
      if (phien) { phienHienTai = phien; return; } // làm mới phiên, đăng nhập ở tab khác…
      if (suKien !== 'SIGNED_OUT' || dangXuatChuDong || !phienHienTai) return;
      // Phiên hết hạn hoặc bị đăng xuất ở tab khác
      phienHienTai = null;
      dangXoay = false;
      dangGui = false;
      hienDangNhap({ loi: 'Phiên đăng nhập đã hết, vui lòng đăng nhập lại.' });
    });

    if (phienHienTai) taiVaVaoGame();
    else hienDangNhap({});
  }

  khoiDong();
})();
