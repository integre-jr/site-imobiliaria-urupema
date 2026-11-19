#!/usr/bin/env bash
# Testes do marco M3 (imóveis e anúncios) contra o servidor LOCAL.
# Pré-requisitos: npm run dev rodando; banco local com o seed (npm run db:local) e com um admin
# admin@teste.com / painel-teste-admin-1 (o scripts/testa-auth.sh cria; depois dele, limpe tentativas_login:
#   npx wrangler d1 execute urupema --local --command "DELETE FROM tentativas_login").
# Uso: bash scripts/testa-imoveis.sh   (cria e apaga um anúncio de teste; o seed fica como estava)
B=${B:-http://localhost:8788}   # outra porta: B=http://localhost:8790 bash scripts/...
RAIZ=$(cd "$(dirname "$0")/.." && pwd)
D=$(mktemp -d)
JA="$D/jar-admin.txt"
OK=0; FALHA=0
confere() { if [[ "$3" == *"$2"* ]]; then OK=$((OK+1)); echo "  ok    $1"; else FALHA=$((FALHA+1)); echo "  FALHA $1 (esperado '$2', veio '${3:0:200}')"; fi; }
req() {
  local args=(-s -o "$D/corpo.txt" -w "%{http_code}" -X "$1" "$B$2" -H "X-Urupema: 1")
  [[ -n "$3" ]] && args+=(-b "$3" -c "$3")
  [[ -n "$4" ]] && args+=(-H "Content-Type: application/json" -d "$4")
  local st; st=$(curl "${args[@]}"); echo "$st $(cat "$D/corpo.txt")"
}
# JPEG mínimo: só a assinatura importa para o servidor (o navegador manda fotos de verdade)
jpeg() { printf '\xff\xd8\xff\xe0' > "$1"; head -c "$2" /dev/zero >> "$1"; }

req POST /api/auth/login "$JA" '{"email":"admin@teste.com","senha":"painel-teste-admin-1"}' > /dev/null

echo "Site público"
confere "lista pública só com publicados" '"total":6' "$(curl -s "$B/api/imoveis")"
confere "filtro por tipo" '"total":1' "$(curl -s "$B/api/imoveis?tipo=chacara")"
confere "filtro por bairro" '"total":3' "$(curl -s "$B/api/imoveis?bairro=Centro")"
confere "limite máximo 24" '"itens":[' "$(curl -s "$B/api/imoveis?limite=999")"
confere "página do imóvel com título" '<title>Casa de Campo com Lareira — UR-1024' "$(curl -s $B/imovel/UR-1024)"
confere "Open Graph com a foto" 'property="og:image" content="https://images.unsplash.com/' "$(curl -s $B/imovel/UR-1024)"
confere "JSON-LD do anúncio" '"@type":"RealEstateListing"' "$(curl -s $B/imovel/UR-1024)"
confere "WhatsApp com mensagem do imóvel" 'wa.me/5549991603030?text=Ol%C3%A1!%20Tenho%20interesse%20no%20im%C3%B3vel%20UR-1024' "$(curl -s $B/imovel/UR-1024)"
confere "código curto redireciona igual" 'UR-1024' "$(curl -s $B/imovel/1024 | grep -o '<title>[^<]*')"
confere "página do imóvel sem editor" "0" "$(curl -s $B/imovel/UR-1024 | grep -c 'editor.js')"
confere "dados do site aplicados no imóvel" 'data-cfg="contato.telefone_1">(49) 99160-3030' "$(curl -s $B/imovel/UR-1024)"

echo "Painel: permissões"
confere "lista do painel exige login" "401" "$(req GET /api/admin/imoveis)"
confere "criar exige o header anti-CSRF" "403" "$(curl -s -o /dev/null -w '%{http_code}' -b "$JA" -X POST -H 'Content-Type: application/json' -d '{}' $B/api/admin/imoveis)"

echo "Painel: criar e validar"
confere "sem título dá 400" '"campo":"titulo"' "$(req POST /api/admin/imoveis "$JA" '{"finalidade":"venda","tipo":"casa","titulo":""}')"
confere "tipo inválido dá 400" '"campo":"tipo"' "$(req POST /api/admin/imoveis "$JA" '{"finalidade":"venda","tipo":"castelo","titulo":"Teste"}')"
confere "publicar sem preço dá 400" '"campo":"preco_venda"' "$(req POST /api/admin/imoveis "$JA" '{"finalidade":"venda","tipo":"casa","titulo":"Teste","status":"ativo","bairro":"Centro"}')"
confere "publicar sem bairro dá 400" '"campo":"bairro"' "$(req POST /api/admin/imoveis "$JA" '{"finalidade":"venda","tipo":"casa","titulo":"Teste","status":"ativo","preco_venda":"100.000"}')"
R=$(req POST /api/admin/imoveis "$JA" '{"finalidade":"venda_aluguel","tipo":"cabana","titulo":"Cabana de teste automatizado","preco_venda":"R$ 450.000,00","cep":"88625000","caracteristicas":["lareira","inexistente"]}')
confere "rascunho criado" "201" "$R"
ID=$(grep -o '"id":[0-9]*' <<< "$R" | cut -d: -f2); REF=$(grep -o '"ref":"[^"]*"' <<< "$R" | cut -d'"' -f4)
confere "código no padrão UR-" "UR-1" "$REF"
G=$(req GET /api/admin/imoveis/$ID "$JA")
confere "preço em reais inteiros" '"preco_venda":450000' "$G"
confere "CEP formatado" '"cep":"88625-000"' "$G"
confere "característica desconhecida descartada" '"caracteristicas":["lareira"]' "$G"
confere "padrões: Urupema/SC, mostrar só o bairro" '"cidade":"Urupema"' "$G"
confere "busca pelo código" "$REF" "$(req GET "/api/admin/imoveis/$REF" "$JA")"
confere "rascunho não aparece no site" "404" "$(curl -s -o /dev/null -w '%{http_code}' $B/imovel/$REF)"
confere "rascunho aparece no painel" "200" "$(curl -s -o /dev/null -w '%{http_code}' -b "$JA" $B/admin/imovel/$REF)"
confere "lista do painel inclui o rascunho" "\"ref\":\"$REF\"" "$(req GET '/api/admin/imoveis?status=rascunho' "$JA")"

echo "Painel: fotos"
jpeg "$D/g.jpg" 4000; jpeg "$D/p.jpg" 800; printf 'nao e jpeg nenhum %.0s' {1..20} > "$D/falso.jpg"
# No Git Bash do Windows o curl não lê "/tmp/..." no -F: converte para caminho do Windows.
caminho() { if command -v cygpath > /dev/null; then cygpath -m "$1"; else echo "$1"; fi; }
up() { curl -s -w ' %{http_code}' -b "$JA" -H 'X-Urupema: 1' -F "g=@$(caminho "$1");type=image/jpeg" -F "p=@$(caminho "$2");type=image/jpeg" -F largura=1600 -F altura=1200 $B/api/admin/imoveis/$ID/fotos; }
F1=$(up "$D/g.jpg" "$D/p.jpg"); confere "foto 1 enviada" "201" "$F1"
F2=$(up "$D/g.jpg" "$D/p.jpg"); confere "foto 2 enviada" "201" "$F2"
confere "arquivo que não é JPEG recusado" "400" "$(up "$D/falso.jpg" "$D/p.jpg")"
jpeg "$D/grande.jpg" 1700000; confere "foto grande demais recusada" "400" "$(up "$D/grande.jpg" "$D/p.jpg")"
ID1=$(grep -o '"id":[0-9]*' <<< "$F1" | cut -d: -f2); ID2=$(grep -o '"id":[0-9]*' <<< "$F2" | cut -d: -f2)
U1=$(grep -o '"g":"[^"]*"' <<< "$F1" | cut -d'"' -f4)
confere "foto servida pelo site" "200 image/jpeg" "$(curl -s -o /dev/null -w '%{http_code} %{content_type}' $B$U1)"
confere "foto com cache longo" "immutable" "$(curl -s -D - -o /dev/null $B$U1 | grep -i cache-control)"
confere "chave inventada dá 404" "404" "$(curl -s -o /dev/null -w '%{http_code}' $B/fotos/lead/1/x.jpg)"
confere "reordenar fotos" "\"fotos\":[{\"id\":$ID2" "$(req PUT /api/admin/imoveis/$ID/fotos-ordem "$JA" "{\"ids\":[$ID2,$ID1]}")"
confere "ordem com lista errada dá 409" "409" "$(req PUT /api/admin/imoveis/$ID/fotos-ordem "$JA" "{\"ids\":[$ID2]}")"
confere "excluir foto" "200" "$(req DELETE /api/admin/fotos/$ID2 "$JA")"
confere "foto excluída some do KV" "404" "$(curl -s -o /dev/null -w '%{http_code}' $B${U1/$ID1/x})"

echo "Painel: publicar e editar"
confere "publicar com dados mínimos" '"status":"ativo"' "$(req PUT /api/admin/imoveis/$ID "$JA" '{"status":"ativo","preco_aluguel":"3.200","bairro":"Rio dos Bugres"}')"
confere "publicado aparece no site" "200" "$(curl -s -o /dev/null -w '%{http_code}' $B/imovel/$REF)"
confere "publicado entra na lista pública" "\"ref\":\"$REF\"" "$(curl -s "$B/api/imoveis?bairro=Rio%20dos%20Bugres")"
confere "preço duplo no card (venda e aluguel)" '"preco_aluguel":3200' "$(curl -s "$B/api/imoveis/$REF")"
confere "endereço completo não vaza (padrão: só bairro)" '"endereco":{"bairro":"Rio dos Bugres","cidade":"Urupema","uf":"SC"}' "$(curl -s "$B/api/imoveis/$REF")"
confere "edição parcial mantém o resto" '"titulo":"Cabana de teste automatizado"' "$(req PUT /api/admin/imoveis/$ID "$JA" '{"destaque":true}')"
confere "destaque entra na vitrine" "\"ref\":\"$REF\"" "$(curl -s "$B/api/imoveis?destaque=1&limite=24")"
confere "tirar do site (no_site)" "404" "$(req PUT /api/admin/imoveis/$ID "$JA" '{"no_site":false}' > /dev/null; curl -s -o /dev/null -w '%{http_code}' $B/imovel/$REF)"
confere "não exclui anúncio publicado" "409" "$(req DELETE /api/admin/imoveis/$ID "$JA")"
req PUT /api/admin/imoveis/$ID "$JA" '{"status":"arquivado"}' > /dev/null
confere "exclui arquivado (com as fotos)" "200" "$(req DELETE /api/admin/imoveis/$ID "$JA")"
confere "foto do anúncio excluído some" "404" "$(curl -s -o /dev/null -w '%{http_code}' $B$U1)"
confere "anúncio excluído some do painel" "404" "$(req GET /api/admin/imoveis/$ID "$JA")"

echo "Painel em modo edição"
confere "listagem no painel" "/js/admin/editor.js" "$(curl -s -b "$JA" $B/admin/imoveis)"
confere "imóvel no painel com id para o editor" 'data-imovel-id="' "$(curl -s -b "$JA" $B/admin/imovel/UR-1024)"
confere "links do imóvel continuam no painel" 'href="/admin/imoveis.html"' "$(curl -s -b "$JA" $B/admin/imovel/UR-1024)"
confere "imóvel inexistente no painel dá 404" "404" "$(curl -s -o /dev/null -w '%{http_code}' -b "$JA" $B/admin/imovel/UR-9999)"

echo; echo "Resultado: $OK ok, $FALHA falha(s)"
