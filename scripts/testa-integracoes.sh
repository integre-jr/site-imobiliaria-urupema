#!/usr/bin/env bash
# Testes dos marcos M5 (portais/feed VRSync) e M6 (Instagram em modo demonstração) contra o servidor LOCAL.
# Pré-requisitos: os mesmos de scripts/testa-imoveis.sh (npm run dev; seed; admin admin@teste.com / senha-admin-1).
# Cria um anúncio de teste, publica no Instagram simulado e apaga tudo no fim.
# Uso: bash scripts/testa-integracoes.sh
B=http://localhost:8788
D=$(mktemp -d)
JA="$D/jar-admin.txt"
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
# No Git Bash do Windows o curl não lê "/tmp/..." no -F: converte para caminho do Windows.
caminho() { if command -v cygpath > /dev/null; then cygpath -m "$1"; else echo "$1"; fi; }
jpeg() { printf '\xff\xd8\xff\xe0' > "$1"; head -c "$2" /dev/zero >> "$1"; }

req POST /api/auth/login "$JA" '{"email":"admin@teste.com","senha":"senha-admin-1"}' > /dev/null
curl -s -o /dev/null -b "$JA" -X DELETE -H "X-Urupema: 1" $B/api/admin/instagram/app   # começa no modo demonstração

echo "Portais: feed"
P=$(req GET /api/admin/portais "$JA")
confere "gaveta Portais (admin)" '"url":"http://localhost:8788/feeds/grupo-olx-' "$P"
URL=$(echo "$P" | campo url)
confere "feed abre com XML VRSync" '<ListingDataFeed xmlns="http://www.vivareal.com/schemas/1.0/VRSync"' "$(curl -s "$URL")"
confere "feed é XML" "application/xml" "$(curl -s -o /dev/null -w '%{content_type}' "$URL")"
nao_tem "anúncios de demonstração ficam fora do feed" "UR-1024" "$(curl -s "$URL")"
confere "token errado dá 404" "404" "$(curl -s -o /dev/null -w '%{http_code}' $B/feeds/grupo-olx-errado123.xml)"
confere "corretor não vê Portais sem ser admin (sem sessão = 401)" "401" "$(req GET /api/admin/portais)"

echo "Portais: anúncio completo"
NOVO='{"finalidade":"venda","tipo":"casa","status":"ativo","titulo":"Casa de teste das integrações","descricao":"Casa criada pelo teste automático das integrações com portais e Instagram. Pode apagar.","preco_venda":"450.000","iptu_anual":"1.200","bairro":"Centro","cep":"88625-000","logradouro":"Rua de Teste","numero":"10","area_util":"120","quartos":3,"banheiros":2,"vagas":1,"caracteristicas":["lareira","vista_montanha"],"tipo_publicacao_olx":"PREMIUM"}'
R=$(req POST /api/admin/imoveis "$JA" "$NOVO")
confere "cria anúncio" "201" "$R"
ID=$(echo "$R" | campo id); REF=$(echo "$R" | campo ref)
confere "pendência: faltam fotos" 'Pelo menos 5 fotos (hoje tem 0)' "$(req GET /api/admin/imoveis/$ID "$JA")"
nao_tem "sem fotos ainda não vai no feed" "$REF" "$(curl -s "$URL")"
for n in 1 2 3 4 5; do
  jpeg "$D/g.jpg" 2000; jpeg "$D/p.jpg" 500
  curl -s -o /dev/null -b "$JA" -H "X-Urupema: 1" -F "g=@$(caminho "$D")/g.jpg;type=image/jpeg" -F "p=@$(caminho "$D")/p.jpg;type=image/jpeg" -F largura=1600 -F altura=1200 "$B/api/admin/imoveis/$ID/fotos"
done
confere "com 5 fotos, sem pendências" '"pendencias_portais":[]' "$(req GET /api/admin/imoveis/$ID "$JA")"
F=$(curl -s "$URL")
confere "anúncio entra no feed" "<ListingID>$REF</ListingID>" "$F"
confere "tipo de publicação" "<PublicationType>PREMIUM</PublicationType>" "$F"
confere "preço de venda" '<ListPrice currency="BRL">450000</ListPrice>' "$F"
confere "IPTU no formato novo" '<Iptu currency="BRL" period="Yearly">1200</Iptu>' "$F"
confere "característica traduzida" "<Feature>Mountain View</Feature>" "$F"
confere "foto principal com URL absoluta" 'primary="true">http://localhost:8788/fotos/imovel/' "$F"
confere "CEP só com números" "<PostalCode>88625000</PostalCode>" "$F"
confere "estado por extenso" '<State abbreviation="SC">Santa Catarina</State>' "$F"
confere "mostra só o bairro" 'displayAddress="Neighborhood"' "$F"
confere "leitura do portal registrada" '"acessos":[{' "$(req GET /api/admin/portais "$JA")"
U2=$(req POST /api/admin/portais "$JA" '{"acao":"novo_endereco"}' | campo url)
confere "endereço antigo para de funcionar" "404" "$(curl -s -o /dev/null -w '%{http_code}' "$URL")"
confere "endereço novo funciona" "<ListingID>$REF</ListingID>" "$(curl -s "$U2")"

