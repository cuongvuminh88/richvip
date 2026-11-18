# RichVip

Mini game đoán **Sấp / Ngửa** chạy trên trình duyệt, đăng nhập bằng tài khoản Google. Tiền trong game là tiền ảo, chỉ để giải trí.

- Giao diện: HTML/CSS/JS tĩnh, đặt trên **GitHub Pages** với tên miền riêng — chơi tại **https://richvip.cuonguk.com/**.
- Đăng nhập và dữ liệu: **Supabase** (Auth + Postgres). Luật chơi chạy trong hàm SQL trên máy chủ nên người chơi không sửa được số dư hay nợ.

| Thư mục | Nội dung |
|---|---|
| `app/` | Code game: `index.html`, `style.css`, `game.js`, `may-chu.js` (gọi Supabase), `config.js` (URL + anon key); `test.html` chạy kiểm thử logic |
| `supabase/` | `schema.sql` (bảng, RLS, hàm `rv_*`), `test.sql` và `gia-lap-auth.sql` để kiểm thử |
| `scripts/` | `test-sql.sh`: chạy kiểm thử SQL trên Postgres tạm trong Docker |
| `design/` | Design system: `tokens.css` và trang xem trước `design-system.html` |
| `docs/` | Tài liệu thiết kế (mở `docs/index.html`) |
| `server/` | Server Node.js nhỏ phục vụ game khi chạy bằng Docker |
| `YEU-CAU.md` | Yêu cầu ban đầu |

## Cách chạy bằng Docker

