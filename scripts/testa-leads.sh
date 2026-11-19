#!/usr/bin/env bash
# Testes do marco M4 (leads e LGPD) contra o servidor LOCAL.
# Pré-requisitos: os mesmos de scripts/testa-imoveis.sh (npm run dev; seed; admin admin@teste.com / senha-admin-1).
# Cria leads de teste (inclusive o 11º da mesma hora, para conferir o limite por IP), um corretor
# temporário, e apaga tudo no fim. Leads que já existiam no banco local ficam como estavam.
# Uso: bash scripts/testa-leads.sh
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
caminho() { if command -v cygpath > /dev/null; then cygpath -m "$1"; else echo "$1"; fi; }
jpeg() { printf '\xff\xd8\xff\xe0' > "$1"; head -c "$2" /dev/zero >> "$1"; }
lead() { req POST /api/leads "" "$1"; }
MARCA="Teste-M4-$$"

req POST /api/auth/login "$JA" '{"email":"admin@teste.com","senha":"senha-admin-1"}' > /dev/null
# Começa sem leads de teste antigos deste IP na última hora (o limite é 10 por hora).
ANTES=$(req GET "/api/admin/leads?busca=Teste-M4" "$JA")

echo "Site público"
confere "privacidade.html abre" "200" "$(curl -s -o /dev/null -w '%{http_code}' $B/privacidade)"
confere "privacidade fala da retenção de 2 anos" "2 anos" "$(curl -s $B/privacidade)"
confere "rodapé linka a política" 'href="privacidade.html">Política de privacidade' "$(curl -s $B/)"
C=$(curl -s $B/contato)
confere "contato envia lead" 'data-lead="contato"' "$C"
confere "contato tem name nos campos" 'name="telefone"' "$C"
confere "contato pede consentimento" 'name="consentimento" required' "$C"
nao_tem "nenhum formulário de mentira sobrou" "data-mock" "$C$(curl -s $B/negocie)$(curl -s $B/financie)"
confere "página do imóvel tem 'Tenho interesse'" 'data-lead="interesse_imovel"' "$(curl -s $B/imovel/UR-1024)"

echo "Proteções do envio"
confere "sem X-Urupema → 403" "403" "$(curl -s -o /dev/null -w '%{http_code}' -X POST $B/api/leads -H 'Content-Type: application/json' -d '{}')"
confere "rápido demais (robô) → 400" "400" "$(lead '{"origem":"contato","nome":"X","telefone":"(49) 99999-0000","consentimento":true,"t":500}')"
confere "campo-isca preenchido → finge ok" '200 {"ok":true}' "$(lead "{\"origem\":\"contato\",\"nome\":\"$MARCA robo\",\"telefone\":\"(49) 99999-0000\",\"consentimento\":true,\"t\":9000,\"website\":\"http://spam\"}")"
confere "sem consentimento → 400" '"campo":"consentimento"' "$(lead '{"origem":"contato","nome":"X","telefone":"(49) 99999-0000","t":9000}')"
confere "sem telefone nem e-mail → 400" '"campo":"telefone"' "$(lead '{"origem":"contato","nome":"X","consentimento":true,"t":9000}')"
confere "sem nome → 400" '"campo":"nome"' "$(lead '{"origem":"contato","telefone":"(49) 99999-0000","consentimento":true,"t":9000}')"
confere "e-mail inválido → 400" '"campo":"email"' "$(lead '{"origem":"contato","nome":"X","email":"nada","consentimento":true,"t":9000}')"
confere "origem desconhecida → 400" "400" "$(lead '{"origem":"hack","nome":"X","telefone":"(49) 99999-0000","consentimento":true,"t":9000}')"
confere "mensagem longa demais → 400" '"campo":"mensagem"' "$(lead "{\"origem\":\"contato\",\"nome\":\"X\",\"telefone\":\"(49) 99999-0000\",\"consentimento\":true,\"t\":9000,\"mensagem\":\"$(head -c 3100 /dev/zero | tr '\0' a)\"}")"
confere "interesse sem imóvel → 400" "400" "$(lead '{"origem":"interesse_imovel","nome":"X","telefone":"(49) 99999-0000","consentimento":true,"t":9000}')"