echo "Instagram (modo demonstração)"
curl -s -o /dev/null -b "$JA" -X POST -H "X-Urupema: 1" $B/api/admin/instagram/desconectar
confere "publicar sem conta conectada" "409" "$(req POST /api/admin/instagram/publicar "$JA" "{\"imovel_id\":$ID,\"legenda\":\"x\",\"midias\":[]}")"
curl -s -o /dev/null -L -b "$JA" -c "$JA" "$B/api/admin/instagram/conectar"
S=$(req GET /api/admin/instagram/status "$JA")
confere "conecta (simulado)" '"conectado":true' "$S"
confere "mostra o limite de posts" '"limite":{"usados":' "$S"
PV=$(req GET "/api/admin/instagram/previa?imovel=$ID" "$JA")
confere "legenda gerada pelo modelo" "Cód. $REF" "$PV"
confere "legenda com preço" 'Venda: R$ 450.000' "$PV"
jpeg "$D/ig1.jpg" 3000; jpeg "$D/ig2.jpg" 4000
M=$(curl -s -b "$JA" -H "X-Urupema: 1" -F "f=@$(caminho "$D")/ig1.jpg;type=image/jpeg" -F "f=@$(caminho "$D")/ig2.jpg;type=image/jpeg" $B/api/admin/instagram/midias)
confere "envia as imagens do post" '"ids":["' "$M"
M1=$(echo "$M" | sed 's/.*"ids":\["\([^"]*\)","\([^"]*\)".*/\1/'); M2=$(echo "$M" | sed 's/.*"ids":\["\([^"]*\)","\([^"]*\)".*/\2/')
confere "imagem pública para a Meta baixar" "200 image/jpeg 3004" "$(curl -s -o /dev/null -w '%{http_code} %{content_type} %{size_download}' $B/fotos/ig/$M1.jpg)"
P1=$(req POST /api/admin/instagram/publicar "$JA" "{\"imovel_id\":$ID,\"legenda\":\"Teste $REF #urupema\",\"midias\":[\"$M1\",\"$M2\"]}")
confere "1ª etapa: post criado" '"status":"publicando"' "$P1"
PID=$(echo "$P1" | campo post_id)
confere "2ª etapa: publicado" '"status":"publicado","permalink":"http://localhost:8788/imovel/'"$REF" "$(req POST /api/admin/instagram/concluir "$JA" "{\"post_id\":$PID}")"
confere "aparece no histórico como novo" '"tipo":"novo","status":"publicado"' "$(req GET "/api/admin/instagram/posts?imovel=$ID" "$JA")"
P2=$(req POST /api/admin/instagram/publicar "$JA" "{\"imovel_id\":$ID,\"legenda\":\"Repost $REF\",\"midias\":[\"$M1\"]}")
req POST /api/admin/instagram/concluir "$JA" "{\"post_id\":$(echo "$P2" | campo post_id)}" > /dev/null
confere "segundo post vira repost" '"tipo":"repost","status":"publicado"' "$(req GET "/api/admin/instagram/posts?imovel=$ID" "$JA")"
confere "mais de 30 hashtags é recusado" "400" "$(req POST /api/admin/instagram/publicar "$JA" "{\"imovel_id\":$ID,\"legenda\":\"$(printf '#a%d ' $(seq 1 31))\",\"midias\":[\"$M1\"]}")"

echo "Instagram: app da Meta pelo painel"
confere "ID do app inválido" '"campo":"app_id"' "$(req PUT /api/admin/instagram/app "$JA" '{"app_id":"abc","app_secret":"x"}')"
confere "salva o app (liga o modo real)" '200 {"ok":true}' "$(req PUT /api/admin/instagram/app "$JA" '{"app_id":"1234567890123456","app_secret":"0123456789abcdef0123456789abcdef"}')"
S=$(req GET /api/admin/instagram/status "$JA")
confere "modo real" '"modo":"real","app_configurado":true,"app_origem":"painel","app_id":"1234567890123456"' "$S"
confere "conexão simulada não vale no modo real" '"conectado":false' "$S"
nao_tem "chave secreta nunca volta ao navegador" "0123456789abcdef0123456789abcdef" "$S"
L=$(curl -s -o /dev/null -w '%{redirect_url}' -b "$JA" "$B/api/admin/instagram/conectar")
confere "Conectar leva ao login do Instagram" "https://www.instagram.com/oauth/authorize?client_id=1234567890123456&redirect_uri=http%3A%2F%2Flocalhost%3A8788%2Fapi%2Finstagram%2Fcallback" "$L"
confere "volta ao modo demonstração" '200 {"ok":true}' "$(req DELETE /api/admin/instagram/app "$JA")"
confere "modo demonstração de novo" '"modo":"mock"' "$(req GET /api/admin/instagram/status "$JA")"

echo "Limpeza"
req PUT /api/admin/imoveis/$ID "$JA" '{"status":"arquivado"}' > /dev/null
confere "apaga o anúncio de teste" '200 {"ok":true}' "$(req DELETE /api/admin/imoveis/$ID "$JA")"
rm -rf "$D"
echo "Resultado: $OK ok, $FALHA falha(s)"
[[ $FALHA -eq 0 ]]
