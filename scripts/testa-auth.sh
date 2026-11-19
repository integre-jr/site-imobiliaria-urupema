#!/usr/bin/env bash
# Testes de API do M2 (autenticação e usuários) contra o servidor LOCAL.
# Pré-requisito: banco local SEM usuários (o teste começa pelo /admin/setup). Para zerar:
#   npx wrangler d1 execute urupema --local --command "DELETE FROM sessoes; DELETE FROM tentativas_login; DELETE FROM usuarios"
# Depois: npm run dev (outro terminal) e  bash scripts/testa-auth.sh
# No fim, este IP fica bloqueado no login local por 15 min (teste de força bruta); limpar tentativas_login libera.
B=${B:-http://localhost:8788}   # outra porta: B=http://localhost:8790 bash scripts/...
RAIZ=$(cd "$(dirname "$0")/.." && pwd)
D=$(mktemp -d)
JA="$D/jar-admin.txt"; JC="$D/jar-corretor.txt"
rm -f "$JA" "$JC"
OK=0; FALHA=0
confere() { # descrição, esperado, obtido
  if [[ "$3" == *"$2"* ]]; then OK=$((OK+1)); echo "  ok    $1"; else FALHA=$((FALHA+1)); echo "  FALHA $1 (esperado '$2', veio '$3')"; fi
}
req() { # método caminho jar [json] -> "status corpo"
  local args=(-s -o "$D/corpo.txt" -w "%{http_code}" -X "$1" "$B$2" -H "X-Urupema: 1")
  [[ -n "$3" ]] && args+=(-b "$3" -c "$3")
  [[ -n "$4" ]] && args+=(-H "Content-Type: application/json" -d "$4")
  local st; st=$(curl "${args[@]}"); echo "$st $(cat "$D/corpo.txt")"
}

echo "Sem sessão"
confere "/admin/ redireciona ao login" "302 /admin/login?volta=%2Fadmin%2F" "$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' $B/admin/ | sed "s#$B##")"
confere "/admin/usuarios.html redireciona" "302" "$(curl -s -o /dev/null -w '%{http_code}' $B/admin/usuarios.html)"
confere "login.html abre" "200" "$(curl -sL -o /dev/null -w '%{http_code}' $B/admin/login.html)"
confere "API admin dá 401 JSON" '401 {"erro":' "$(req GET /api/admin/usuarios)"
confere "rota de API inexistente dá 404 JSON" '404 {"erro":' "$(req GET /api/nada/aqui)"
confere "setup disponível" '"disponivel":true' "$(req GET /api/auth/setup)"
confere "setup abre" "200" "$(curl -sL -o /dev/null -w '%{http_code}' $B/admin/setup.html)"

echo "Primeiro acesso"
confere "POST sem X-Urupema dá 403" "403" "$(curl -s -o /dev/null -w '%{http_code}' -X POST $B/api/auth/setup -d '{}')"
confere "token errado dá 403" '403 {"erro":"Código de configuração inválido.","campo":"token"}' "$(req POST /api/auth/setup '' '{"token":"x","nome":"Tomaz","email":"admin@teste.com","senha":"senha-admin-1"}')"
confere "senha curta dá 400" '"campo":"senha"' "$(req POST /api/auth/setup '' '{"token":"dev-setup","nome":"Tomaz","email":"admin@teste.com","senha":"curta"}')"
confere "setup cria admin" "201" "$(req POST /api/auth/setup "$JA" '{"token":"dev-setup","nome":"Tomaz Teste","email":"Admin@Teste.com","senha":"senha-admin-1"}')"
confere "cookie é __Host, HttpOnly e Secure" "#HttpOnly_localhost" "$(grep __Host-urupema_sessao "$JA")"
confere "setup some depois (página)" "404" "$(curl -sL -o /dev/null -w '%{http_code}' $B/admin/setup)"
confere "setup some depois (API)" "404" "$(req POST /api/auth/setup '' '{"token":"dev-setup","nome":"X","email":"x@x.com","senha":"12345678"}')"
confere "me devolve o admin (e-mail minúsculo)" '"email":"admin@teste.com","papel":"admin"' "$(req GET /api/auth/me "$JA")"
confere "painel abre logado" "200" "$(curl -sL -o /dev/null -w '%{http_code}' -b "$JA" $B/admin/)"
confere "painel sem cache" "no-store" "$(curl -sL -D - -o /dev/null -b "$JA" $B/admin/ | grep -i cache-control)"
confere "login logado vai ao painel" "302" "$(curl -s -o /dev/null -w '%{http_code}' -b "$JA" $B/admin/login)"

echo "Usuários"
confere "admin cria corretor" "201" "$(req POST /api/admin/usuarios "$JA" '{"nome":"Ana Corretora","email":"ana@teste.com","papel":"corretor","senha":"senha-ana-1"}')"
confere "e-mail repetido dá 409" '409 {"erro":"Já existe um usuário com este e-mail.","campo":"email"}' "$(req POST /api/admin/usuarios "$JA" '{"nome":"Outra","email":"ANA@teste.com","papel":"corretor","senha":"senha-ana-1"}')"
confere "papel inválido dá 400" '"campo":"papel"' "$(req POST /api/admin/usuarios "$JA" '{"nome":"X","email":"x@teste.com","papel":"dono","senha":"12345678"}')"
confere "lista tem 2" '"email":"ana@teste.com"' "$(req GET /api/admin/usuarios "$JA")"
ID_ADMIN=$(req GET /api/auth/me "$JA" | grep -o '"id":[0-9]*' | cut -d: -f2)
ID_ANA=$(req GET /api/admin/usuarios "$JA" | grep -o '"id":[0-9]*,"nome":"Ana' | cut -d: -f2 | cut -d, -f1)
confere "admin não rebaixa a si mesmo" "409" "$(req PUT /api/admin/usuarios/$ID_ADMIN "$JA" '{"papel":"corretor"}')"
confere "admin não se desativa" "409" "$(req PUT /api/admin/usuarios/$ID_ADMIN "$JA" '{"ativo":false}')"
confere "admin não se exclui" "409" "$(req DELETE /api/admin/usuarios/$ID_ADMIN "$JA")"

echo "Corretor"
confere "corretor entra" "200" "$(req POST /api/auth/login "$JC" '{"email":"ana@teste.com","senha":"senha-ana-1","manter":true}')"
confere "manter conectado = cookie de 30 dias" "__Host-urupema_sessao" "$(awk '$5 > 0' "$JC")"
confere "corretor não lista usuários (API)" "403" "$(req GET /api/admin/usuarios "$JC")"
confere "corretor não cria usuário (API)" "403" "$(req POST /api/admin/usuarios "$JC" '{"nome":"X","email":"y@teste.com","papel":"admin","senha":"12345678"}')"
confere "corretor não edita ninguém (API)" "403" "$(req PUT /api/admin/usuarios/$ID_ANA "$JC" '{"papel":"admin"}')"
confere "corretor abre o site em modo edição" "200" "$(curl -sL -o /dev/null -w '%{http_code}' -b "$JC" $B/admin/)"
confere "corretor abre outra página do site" "200" "$(curl -sL -o /dev/null -w '%{http_code}' -b "$JC" $B/admin/sobre)"
confere "página que não é do site dá 404" "404" "$(curl -s -o /dev/null -w '%{http_code}' -b "$JC" $B/admin/usuarios)"
confere "corretor não lê os dados do site" "403" "$(req GET /api/admin/config "$JC")"
confere "corretor não edita os dados do site" "403" "$(req PUT /api/admin/config "$JC" '{"valores":{"home.stat_1_n":"+99"}}')"

echo "Troca de senha"
cp "$JC" "$D/jar-corretor-2.txt"
req POST /api/auth/login "$D/jar-corretor-2.txt" '{"email":"ana@teste.com","senha":"senha-ana-1"}' > /dev/null
confere "senha atual errada dá 400" '"campo":"atual"' "$(req POST /api/auth/senha "$JC" '{"atual":"errada","nova":"senha-ana-2"}')"
confere "nova senha curta dá 400" '"campo":"nova"' "$(req POST /api/auth/senha "$JC" '{"atual":"senha-ana-1","nova":"123"}')"
confere "troca a senha" "200" "$(req POST /api/auth/senha "$JC" '{"atual":"senha-ana-1","nova":"senha-ana-2"}')"
confere "sessão atual continua" "200" "$(req GET /api/auth/me "$JC")"
confere "outro aparelho foi desconectado" "401" "$(req GET /api/auth/me "$D/jar-corretor-2.txt")"
confere "senha antiga não entra" "401" "$(req POST /api/auth/login '' '{"email":"ana@teste.com","senha":"senha-ana-1"}')"

echo "Admin gerencia o corretor"
confere "admin redefine senha da Ana" "200" "$(req PUT /api/admin/usuarios/$ID_ANA "$JA" '{"senha":"senha-ana-3"}')"
confere "sessões da Ana caem" "401" "$(req GET /api/auth/me "$JC")"
confere "Ana entra com a senha redefinida" "200" "$(req POST /api/auth/login "$JC" '{"email":"ana@teste.com","senha":"senha-ana-3"}')"
confere "admin desativa a Ana" "200" "$(req PUT /api/admin/usuarios/$ID_ANA "$JA" '{"ativo":false}')"
confere "Ana desativada perde a sessão" "401" "$(req GET /api/auth/me "$JC")"
confere "Ana desativada não entra" "401" "$(req POST /api/auth/login '' '{"email":"ana@teste.com","senha":"senha-ana-3"}')"
confere "admin promove e reativa" "200" "$(req PUT /api/admin/usuarios/$ID_ANA "$JA" '{"ativo":true,"papel":"admin"}')"
confere "Ana agora admin lista usuários" "200" "$(req POST /api/auth/login "$JC" '{"email":"ana@teste.com","senha":"senha-ana-3"}' >/dev/null; req GET /api/admin/usuarios "$JC")"
confere "admin exclui a Ana" "200" "$(req DELETE /api/admin/usuarios/$ID_ANA "$JA")"
confere "excluir de novo dá 404" "404" "$(req DELETE /api/admin/usuarios/$ID_ANA "$JA")"

echo "Modo edição (o painel é o próprio site em /admin)"
curl -s -b "$JA" $B/admin/contato > "$D/adm.html"
confere "página do painel traz o editor" "/js/admin/editor.js" "$(cat "$D/adm.html")"
confere "links do site continuam no painel" 'href="/admin/sobre"' "$(cat "$D/adm.html")"
confere "assets viram absolutos" 'href="/css/styles.css"' "$(cat "$D/adm.html")"
confere "página do painel sem cache" "no-store" "$(curl -s -D - -o /dev/null -b "$JA" $B/admin/contato | grep -i cache-control)"
confere "site público NÃO traz o editor" "0" "$(curl -s $B/contato | grep -c 'editor.js\|data-admin')"

echo "Dados do site"
confere "admin lê os dados" '"contato.telefone_1":"(49) 99160-3030"' "$(req GET /api/admin/config "$JA")"
confere "chave desconhecida dá 400" '"campo":"x.y"' "$(req PUT /api/admin/config "$JA" '{"valores":{"x.y":"1"}}')"
confere "telefone sem DDD dá 400" '"campo":"contato.telefone_1"' "$(req PUT /api/admin/config "$JA" '{"valores":{"contato.telefone_1":"9916-3030"}}')"
confere "link inválido dá 400" '"campo":"redes.instagram"' "$(req PUT /api/admin/config "$JA" '{"valores":{"redes.instagram":"não é link"}}')"
confere "valor vazio dá 400" '"campo":"home.stat_1_l"' "$(req PUT /api/admin/config "$JA" '{"valores":{"home.stat_1_l":"  "}}')"
confere "nada é gravado se um campo falha" '"contato.telefone_2":"(49) 99107-5332"' "$(req PUT /api/admin/config "$JA" '{"valores":{"contato.telefone_2":"(49) 98888-7777","contato.email":"ruim"}}' >/dev/null; req GET /api/admin/config "$JA")"
R=$(req PUT /api/admin/config "$JA" '{"valores":{"contato.telefone_1":"(49) 98888-1111","contato.whatsapp":"(49) 98888-1111","redes.instagram":"instagram.com/urupema_teste","home.stat_1_n":"+16"}}')
confere "admin salva vários campos" "200" "$R"
confere "WhatsApp vira só números com 55" '"contato.whatsapp":"5549988881111"' "$R"
confere "link ganha https://" '"redes.instagram":"https://instagram.com/urupema_teste"' "$R"
confere "devolve os links prontos" '"contato.telefone_1":"tel:+5549988881111"' "$R"
P=$(curl -s $B/contato)
confere "site público mostra o telefone novo" '>(49) 98888-1111</a>' "$P"
confere "site público usa o link novo" 'href="tel:+5549988881111"' "$P"
confere "todos os botões de WhatsApp mudam" "4" "$(grep -o 'https://wa.me/5549988881111' <<< "$P" | wc -l | tr -d ' ')"
confere "Instagram novo no site" 'href="https://instagram.com/urupema_teste"' "$P"
confere "número da home novo" '>+16</div>' "$(curl -s $B/)"
confere "site público sem ETag (não fica preso no cache)" "0" "$(curl -s -D - -o /dev/null $B/contato | grep -ci '^etag')"
confere "painel mostra o mesmo dado" '>(49) 98888-1111</a>' "$(curl -s -b "$JA" $B/admin/contato)"
req PUT /api/admin/config "$JA" '{"valores":{"contato.telefone_1":"(49) 99160-3030","contato.whatsapp":"5549991603030","redes.instagram":"https://instagram.com","home.stat_1_n":"+15"}}' > /dev/null
confere "valores originais restaurados" '"redes.instagram":"https://instagram.com"' "$(req GET /api/admin/config "$JA")"

echo "Instagram (modo demonstração)"
JK="$D/jar-caio.txt"
req POST /api/admin/usuarios "$JA" '{"nome":"Caio Corretor","email":"caio@teste.com","papel":"corretor","senha":"senha-caio-1"}' > /dev/null
req POST /api/auth/login "$JK" '{"email":"caio@teste.com","senha":"senha-caio-1"}' > /dev/null
confere "status começa desconectado" '"modo":"mock","app_configurado":true,"conectado":false' "$(req GET /api/admin/instagram/status "$JA")"
confere "corretor vê o status sem poder gerenciar" '"pode_gerenciar":false' "$(req GET /api/admin/instagram/status "$JK")"
confere "corretor não conecta" "403" "$(req GET /api/admin/instagram/conectar "$JK")"
confere "sem sessão não conecta" "401" "$(req GET /api/admin/instagram/conectar)"
LOC=$(curl -s -o /dev/null -w '%{redirect_url}' -b "$JA" -c "$JA" $B/api/admin/instagram/conectar)
confere "conectar leva ao callback com state" "$B/api/instagram/callback?code=mock&state=" "$LOC"
confere "state guardado em cookie __Host" "__Host-urupema_ig_state" "$(cat "$JA")"
confere "callback sem sessão de admin falha" "?instagram=erro" "$(curl -s -o /dev/null -w '%{redirect_url}' "$LOC")"
confere "callback com state trocado falha" "?instagram=erro" "$(curl -s -o /dev/null -w '%{redirect_url}' -b "$JA" "${LOC%state=*}state=falso")"
LOC=$(curl -s -o /dev/null -w '%{redirect_url}' -b "$JA" -c "$JA" $B/api/admin/instagram/conectar)
confere "callback certo conecta" "$B/admin/?instagram=conectado" "$(curl -s -o /dev/null -w '%{redirect_url}' -b "$JA" -c "$JA" "$LOC")"
confere "o state não vale de novo" "?instagram=erro" "$(curl -s -o /dev/null -w '%{redirect_url}' -b "$JA" "$LOC")"
ST=$(req GET /api/admin/instagram/status "$JA")
confere "status conectado como @urupema_demo" '"conectado":true,"expirado":false,"conta":"@urupema_demo"' "$ST"
confere "cancelar no Instagram volta avisando" "?instagram=cancelado" "$(curl -s -o /dev/null -w '%{redirect_url}' -b "$JA" "$B/api/instagram/callback?error=access_denied")"
CRIPTO=$(cd "$RAIZ" && npx wrangler d1 execute urupema --local --json --command "SELECT dados_cripto FROM integracoes WHERE nome='instagram'" 2>/dev/null)
confere "token guardado criptografado (sem 'mock_' legível)" "0" "$(grep -c 'mock_' <<< "$CRIPTO")"
confere "corretor não desconecta" "403" "$(req POST /api/admin/instagram/desconectar "$JK")"
confere "legenda: hashtags podem ficar vazias" "200" "$(req PUT /api/admin/config "$JA" '{"valores":{"instagram.hashtags":""}}')"
confere "legenda: modelo vazio dá 400" '"campo":"instagram.modelo_legenda"' "$(req PUT /api/admin/config "$JA" '{"valores":{"instagram.modelo_legenda":" "}}')"
req PUT /api/admin/config "$JA" '{"valores":{"instagram.hashtags":"#urupema #serracatarinense #imoveis #imoveisserragaucha #casanaserra #imobiliaria"}}' > /dev/null
confere "admin desconecta" "200" "$(req POST /api/admin/instagram/desconectar "$JA")"
confere "status volta a desconectado" '"conectado":false' "$(req GET /api/admin/instagram/status "$JA")"

echo "Logout"
cp "$JA" "$D/jar-admin-2.txt"
confere "logout" "200" "$(req POST /api/auth/logout "$JA")"
confere "depois do logout, 401" "401" "$(req GET /api/auth/me "$JA")"
confere "o cookie antigo também não vale mais" "401" "$(req GET /api/auth/me "$D/jar-admin-2.txt")"

echo "Força bruta (por último: bloqueia este IP por 15 min)"
for i in 1 2 3 4 5; do req POST /api/auth/login '' '{"email":"admin@teste.com","senha":"errada"}' > /dev/null; done
confere "6ª tentativa dá 429" "429" "$(req POST /api/auth/login '' '{"email":"admin@teste.com","senha":"senha-admin-1"}')"

echo "Site público igual ao HTML (com os dados originais; o contato só muda o endereço do mapa)"
cd "$RAIZ/public"
for f in index.html sobre.html financie.html negocie.html; do
  curl -sL -o "$D/pagina.html" "$B/$f"; cmp -s "$D/pagina.html" "$f" && confere "$f idêntico" "s" "s" || confere "$f idêntico" "igual" "diferente"
done
# O <iframe> do mapa ocupa 4 linhas no arquivo e 1 na página servida: 5 linhas diferentes, nada além disso.
confere "contato.html só difere no mapa" "5" "$(curl -sL $B/contato.html | diff - contato.html | grep -c '^[<>]')"

echo; echo "Resultado: $OK ok, $FALHA falha(s)"
