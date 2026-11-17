# RichVip — image chạy server tĩnh Node.js phục vụ game.
FROM node:22-alpine

ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0

WORKDIR /srv/richvip

# Server không có thư viện ngoài nên không cần npm install.
COPY server/ ./server/
COPY app/ ./app/
COPY design/ ./design/

# File copy từ máy có thể chỉ cho chủ sở hữu đọc (ví dụ ổ ngoài macOS: rwx------).
# Cho mọi user đọc nhưng không ghi, để user "node" đọc được mà không sửa được code.
RUN chmod -R a+rX,go-w /srv/richvip

# Chạy bằng user thường (có sẵn trong image node), không dùng root.
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/healthz || exit 1

CMD ["node", "server/server.js"]
