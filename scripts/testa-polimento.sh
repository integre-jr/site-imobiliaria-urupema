#!/usr/bin/env bash
# Testes do marco M8 (polimento): sitemap, robots, 404 e alertas do painel, contra o servidor LOCAL.
# Pré-requisitos: os mesmos de scripts/testa-imoveis.sh (npm run dev; seed; admin admin@teste.com / painel-teste-admin-1).
# Uso: bash scripts/testa-polimento.sh
B=${B:-http://localhost:8788}   # outra porta: B=http://localhost:8790 bash scripts/...
D=$(mktemp -d)
JA="$D/jar-admin.txt"; JC="$D/jar-corretor.txt"
OK=0; FALHA=0
confere() { if [[ "$3" == *"$2"* ]]; then OK=$((OK+1)); echo "  ok    $1"; else FALHA=$((FALHA+1)); echo "  FALHA $1 (esperado '$2', veio '${3:0:300}')"; fi; }
nao_tem() { if [[ "$3" != *"$2"* ]]; then OK=$((OK+1)); echo "  ok    $1"; else FALHA=$((FALHA+1)); echo "  FALHA $1 (não devia ter '$2')"; fi; }
req() {
  local args=(-s -o "$D/corpo.txt" -w "%{http_code}" -X "$1" "$B$2" -H "X-Urupema: 1")
  [[ -n "$3" ]] && args+=(-b "$3" -c "$3")
  [[ -n "$4" ]] && args+=(-H "Content-Type: application/json" -d "$4")
  local st; st=$(curl "${args[@]}"); echo "$st $(cat "$D/corpo.txt")"
}
campo() { sed -n "s/.*\"$1\":\"\{0,1\}\([^\",}]*\).*/\1/p" | head -1; }

echo "Sitemap e robots"
S=$(curl -s $B/sitemap.xml)
confere "sitemap é XML" "application/xml" "$(curl -s -o /dev/null -w '%{content_type}' $B/sitemap.xml)"
confere "sitemap tem a home" "<loc>$B/</loc>" "$S"
confere "sitemap tem a privacidade" "<loc>$B/privacidade</loc>" "$S"
REF=$(curl -s "$B/api/imoveis?limite=1" | campo ref)
confere "sitemap tem imóvel público ($REF)" "<loc>$B/imovel/$REF</loc>" "$S"
nao_tem "sitemap não tem o painel" "/admin" "$S"
R=$(curl -s $B/robots.txt)
confere "robots bloqueia o painel" "Disallow: /admin" "$R"
confere "robots bloqueia a API" "Disallow: /api" "$R"
confere "robots aponta o sitemap" "Sitemap: $B/sitemap.xml" "$R"

echo "404"
for u in /nao-existe /pasta/qualquer /pagina.html /imovel/UR-99999 /imovel/xyz /modelos/imovel; do
  confere "$u dá 404" "404" "$(curl -s -o /dev/null -w '%{http_code}' $B$u)"
done
confere "404 é a página da marca" "Página não encontrada" "$(curl -s $B/nao-existe)"
confere "API inexistente: 404 em JSON" '404 {"erro":' "$(req GET /api/nada)"

req POST /api/auth/login "$JA" '{"email":"admin@teste.com","senha":"painel-teste-admin-1"}' > /dev/null
confere "painel: página inexistente dá 404 da marca" "404 Página não encontrada" "$(curl -s -b "$JA" -o "$D/p.html" -w '%{http_code}' $B/admin/nada) $(grep -o 'Página não encontrada' "$D/p.html" | head -1)"
confere "404 do painel não abre em outro site" "DENY" "$(curl -s -D - -o /dev/null -b "$JA" $B/admin/nada | grep -i x-frame-options)"

echo "Alertas do painel"
confere "resumo sem sessão → 401" "401" "$(req GET /api/admin/resumo)"
A=$(req GET /api/admin/resumo "$JA")
confere "resumo do admin" '"alertas":[' "$A"
confere "admin vê armazenamento" '"armazenamento":{"fotos_bytes":' "$A"
confere "alerta do e-mail de demonstração" '"id":"email"' "$A"
confere "alerta dos anúncios de demonstração" '"id":"demo"' "$A"
confere "alerta do Instagram desconectado" '"id":"ig"' "$A"
CR=$(req POST /api/admin/usuarios "$JA" '{"nome":"Corretor Alertas","email":"corretor-alertas@teste.com","papel":"corretor","senha":"geada-na-serra-alertas-1"}')
IDU=$(echo "$CR" | campo id)
req POST /api/auth/login "$JC" '{"email":"corretor-alertas@teste.com","senha":"geada-na-serra-alertas-1"}' > /dev/null
AC=$(req GET /api/admin/resumo "$JC")
confere "corretor recebe o resumo" '"leads_novos":' "$AC"
nao_tem "corretor não vê alertas de admin" '"id":"ig"' "$AC"
confere "corretor sem armazenamento" '"armazenamento":null' "$AC"
req DELETE /api/admin/usuarios/$IDU "$JA" > /dev/null

rm -rf "$D"
echo "Resultado: $OK ok, $FALHA falha(s)"
[[ $FALHA -eq 0 ]]
