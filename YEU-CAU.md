# YÊU CẦU — Mini game RichVip (Đoán Sấp / Ngửa)

> Tài liệu mô tả yêu cầu cho mini game chạy trên trình duyệt. **Chưa bao gồm code.**
> Toàn bộ tiền trong game là **tiền ảo**, chỉ dùng để giải trí.

---

## 1. Tổng quan

- **Tên game:** RichVip
- **Thể loại:** Mini game đoán kết quả tung đồng xu.
- **Nền tảng:** Trình duyệt web (desktop và điện thoại), chạy hoàn toàn phía client (HTML/CSS/JS), không cần server.
- **Mục tiêu người chơi:** Đoán đúng kết quả đồng xu (Sấp hoặc Ngửa) để tăng số tiền.

---

## 2. Luật chơi

1. Khi bắt đầu, người chơi có **số dư khởi điểm 1.000.000 đ** (giá trị cấu hình được).
2. Mỗi lượt, người chơi chọn **Sấp** hoặc **Ngửa** rồi bấm **Tung xu**.
3. Đồng xu được tung ngẫu nhiên, xác suất **50% Sấp – 50% Ngửa**, mỗi lượt độc lập với các lượt trước.
4. Mức cược mỗi lượt cố định là **500.000 đ**.
5. Kết quả:
   - **Đoán đúng:** cộng **+500.000 đ** vào số dư.
   - **Đoán sai:** trừ **−500.000 đ** khỏi số dư.
6. **Khi số dư về 0:**
   - Nếu số lần vay **< 3**: hiển thị hộp thoại cho phép **vay thêm 1.000.000 đ** để chơi tiếp.
   - Người chơi bấm **Vay** → số dư thành 1.000.000 đ, số lần vay tăng 1, tổng nợ tăng 1.000.000 đ.
   - Không thể tiếp tục chơi khi số dư bằng 0 mà chưa vay.
7. **Giới hạn vay:** tối đa **3 lần** (tổng nợ tối đa 3.000.000 đ).
8. **Kết thúc game (thua cuộc):** khi đã vay đủ 3 lần và số dư lại về 0 → hiển thị màn hình kết quả với thông báo:

   > **Bạn nợ số tiền là X, vui lòng chuyển khoản vào số tài khoản ACB 99995886 để trả nợ.**

   Trong đó **X** = tổng số tiền đã vay (xem mục 3).
9. Người chơi có thể bấm **Chơi lại** để reset toàn bộ (số dư, số lần vay, nợ, lịch sử) về trạng thái ban đầu.

---

## 3. Cách tính điểm (tiền)

| Đại lượng | Ký hiệu | Giá trị ban đầu | Quy tắc cập nhật |
|---|---|---|---|
| Số dư | `soDu` | 1.000.000 đ | Đúng: `+500.000`; Sai: `−500.000`; Vay: `+1.000.000` |
| Số lần vay | `soLanVay` | 0 | `+1` mỗi lần vay, tối đa 3 |
| Tổng nợ | `tongNo` | 0 đ | `+1.000.000` mỗi lần vay |
| Số lượt đã chơi | `soLuot` | 0 | `+1` mỗi lần tung |
| Số lượt thắng / thua | `soThang`, `soThua` | 0 / 0 | Cập nhật theo kết quả |

**Quy tắc:**
- Mức cược 500.000 đ và mức vay 1.000.000 đ đều là bội số của 500.000 đ, nên số dư luôn chia hết cho 500.000 và **không bao giờ âm** — luôn chạm đúng 0.
- Số dư có thể tăng không giới hạn khi thắng liên tục.
- Tiền thắng **không tự động trừ nợ**; nợ chỉ được tính khi kết thúc game.
- Khi game kết thúc: **X = `tongNo` = 3.000.000 đ** (vì chỉ kết thúc khi đã vay đủ 3 lần).
- Hiển thị tiền theo định dạng Việt Nam, có dấu chấm phân cách hàng nghìn và ký hiệu "đ" (ví dụ: `3.000.000 đ`).

---

## 4. Màn hình

### 4.1. Màn hình Chơi (chính)

- **Tiêu đề / logo:** "RichVip".
- **Bảng thông tin:**
  - Số dư hiện tại.
  - Số lần đã vay: `n / 3`.
  - Tổng nợ hiện tại.
- **Khu vực đồng xu:** hình đồng xu ở giữa màn hình, có **hiệu ứng lật/xoay** khi tung (khoảng 1–2 giây), sau đó dừng ở mặt kết quả (Sấp hoặc Ngửa, phân biệt rõ bằng hình và chữ).
- **Lựa chọn:** 2 nút **Sấp** và **Ngửa**; nút đang chọn được làm nổi bật.
- **Nút "Tung xu":**
  - Bị vô hiệu hoá khi chưa chọn Sấp/Ngửa, khi đồng xu đang tung, hoặc khi số dư = 0.
