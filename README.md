# RichVip

Mini game đoán **Sấp / Ngửa** chạy trên trình duyệt. Tiền trong game là tiền ảo, chỉ để giải trí.

| Thư mục | Nội dung |
|---|---|
| `app/` | Code game: `index.html`, `style.css`, `game.js`; `test.html` chạy kiểm thử logic |
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