echo "Os 4 formulários chegam"
confere "contato" "201" "$(lead "{\"origem\":\"contato\",\"nome\":\"$MARCA Contato\",\"email\":\"c@teste.com\",\"telefone\":\"(49) 98888-1111\",\"assunto\":\"Quero comprar um imóvel\",\"mensagem\":\"Olá, quero uma casa.\",\"consentimento\":true,\"t\":9000,\"inventado\":\"ignorar\"}")"
confere "financie" "201" "$(lead "{\"origem\":\"financie\",\"nome\":\"$MARCA Financie\",\"cpf\":\"000.000.000-00\",\"nascimento\":\"1990-01-01\",\"renda\":\"R$ 8.000\",\"valor\":\"R$ 400.000\",\"email\":\"f@teste.com\",\"telefone\":\"(49) 98888-2222\",\"cidade\":\"Urupema\",\"consentimento\":true,\"t\":9000}")"
confere "tenho interesse (código curto vira UR-)" "201" "$(lead "{\"origem\":\"interesse_imovel\",\"imovel_ref\":\"1024\",\"nome\":\"$MARCA Interesse\",\"telefone\":\"(49) 98888-3333\",\"consentimento\":true,\"t\":9000}")"
F1="$D/f1.jpg"; F2="$D/f2.jpg"; jpeg "$F1" 2000; jpeg "$F2" 3000; printf 'GIF89a' > "$D/x.gif"
NEG=(-s -o "$D/corpo.txt" -w "%{http_code}" -X POST $B/api/leads -H "X-Urupema: 1"
  --form-string origem=negocie --form-string "nome=$MARCA Negocie" --form-string "telefone=(49) 98888-4444" --form-string negocio=Vender
  --form-string tipo=Casa --form-string "valor=R\$ 350.000" --form-string bairro=Centro --form-string area=120 --form-string quartos=3
  --form-string "descricao=Casa com lareira" --form-string consentimento=true --form-string t=9000)   # -F "x=(..." abriria um sub-multipart
confere "negocie com 2 fotos" "201" "$(curl "${NEG[@]}" -F "fotos=@$(caminho "$F1");type=image/jpeg" -F "fotos=@$(caminho "$F2");type=image/jpeg")"
confere "negocie recusa foto que não é JPG" '"campo":"fotos"' "$(curl "${NEG[@]}" -F "fotos=@$(caminho "$D/x.gif");type=image/jpeg"; cat "$D/corpo.txt")"
confere "negocie recusa 6 fotos" '"campo":"fotos"' "$(curl "${NEG[@]}" $(for i in 1 2 3 4 5 6; do echo -F "fotos=@$(caminho "$F1");type=image/jpeg"; done); cat "$D/corpo.txt")"

echo "Painel"
confere "lista sem sessão → 401" "401" "$(req GET /api/admin/leads)"
L=$(req GET "/api/admin/leads?busca=$MARCA" "$JA")
confere "lista mostra os 4 leads de teste" '"total":4' "$L"
nao_tem "campo-isca não gravou" "$MARCA robo" "$L"
confere "contador de novos" '"novos":' "$L"
confere "filtro por formulário" '"total":1' "$(req GET "/api/admin/leads?busca=$MARCA&origem=negocie" "$JA")"
confere "interesse guardou UR-1024" '"imovel_ref":"UR-1024"' "$(req GET "/api/admin/leads?busca=$MARCA&origem=interesse_imovel" "$JA")"
IDN=$(req GET "/api/admin/leads?busca=$MARCA&origem=negocie" "$JA" | campo id)
IDC=$(req GET "/api/admin/leads?busca=$MARCA&origem=contato" "$JA" | campo id)
DET=$(req GET /api/admin/leads/$IDN "$JA")
confere "detalhe traz os campos do Negocie" '"rotulo":"Objetivo","valor":"Vender"' "$DET"
confere "detalhe traz as 2 fotos" "/api/admin/leads/$IDN/fotos/" "$DET"
nao_tem "campo inventado foi ignorado" "inventado" "$(req GET /api/admin/leads/$IDC "$JA")"
FOTO=$(echo "$DET" | sed -n 's/.*"url":"\(\/api\/admin\/leads\/[0-9]*\/fotos\/[0-9]*\)".*/\1/p' | head -1)
confere "foto do lead abre com sessão" "200 image/jpeg" "$(curl -s -o /dev/null -w '%{http_code} %{content_type}' -b "$JA" $B$FOTO)"
confere "foto do lead NÃO abre sem sessão" "401" "$(curl -s -o /dev/null -w '%{http_code}' $B$FOTO)"
confere "nem pelo caminho público /fotos/lead" "404" "$(curl -s -o /dev/null -w '%{http_code}' $B/fotos/lead/$IDN/1.jpg)"
confere "muda situação e notas" '"status":"em_atendimento"' "$(req PUT /api/admin/leads/$IDC "$JA" '{"status":"em_atendimento","notas":"Liguei, retorna amanha"}')"
confere "notas gravadas" '"notas":"Liguei, retorna amanha"' "$(req GET /api/admin/leads/$IDC "$JA")"
confere "situação inválida → 400" "400" "$(req PUT /api/admin/leads/$IDC "$JA" '{"status":"xyz"}')"
confere "sem X-Urupema não altera" "403" "$(curl -s -o /dev/null -w '%{http_code}' -b "$JA" -X PUT $B/api/admin/leads/$IDC -H 'Content-Type: application/json' -d '{"status":"concluido"}')"