- **Thông báo kết quả lượt:** ví dụ "Ra NGỬA — Bạn đoán đúng! +500.000 đ" (màu xanh) hoặc "Ra SẤP — Bạn đoán sai! −500.000 đ" (màu đỏ).
- **Lịch sử:** danh sách các lượt gần nhất (ví dụ 10 lượt): lựa chọn, kết quả, đúng/sai, số dư sau lượt.

### 4.2. Hộp thoại Vay tiền

- Hiện tự động khi số dư về 0 và `soLanVay < 3`.
- Nội dung: "Bạn đã hết tiền! Vay thêm 1.000.000 đ để chơi tiếp? (Còn được vay X/3 lần)".
- Nút **Vay 1.000.000 đ** → cộng tiền, đóng hộp thoại, quay lại màn hình chơi.
- Không có cách chơi tiếp nếu không vay (có thể có nút **Chơi lại** để reset).

### 4.3. Màn hình Kết quả (Game Over)

- Hiện khi `soLanVay = 3` và số dư về 0.
- Nội dung chính (nổi bật, cỡ chữ lớn):

  > **Bạn nợ số tiền là 3.000.000 đ, vui lòng chuyển khoản vào số tài khoản ACB 99995886 để trả nợ.**

- Thống kê: tổng số lượt chơi, số lượt thắng, số lượt thua.
- Dòng chú thích nhỏ bên dưới: *"Đây là trò chơi giải trí, tiền trong game là tiền ảo."*
- Nút **Chơi lại**.

### 4.4. Yêu cầu giao diện chung

- Responsive: hiển thị tốt trên màn hình từ 360px (điện thoại) đến desktop, không có thanh cuộn ngang.
- Phong cách "VIP": tông màu vàng / đen sang trọng.
- Ngôn ngữ giao diện: tiếng Việt.

---

## 5. Tiêu chí hoàn thành

Game được coi là hoàn thành khi đáp ứng tất cả các tiêu chí sau:

### Chức năng
- [ ] Mở file `index.html` trên trình duyệt là chơi được, không cần cài đặt hay server.
- [ ] Số dư khởi điểm hiển thị đúng 1.000.000 đ.
- [ ] Người chơi chọn được Sấp hoặc Ngửa; không tung được khi chưa chọn.
- [ ] Kết quả tung là ngẫu nhiên, tỉ lệ xấp xỉ 50/50 (kiểm tra qua ~1.000 lượt, mỗi mặt trong khoảng 45%–55%).
- [ ] Đoán đúng cộng đúng 500.000 đ; đoán sai trừ đúng 500.000 đ.
- [ ] Không bấm tung liên tiếp được trong lúc đồng xu đang xoay.
- [ ] Số dư về 0 → hiện hộp thoại vay; vay thành công cộng 1.000.000 đ và tăng bộ đếm vay.
- [ ] Không vay được quá 3 lần.
- [ ] Sau lần vay thứ 3, khi số dư lại về 0 → hiện màn hình kết quả với đúng câu: "Bạn nợ số tiền là 3.000.000 đ, vui lòng chuyển khoản vào số tài khoản ACB 99995886 để trả nợ."
- [ ] Số dư không bao giờ hiển thị giá trị âm.
- [ ] Nút **Chơi lại** reset toàn bộ trạng thái về ban đầu.

### Giao diện
- [ ] Có hiệu ứng tung xu; mặt Sấp và Ngửa phân biệt rõ ràng.
- [ ] Thông báo đúng/sai có màu sắc phân biệt.
- [ ] Tiền hiển thị đúng định dạng `1.000.000 đ`.
- [ ] Hiển thị tốt trên điện thoại (360px) và desktop.
- [ ] Lịch sử lượt chơi cập nhật sau mỗi lượt.

### Kỹ thuật
- [ ] Không có lỗi trong Console của trình duyệt.
- [ ] Các hằng số (số dư đầu, mức cược, mức vay, số lần vay tối đa, số tài khoản) được khai báo tập trung, dễ thay đổi.

---

## 6. Ngoài phạm vi (chưa làm)

- Đăng nhập, tài khoản người dùng, bảng xếp hạng.
- Lưu tiến trình giữa các lần mở trình duyệt.
- Cho phép chọn mức cược khác 500.000 đ.
- Trả nợ bằng tiền thắng trong game.
- Âm thanh (có thể bổ sung sau).
