# YÊU CẦU — Mini game RichVip (Đoán Sấp / Ngửa)

> Tài liệu mô tả yêu cầu cho mini game chạy trên trình duyệt. **Chưa bao gồm code.**
> Toàn bộ tiền trong game là **tiền ảo**, chỉ dùng để giải trí.
> Cập nhật 17/11/2026 theo buổi phỏng vấn làm rõ ý tưởng; cập nhật 18/11/2026: thêm đăng nhập Google và lưu tiến độ trên máy chủ (Supabase), thêm trang admin chỉ xem. Tài liệu chi tiết: `docs/index.html`.

---

## 1. Tổng quan

- **Tên game:** RichVip
- **Thể loại:** Mini game đoán kết quả tung đồng xu.
- **Nền tảng:** Trình duyệt web (desktop và điện thoại). Giao diện là HTML/CSS/JS tĩnh, đặt trên **GitHub Pages** (repo public). Đăng nhập và dữ liệu dùng **Supabase** (Auth + Postgres).
- **Tài khoản:** bắt buộc đăng nhập bằng **tài khoản Google** mới chơi được. Mỗi tài khoản có một tiến độ và một khoản nợ riêng, dùng được trên mọi thiết bị.
- **Mục tiêu người chơi:** Đoán đúng kết quả đồng xu (Sấp hoặc Ngửa) để tăng số tiền.

---

## 2. Luật chơi

1. Mỗi ván bắt đầu với **số dư 1.000.000 đ** (giá trị cấu hình được).
2. Mỗi lượt, người chơi chọn **Sấp** hoặc **Ngửa** rồi bấm **Tung xu**.
3. **Độ khó tăng dần (tỉ lệ thắng được điều khiển):** đồng xu *không* công bằng 50/50. Đầu ván người chơi đoán đúng nhiều; càng chơi lâu và càng vay nhiều thì càng hay sai; cuối cùng **luôn thua**. Tỉ lệ thắng mỗi lượt = mức **thấp hơn** trong hai bảng sau (giá trị cấu hình được):

   | Lượt thứ (trong ván) | 1–5 | 6–10 | 11–15 | 16–20 | 21 trở đi |
   |---|---|---|---|---|---|
   | Tỉ lệ thắng | 80% | 60% | 40% | 20% | 0% |

   | Số lần đã vay | 0 | 1 | 2 | 3 |
   |---|---|---|---|---|
   | Tỉ lệ thắng tối đa | (không giới hạn) | 30% | 15% | 0% |

   Thắng → đồng xu ra đúng mặt người chơi chọn; thua → ra mặt còn lại. Giao diện không được ghi là "50/50" hay "ngẫu nhiên công bằng".
4. Mức cược mỗi lượt cố định là **500.000 đ**.
5. Kết quả:
   - **Đoán đúng:** cộng **+500.000 đ** vào số dư.
   - **Đoán sai:** trừ **−500.000 đ** khỏi số dư.
6. **Khi số dư về 0:**
   - Nếu số lần vay **< 3**: hiển thị hộp thoại cho phép **vay** để chơi tiếp. Số tiền vay tăng dần: lần 1 **3.000.000 đ**, lần 2 **5.000.000 đ**, lần 3 **10.000.000 đ**.
   - Người chơi bấm **Vay** → số dư bằng số tiền vay, số lần vay tăng 1, nợ ván này tăng đúng số tiền vay.
   - Không thể tiếp tục chơi khi số dư bằng 0 mà chưa vay.
7. **Giới hạn vay:** tối đa **3 lần mỗi ván** (nợ mỗi ván tối đa 3 + 5 + 10 = **18.000.000 đ**).
8. **Không có nút dừng / chốt kết quả:** ván chỉ kết thúc khi người chơi thua hết.
9. **Kết thúc ván (thua cuộc):** khi đã vay đủ 3 lần và số dư lại về 0 → nợ ván này được cộng vào nợ cũ, rồi hiển thị màn hình kết quả với thông báo:

   > **Bạn nợ số tiền là X, vui lòng chuyển khoản vào số tài khoản ACB 99995886 để trả nợ. (Nợ ảo trong game, không cần chuyển tiền thật.)**

   Trong đó **X** = tổng nợ cộng dồn của tất cả các ván đã thua (xem mục 3).