echo "CSV"
lead "{\"origem\":\"contato\",\"nome\":\"=HYPERLINK(1) $MARCA\",\"telefone\":\"(49) 98888-5555\",\"consentimento\":true,\"t\":9000}" > /dev/null
curl -s -D "$D/h.txt" -o "$D/leads.csv" -b "$JA" $B/api/admin/leads/exportar
confere "CSV com tipo certo" "text/csv" "$(cat "$D/h.txt")"
confere "CSV baixa como arquivo" "attachment; filename=\"leads-urupema-" "$(cat "$D/h.txt")"
confere "CSV com BOM (acentos no Excel)" "efbbbf" "$(head -c 3 "$D/leads.csv" | od -An -tx1 | tr -d ' \n')"
confere "CSV separado por ponto e vírgula" '"Data";"Origem";"Situação"' "$(cat "$D/leads.csv")"
confere "CSV traz o lead" "$MARCA Contato" "$(cat "$D/leads.csv")"
confere "CSV neutraliza fórmula" "\"'=HYPERLINK(1)" "$(cat "$D/leads.csv")"
confere "CSV sem sessão → 401" "401" "$(curl -s -o /dev/null -w '%{http_code}' $B/api/admin/leads/exportar)"

echo "Papéis"
CR=$(req POST /api/admin/usuarios "$JA" '{"nome":"Corretor Leads","email":"corretor-leads@teste.com","papel":"corretor","senha":"senha-corretor-leads-1"}')
IDU=$(echo "$CR" | campo id)
req POST /api/auth/login "$JC" '{"email":"corretor-leads@teste.com","senha":"senha-corretor-leads-1"}' > /dev/null
confere "corretor vê os leads" '"total":' "$(req GET "/api/admin/leads?busca=$MARCA" "$JC")"
confere "corretor atualiza lead" "200" "$(req PUT /api/admin/leads/$IDC "$JC" '{"status":"concluido"}')"
confere "corretor NÃO exclui lead" "403" "$(req DELETE /api/admin/leads/$IDC "$JC")"

echo "Limite por IP (10 por hora)"
N=$(req GET "/api/admin/leads?busca=$MARCA" "$JA" | campo total)
for i in $(seq $((N + 1)) 10); do lead "{\"origem\":\"contato\",\"nome\":\"$MARCA extra $i\",\"telefone\":\"(49) 98888-0000\",\"consentimento\":true,\"t\":9000}" > /dev/null; done
confere "11º envio na mesma hora → 429" "429" "$(lead "{\"origem\":\"contato\",\"nome\":\"$MARCA demais\",\"telefone\":\"(49) 98888-0000\",\"consentimento\":true,\"t\":9000}")"

echo "Limpeza (exclusão a pedido do titular)"
for id in $(req GET "/api/admin/leads?busca=$MARCA" "$JA" | grep -o '"id":[0-9]*' | cut -d: -f2); do
  st=$(req DELETE /api/admin/leads/$id "$JA"); [[ "$st" == 200* ]] || echo "  (falhou excluir $id: $st)"
done
confere "leads de teste apagados" '"total":0' "$(req GET "/api/admin/leads?busca=$MARCA" "$JA")"
confere "foto apagada junto" "404" "$(curl -s -o /dev/null -w '%{http_code}' -b "$JA" $B$FOTO)"
confere "lead apagado dá 404" "404" "$(req GET /api/admin/leads/$IDC "$JA")"
req DELETE /api/admin/usuarios/$IDU "$JA" > /dev/null
rm -rf "$D"
echo "Resultado: $OK ok, $FALHA falha(s)"
[[ $FALHA -eq 0 ]]
