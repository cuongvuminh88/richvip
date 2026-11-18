#!/usr/bin/env bash
# Kiểm thử supabase/schema.sql trên một container Postgres tạm (không đụng tới Supabase thật).
#   bash scripts/test-sql.sh
# Cần: Docker đang chạy. Container tạm tự xoá khi xong.
set -euo pipefail

cd "$(dirname "$0")/.."
TEN="richvip-test-sql-$$"
ANH_PG="postgres:17-alpine"
ANH_NODE="node:22-alpine"

# Hằng số luật chơi trong app/game.js, để so với rv_cau_hinh() trên máy chủ.
DOC_CAU_HINH='global.window={};global.document={getElementById:()=>null};
eval(require("fs").readFileSync(process.argv[1],"utf8"));
const c=window.RichVipLogic.CAU_HINH;
const k=["SO_DU_DAU","MUC_CUOC","CAC_MUC_VAY","SO_LAN_VAY_TOI_DA","SO_DONG_LICH_SU","TI_LE_THEO_LUOT","TI_LE_THEO_VAY"];
console.log(JSON.stringify(Object.fromEntries(k.map(x=>[x,c[x]]))));'
if command -v node >/dev/null 2>&1; then
  CAU_HINH_JS=$(node -e "$DOC_CAU_HINH" app/game.js)
else
  CAU_HINH_JS=$(docker run --rm -i "$ANH_NODE" node -e "$DOC_CAU_HINH" /dev/stdin < app/game.js)
fi
echo "Hằng số từ app/game.js: $CAU_HINH_JS"

docker run -d --rm --name "$TEN" -e POSTGRES_PASSWORD=test "$ANH_PG" >/dev/null
trap 'docker rm -f "$TEN" >/dev/null 2>&1 || true' EXIT

printf 'Đang chờ Postgres'
for _ in $(seq 1 60); do
  if docker exec "$TEN" pg_isready -U postgres -q 2>/dev/null; then break; fi
  printf '.'; sleep 1
done
echo

psql() { docker exec -i -e PGOPTIONS="${PGOPTIONS:--c client_min_messages=warning}" "$TEN" psql -U postgres -X -q -v ON_ERROR_STOP=1 "$@"; }

echo "--- Nạp giả lập auth của Supabase"
psql < supabase/gia-lap-auth.sql
echo "--- Nạp schema.sql (2 lần, kiểm tra chạy lại được)"
psql < supabase/schema.sql
psql < supabase/schema.sql
echo "--- Chạy test.sql"
PGOPTIONS="-c client_min_messages=notice" psql -v cau_hinh_js="$CAU_HINH_JS" < supabase/test.sql 2>&1 | sed -e 's/^\(psql:[^ ]* \)\{0,1\}NOTICE:  //'
echo "--- Chạy lại schema.sql khi đã có dữ liệu"
psql < supabase/schema.sql
CON=$(psql -tA -c "select no_cu from public.rv_tien_do where user_id = '00000000-0000-0000-0000-00000000000a'")
if [ "$CON" = "54000000" ]; then
  echo "ĐẠT  Chạy lại schema.sql không làm mất tiến độ (nợ cũ vẫn 54.000.000 đ)"
else
  echo "TRƯỢT: sau khi chạy lại schema.sql, nợ cũ = '$CON'"; exit 1
fi