10. **Chơi lại:** bắt đầu ván mới (số dư 1.000.000 đ, số lần vay 0, xoá lịch sử và thống kê ván), nhưng **nợ cũ được giữ và cộng dồn**. Trong game không có cách xoá nợ.
11. **Lưu tiến độ:** tiến độ và nợ lưu trên máy chủ (Supabase) theo tài khoản. Tải lại trang, mở trình duyệt khác hoặc thiết bị khác rồi đăng nhập cùng tài khoản sẽ quay về đúng trạng thái: đang chơi, đang chờ vay, hay đang ở màn hình nợ. Kết quả tung được **máy chủ** quyết định và lưu **trước** khi trình duyệt chạy hiệu ứng xoay, nên tải lại trang không né được lượt thua.
12. **Âm thanh:** có âm thanh khi tung xu, thắng, thua, vay và kết thúc ván. Mặc định bật, có nút tắt/bật và nhớ lựa chọn (lưu trong trình duyệt).
13. **Đăng nhập:** chưa đăng nhập thì chỉ thấy màn hình đăng nhập với nút **Đăng nhập bằng Google**. Đã đăng nhập thì thanh trên cùng hiện tên người chơi và nút **Đăng xuất**.
14. **Chống gian lận:** luật chơi (tung xu, tỉ lệ thắng, vay, kết thúc ván, chơi lại) chạy trong **hàm SQL trên Supabase**. Trình duyệt chỉ gửi lựa chọn Sấp/Ngửa và các lệnh Vay / Chơi lại; người chơi không tự sửa được số dư, số lần vay hay nợ.

---

## 3. Cách tính điểm (tiền)

| Đại lượng | Ký hiệu | Giá trị ban đầu | Quy tắc cập nhật |
|---|---|---|---|
| Số dư | `soDu` | 1.000.000 đ | Đúng: `+500.000`; Sai: `−500.000`; Vay: `+3.000.000` / `+5.000.000` / `+10.000.000` |
| Số lần vay | `soLanVay` | 0 | `+1` mỗi lần vay, tối đa 3; về 0 khi chơi lại |
| Nợ ván này | `noVanNay` | 0 đ | `+` số tiền vay (3 / 5 / 10 triệu); chuyển sang `noCu` khi kết thúc ván |
| Nợ cũ | `noCu` | 0 đ | `+= noVanNay` khi kết thúc ván; **giữ nguyên** khi chơi lại |
| Số ván đã thua | `soVanThua` | 0 | `+1` khi kết thúc ván; giữ nguyên khi chơi lại |
| Số lượt đã chơi | `soLuot` | 0 | `+1` mỗi lần tung |
| Số lượt thắng / thua | `soThang`, `soThua` | 0 / 0 | Cập nhật theo kết quả |

**Quy tắc:**
- Mức cược 500.000 đ và các mức vay 3, 5, 10 triệu đều là bội số của 500.000 đ, nên số dư luôn chia hết cho 500.000 và **không bao giờ âm** — luôn chạm đúng 0.
- Số dư có thể tăng không giới hạn khi thắng liên tục.
- Tiền thắng **không tự động trừ nợ**.
- Tổng nợ hiển thị khi đang chơi = `noCu + noVanNay`.
- Khi ván kết thúc: **X = `noCu` = `soVanThua` × 18.000.000 đ** (ván thua thứ nhất: 18.000.000 đ; thứ hai: 36.000.000 đ; …).
- Hiển thị tiền theo định dạng Việt Nam, có dấu chấm phân cách hàng nghìn và ký hiệu "đ" (ví dụ: `3.000.000 đ`).

---

## 4. Màn hình

### 4.0. Màn hình Đăng nhập

- Hiện khi chưa đăng nhập (hoặc sau khi đăng xuất).
- Logo chữ "RichVip", một câu giới thiệu ngắn, nút **Đăng nhập bằng Google**.
- Dòng chú thích: *"Đây là trò chơi giải trí, tiền trong game là tiền ảo."*
- Khi đang chuyển sang Google hoặc đang tải tiến độ: nút bị khoá, hiện "Đang đăng nhập…" / "Đang tải…".
- Lỗi đăng nhập hoặc mất kết nối: hiện thông báo lỗi màu đỏ và cho thử lại.

### 4.1. Màn hình Chơi (chính)

- **Tiêu đề / logo:** "RichVip" (dạng chữ).
- **Người chơi:** tên tài khoản Google và nút **Đăng xuất** ở thanh trên cùng.
- **Nút âm thanh:** biểu tượng loa bật/tắt ở góc trên phải.
- **Bảng thông tin:**
  - Số dư hiện tại.
  - Số lần đã vay: `n / 3`.
  - Nợ ván này.
  - Nợ cũ (chỉ hiện khi lớn hơn 0).
