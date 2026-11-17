// RichVip — server tĩnh nhỏ, chỉ dùng thư viện có sẵn của Node.js.
//   /            → app/      (game)
//   /design/...  → design/   (tokens.css mà app/index.html nạp qua ../design/tokens.css)
//   /healthz     → "ok"      (cho healthcheck của Docker)
'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const GOC = path.resolve(__dirname, '..');

const THU_MUC = [
  { tienTo: '/design/', duongDan: path.join(GOC, 'design') },
  { tienTo: '/', duongDan: path.join(GOC, 'app') },
];

const KIEU_FILE = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

function traLoi(res, ma, noiDung, kieu = 'text/plain; charset=utf-8') {
  res.writeHead(ma, { 'Content-Type': kieu, 'Content-Length': Buffer.byteLength(noiDung) });
  res.end(noiDung);
}

/** Đổi đường dẫn URL thành đường dẫn file; trả về null nếu không hợp lệ hoặc nằm ngoài thư mục được phép. */
function timFile(urlPath) {
  let p;
  try { p = decodeURIComponent(urlPath); } catch { return null; }
  if (p.includes('\0')) return null;
  const muc = THU_MUC.find((m) => p === m.tienTo.slice(0, -1) || p.startsWith(m.tienTo));
  if (!muc) return null;
  const tuongDoi = p.slice(muc.tienTo.length - 1) || '/'; // giữ dấu "/" đầu
  const file = path.resolve(muc.duongDan, '.' + path.posix.normalize(tuongDoi));
  if (file !== muc.duongDan && !file.startsWith(muc.duongDan + path.sep)) return null;
  // Không phục vụ file ẩn (ví dụ ._* của macOS, .DS_Store).
  if (path.relative(muc.duongDan, file).split(path.sep).some((phan) => phan.startsWith('.'))) return null;
  return file;
}

const server = http.createServer((req, res) => {
  const batDau = Date.now();
  res.on('finish', () => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.url} ${res.statusCode} ${Date.now() - batDau}ms`);
  });

  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return traLoi(res, 405, 'Method Not Allowed');
  }

  const { pathname } = new URL(req.url, 'http://localhost');
  if (pathname === '/healthz') return traLoi(res, 200, 'ok');

  let file = timFile(pathname);
  if (!file) return traLoi(res, 404, 'Không tìm thấy');

  fs.stat(file, (loi, tt) => {
    if (!loi && tt.isDirectory()) {
      // /design → /design/ để đường dẫn tương đối trong trang đúng
      if (!pathname.endsWith('/')) {
        res.writeHead(301, { Location: pathname + '/' });
        return res.end();
      }
      file = path.join(file, 'index.html');
      return fs.stat(file, (loi2, tt2) => guiFile(loi2, tt2));
    }
    guiFile(loi, tt);
  });

  function guiFile(loi, tt) {
    if (loi || !tt.isFile()) return traLoi(res, 404, 'Không tìm thấy');
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, {
      'Content-Type': KIEU_FILE[ext] || 'application/octet-stream',
      'Content-Length': tt.size,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=300',
      'Last-Modified': tt.mtime.toUTCString(),
    });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file)
      .on('error', () => res.destroy())
      .pipe(res);
  }
});

server.listen(PORT, HOST, () => {
  // Trong Docker, cổng trên máy do compose.yaml quyết định (mặc định 3001), không phải PORT này.
  console.log(`RichVip server đang lắng nghe ${HOST}:${PORT}`);
});

// Docker gửi SIGTERM khi dừng container: đóng server gọn gàng.
for (const tinHieu of ['SIGTERM', 'SIGINT']) {
  process.on(tinHieu, () => {
    console.log(`Nhận ${tinHieu}, đang dừng server…`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  });
}