**Cần có:** [Docker Desktop](https://www.docker.com/products/docker-desktop/) (đã gồm Docker Compose) và Docker đang chạy.

1. Mở Terminal tại thư mục gốc của repo (nơi có `compose.yaml`).
2. Build và khởi động:

   ```bash
   docker compose up -d --build
   ```

3. Mở trình duyệt tại **http://localhost:3001**.

Các lệnh thường dùng:

| Việc cần làm | Lệnh |
|---|---|
| Xem trạng thái (cột STATUS hiện `healthy` là ổn) | `docker compose ps` |
| Xem log server | `docker compose logs -f app` |
| Dừng game | `docker compose down` |
| Cập nhật sau khi sửa code trong `app/` hoặc `design/` | `docker compose up -d --build` |

**Ghi chú**

- Compose chỉ có một dịch vụ `app`: server Node.js (image `node:22-alpine`, không cài thư viện ngoài) phục vụ `app/` tại `/` và `design/` tại `/design/`. Chưa có database.
- Server trong container chạy cổng 3000; trên máy mặc định mở ở cổng **3001**. Muốn dùng cổng khác, ví dụ 3000:

  ```bash
  HOST_PORT=3000 docker compose up -d
  ```

- Kiểm tra nhanh server: `http://localhost:3001/healthz` trả về `ok`.
- Tiến độ chơi và nợ được lưu trong trình duyệt (`localStorage`), không lưu trong container. Xoá container không làm mất tiến độ; xoá dữ liệu trang web trong trình duyệt thì mất.
- Trang kiểm thử `app/test.html` không được đưa vào image; mở trực tiếp từ thư mục `app/` khi cần.
- **Repo nằm trên ổ ngoài (exFAT) của macOS?** macOS tự tạo các file `._*` cạnh mỗi file vừa sửa. Nếu build báo lỗi `failed to xattr … ._Dockerfile: operation not permitted`, xoá các file đó rồi build lại:

  ```bash
  find . -name '._*' -not -path './.git/*' -delete
  ```

## Cài đặt đăng nhập (Supabase + Google)

Làm một lần. Bạn cần tự đăng nhập các trang quản trị bên dưới; không ai cần biết mật khẩu của bạn.

> **Giữ bí mật:** *Client secret* của Google và *service_role / secret key* của Supabase **không bao giờ** được dán vào repo. Trong `app/config.js` chỉ có *Project URL* và *anon / publishable key* — hai giá trị này được phép công khai.

### Bước 1 — Tạo dự án Supabase

1. Vào https://supabase.com → đăng nhập (có thể dùng GitHub) → **New project**. Chọn gói Free, vùng gần Việt Nam (ví dụ Singapore), đặt mật khẩu database (lưu vào trình quản lý mật khẩu của bạn).
2. Khi dự án tạo xong: **SQL Editor** → **New query** → dán toàn bộ nội dung `supabase/schema.sql` → **Run**. Thấy `Success` là xong. Chạy lại nhiều lần cũng không mất dữ liệu.
3. **Project Settings → API** (hoặc nút **Connect**): chép **Project URL** (dạng `https://xxxx.supabase.co`) và **anon / publishable key**.
4. Mở **Authentication → Sign In / Providers → Google**, chép dòng **Callback URL (for OAuth)** (dạng `https://xxxx.supabase.co/auth/v1/callback`) để dùng ở bước 2.

### Bước 2 — Tạo OAuth client trên Google (miễn phí, không cần bật thanh toán)

1. Vào https://console.cloud.google.com → tạo project mới, ví dụ `richvip`.
2. **Google Auth Platform** (hoặc *APIs & Services → OAuth consent screen*):
   - **Branding:** tên ứng dụng `RichVip`, email hỗ trợ là email của bạn.
   - **Audience:** chọn **External**. Khi còn ở chế độ *Testing* chỉ những email trong danh sách *Test users* đăng nhập được; muốn ai cũng đăng nhập được thì bấm **Publish app** (game chỉ xin tên và email nên không cần Google duyệt).
3. **Clients → Create client** → loại **Web application**:
   - **Authorized JavaScript origins:** `https://richvip.cuonguk.com` và `http://localhost:3001`
   - **Authorized redirect URIs:** Callback URL đã chép ở bước 1.4
4. Chép **Client ID** và **Client secret**.

### Bước 3 — Bật Google trong Supabase

1. **Authentication → Sign In / Providers → Google** → bật **Enable**, dán Client ID và Client secret → **Save**.
2. **Authentication → URL Configuration:**
   - **Site URL:** `https://richvip.cuonguk.com/app/`
   - **Redirect URLs** (thêm cả hai): `https://richvip.cuonguk.com/**` và `http://localhost:3001/**`

### Bước 4 — Điền cấu hình vào game

Mở `app/config.js`, điền:

```js
window.RICHVIP_CONFIG = {
  supabaseUrl: 'https://xxxx.supabase.co',
  supabaseAnonKey: 'anon-hoặc-publishable-key',
};
```

Để trống `supabaseUrl` thì game chạy **chế độ cục bộ**: không cần đăng nhập, lưu trên trình duyệt, có dải cảnh báo ở đầu trang. Chế độ này chỉ dùng khi phát triển; khung test `?test=1` cũng chỉ hoạt động ở chế độ này.

### Kiểm thử phần máy chủ

Chạy toàn bộ luật chơi, ràng buộc và phân quyền của `schema.sql` trên một Postgres tạm (không đụng tới Supabase thật; cần Docker):

```bash
bash scripts/test-sql.sh
```

Kết quả cuối phải là `TẤT CẢ ĐẠT`.

## Đưa lên GitHub Pages

1. Repo phải **public** (GitHub Pages cho repo private cần gói trả phí).
2. GitHub → repo `richvip` → **Settings → Pages** → *Source*: **Deploy from a branch**, nhánh `main`, thư mục `/ (root)` → **Save**.
3. Sau 1–2 phút, game ở **https://richvip.cuonguk.com/** (tự chuyển sang `app/`). Tài liệu ở **https://richvip.cuonguk.com/docs/**.

### Tên miền riêng (đã cài)

- DNS của `cuonguk.com` do **Wix** quản lý. Bản ghi **CNAME** `richvip` → `cuongvuminh88.github.io`.
- Bản ghi **TXT** `_github-pages-challenge-cuongvuminh88` để xác minh tên miền với GitHub (GitHub → Settings tài khoản → Pages). Không xoá bản ghi này.
- File `CNAME` ở gốc repo chứa `richvip.cuonguk.com` — GitHub Pages cần file này, **không xoá**.
- Settings → Pages của repo: *Custom domain* `richvip.cuonguk.com`, bật **Enforce HTTPS**.
- Địa chỉ cũ `cuongvuminh88.github.io/richvip/` tự chuyển sang tên miền mới.
- Đổi tên miền thì phải sửa cả **Site URL / Redirect URLs** trong Supabase và **Authorized JavaScript origins** trên Google.

Mỗi lần push lên `main`, GitHub Pages tự cập nhật.