- **Khu vực đồng xu:** hình đồng xu ở giữa màn hình, có **hiệu ứng lật/xoay** khi tung (khoảng 1–2 giây), sau đó dừng ở mặt kết quả (Sấp hoặc Ngửa, phân biệt rõ bằng hình và chữ).
- **Lựa chọn:** 2 nút **Sấp** và **Ngửa**; nút đang chọn được làm nổi bật.
- **Nút "Tung xu":**
  - Bị vô hiệu hoá khi chưa chọn Sấp/Ngửa, khi đồng xu đang tung, hoặc khi số dư = 0.
- **Thông báo kết quả lượt:** ví dụ "Ra NGỬA — Bạn đoán đúng! +500.000 đ" (màu xanh) hoặc "Ra SẤP — Bạn đoán sai! −500.000 đ" (màu đỏ).
- **Lịch sử:** danh sách các lượt gần nhất (ví dụ 10 lượt): lựa chọn, kết quả, đúng/sai, số dư sau lượt.

### 4.2. Hộp thoại Vay tiền

- Hiện tự động khi số dư về 0 và `soLanVay < 3`.
- Nội dung: "Bạn đã hết tiền! Vay thêm [số tiền lần vay kế tiếp] để chơi tiếp? (Còn được vay X/3 lần)".
- Nút **Vay [3.000.000 đ / 5.000.000 đ / 10.000.000 đ]** → cộng tiền, đóng hộp thoại, quay lại màn hình chơi.
- Không có cách chơi tiếp nếu không vay. Hộp thoại không đóng được bằng phím Esc hay bấm ra ngoài.

### 4.3. Màn hình Kết quả (Game Over)

- Hiện khi `soLanVay = 3` và số dư về 0. Tải lại trang vẫn ở màn hình này.
- Nội dung chính (nổi bật, cỡ chữ lớn), ví dụ ván thua đầu tiên:

  > **Bạn nợ số tiền là 18.000.000 đ, vui lòng chuyển khoản vào số tài khoản ACB 99995886 để trả nợ. (Nợ ảo trong game, không cần chuyển tiền thật.)**

- Thống kê ván: tổng số lượt chơi, số lượt thắng, số lượt thua; và số ván đã thua.
- Dòng chú thích nhỏ bên dưới: *"Đây là trò chơi giải trí, tiền trong game là tiền ảo."*
- Nút **Chơi lại** (bắt đầu ván mới, nợ cũ được giữ).

### 4.4. Yêu cầu giao diện chung

- Responsive: hiển thị tốt trên màn hình từ 360px (điện thoại) đến desktop, không có thanh cuộn ngang.
- Phong cách "VIP": tông màu vàng / đen sang trọng, dùng đúng `design/tokens.css`.
- Ngôn ngữ giao diện: tiếng Việt.

### 4.5. Trang Admin (chỉ xem)

- Địa chỉ riêng `app/admin.html`, không có liên kết từ game; trang đặt `noindex`.
- Phải đăng nhập Google. Tài khoản không phải admin chỉ thấy "Tài khoản này không có quyền admin." và nút Đăng xuất.
- Admin là tài khoản có trong bảng `rv_quan_tri`. Hiện chỉ chủ game; thêm bằng một câu SQL trong Supabase, trang admin **không** có nút thêm/xoá admin.
- **Thống kê tổng:** số người chơi, số người chơi trong 7 ngày gần nhất, tổng nợ ảo (nợ cũ + nợ ván đang chơi), tổng số ván thua, tổng số lượt tung.
- **Danh sách người chơi:** email đầy đủ, tên, trạng thái (đang chơi / chờ vay / màn hình nợ), số dư, số lần vay, tổng nợ, số ván thua, số lượt, lần chơi gần nhất, lần đăng nhập gần nhất.
- Ô tìm theo email hoặc tên; sắp xếp theo lần chơi gần nhất, tổng nợ, số lượt; nút **Tải lại**.
- **Chỉ xem:** không có nút nào thay đổi dữ liệu người chơi.

---

## 5. Tiêu chí hoàn thành

Game được coi là hoàn thành khi đáp ứng tất cả các tiêu chí sau:

### Chức năng
- [ ] Mở địa chỉ GitHub Pages của game là chơi được sau khi đăng nhập Google; không cần cài đặt.
- [ ] Chưa đăng nhập thì không thấy màn hình chơi; đăng xuất quay về màn hình đăng nhập.
- [ ] Hai tài khoản khác nhau có tiến độ và nợ riêng; một tài khoản đăng nhập trên thiết bị khác thấy đúng tiến độ của mình.
- [ ] Người chơi không đọc hay sửa được dữ liệu của tài khoản khác, và không tự sửa được số dư / nợ của chính mình (chỉ thay đổi qua hàm SQL của game).
- [ ] Số dư khởi điểm hiển thị đúng 1.000.000 đ.
- [ ] Người chơi chọn được Sấp hoặc Ngửa; không tung được khi chưa chọn.
- [ ] Tỉ lệ thắng đúng bảng độ khó: mô phỏng 10.000 lượt ở mỗi mốc, tỉ lệ thắng lệch không quá ±2% so với bảng.
- [ ] Từ lượt 21 trong ván, hoặc sau lần vay thứ 3, người chơi **không bao giờ** thắng.
- [ ] Giao diện không có chữ nào nói kết quả là "50/50" hay "công bằng".
- [ ] Đoán đúng cộng đúng 500.000 đ; đoán sai trừ đúng 500.000 đ.
- [ ] Không bấm tung liên tiếp được trong lúc đồng xu đang xoay.
- [ ] Số dư về 0 → hiện hộp thoại vay; ba lần vay lần lượt cộng 3.000.000 đ, 5.000.000 đ, 10.000.000 đ và tăng bộ đếm vay.
- [ ] Không vay được quá 3 lần.
- [ ] Sau lần vay thứ 3, khi số dư lại về 0 → hiện màn hình kết quả với đúng câu: "Bạn nợ số tiền là 18.000.000 đ, vui lòng chuyển khoản vào số tài khoản ACB 99995886 để trả nợ. (Nợ ảo trong game, không cần chuyển tiền thật.)"
- [ ] Số dư không bao giờ hiển thị giá trị âm.
- [ ] Nút **Chơi lại** bắt đầu ván mới với 1.000.000 đ và 0/3 lần vay, nhưng giữ nợ cũ.
- [ ] Thua ván thứ hai → X = 36.000.000 đ (nợ cộng dồn).
- [ ] Tải lại trang hoặc đăng nhập lại (khi đang chơi, đang chờ vay, hoặc ở màn hình nợ) → quay về đúng trạng thái trước đó.
- [ ] Mất kết nối khi tung xu → báo lỗi, không mất tiền oan; tải lại thấy đúng trạng thái trên máy chủ.
- [ ] Tải lại trang khi xu đang xoay không né được lượt thua.
- [ ] Máy chủ từ chối mọi dữ liệu sai ràng buộc (số dư âm, nợ sai công thức…).
- [ ] Có âm thanh khi tung, thắng, thua; nút tắt âm thanh hoạt động và được nhớ sau khi tải lại.

### Giao diện
- [ ] Có hiệu ứng tung xu; mặt Sấp và Ngửa phân biệt rõ ràng.
- [ ] Thông báo đúng/sai có màu sắc phân biệt.
- [ ] Tiền hiển thị đúng định dạng `1.000.000 đ`.
- [ ] Hiển thị tốt trên điện thoại (360px) và desktop.
- [ ] Lịch sử lượt chơi cập nhật sau mỗi lượt.

### Kỹ thuật
- [ ] Không có lỗi trong Console của trình duyệt.
- [ ] Các hằng số (số dư đầu, mức cược, mức vay, số lần vay tối đa, số tài khoản) được khai báo tập trung, dễ thay đổi.
- [ ] Trang admin chỉ hiện dữ liệu cho tài khoản có trong `rv_quan_tri`; người chơi thường hoặc chưa đăng nhập gọi hàm admin đều bị máy chủ từ chối.
- [ ] Thống kê tổng trên trang admin khớp với dữ liệu trong bảng.
- [ ] Không có khoá bí mật nào (service role key, client secret của Google) nằm trong repo; trong code trình duyệt chỉ có URL và anon key của Supabase.

---

## 6. Ngoài phạm vi (chưa làm)

- Đăng nhập bằng email/mật khẩu hoặc mạng xã hội khác Google; chơi khi chưa đăng nhập.
- Bảng xếp hạng.
- Nút dừng / chốt kết quả giữa ván.
- Cho phép chọn mức cược khác 500.000 đ.
- Trả nợ bằng tiền thắng trong game; xoá nợ từ trong game.
- Xoá tài khoản từ trong game.
- Admin sửa / đặt lại tiến độ, xoá nợ, quản lý danh sách admin từ trang admin.
