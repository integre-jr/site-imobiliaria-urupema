# Instagram: do modo demonstração para a conta real

Decisão de 17/11/2026: usar o **convite de testador** (sem a análise da Meta). É rápido e grátis, e
basta porque o site só publica na conta da própria imobiliária. Reavaliar a análise da Meta perto da
entrega (marco M9), se quiserem que o cliente não precise aceitar o convite.

Sem app da Meta configurado, o site roda em **modo demonstração**: o botão "Conectar" e os posts são
simulados, e a gaveta Instagram e o modal de post mostram a etiqueta "Modo demonstração". **Desde
18/11/2026 o modo real se liga pelo próprio painel** (gaveta Instagram > "Conta real do Instagram"),
sem deploy nem comando no servidor.

## O que a INTEGRE faz (uma vez)

Itens marcados com [CONFERIR] dependem da tela atual do painel da Meta, que muda de nome com frequência.

1. Em <https://developers.facebook.com/apps>, com a conta de desenvolvedor da INTEGRE, crie um app
   (portfólio da INTEGRE) com o caso de uso de **gerenciar conteúdo no Instagram** [CONFERIR o nome].
2. No produto **Instagram > API setup with Instagram login** [CONFERIR]:
   - anote o **Instagram App ID** e o **Instagram App Secret** (não são os do Facebook);
   - em **Business login settings**, cadastre o redirect URI que a gaveta Instagram mostra (botão
     Copiar), hoje `https://urupema-imoveis.pages.dev/api/instagram/callback`. Ele segue o domínio
     por onde o painel é aberto: quando o domínio do cliente entrar (M10), acrescente
     `https://<domínio>/api/instagram/callback` e conecte pelo domínio novo.
   - permissões: `instagram_business_basic` e `instagram_business_content_publish`.
3. Em **App roles > Roles > Add people > Instagram Tester** [CONFERIR], adicione o @ da conta da
   imobiliária. Isso dispara o convite que o cliente aceita.
4. Mantenha o app em **modo de desenvolvimento**. Nesse modo, só contas adicionadas ao app conseguem
   conectar, e é exatamente o que precisamos (acesso padrão, sem análise).
5. Ligue o modo real **pelo painel** (entrando como administrador no site publicado, em https):
   barra de edição > **Instagram** > "Conta real do Instagram" > cole o **ID do app** e a **chave
   secreta** > "Salvar e usar a conta real". A chave fica criptografada no banco (`TOKEN_KEY`) e não
   volta mais para a tela. Salvar derruba a conexão simulada sozinho. Para voltar à demonstração:
   "Voltar ao modo demonstração" na mesma seção.
   - Alternativa sem painel: segredos `IG_APP_ID` / `IG_APP_SECRET` (`wrangler pages secret put`) +
     `INSTAGRAM_MODO = "real"` no `wrangler.toml` + deploy. O que estiver salvo no painel tem prioridade.

## O que o cliente faz (uma vez, guiado pela gaveta Instagram do painel)

1. Deixa a conta **profissional** (Comercial ou Criador de conteúdo). É grátis, pelo app do Instagram.
2. Aceita o convite de testador: <https://www.instagram.com/accounts/manage_access>, aba
   **"Convites de testador"** [CONFERIR o caminho atual], **Aceitar**.
3. No painel: barra de edição > **Instagram** > **Conectar Instagram** > entra com a conta da imobiliária.

Depois disso, o acesso vale 60 dias e é **renovado sozinho** sempre que alguém usa o painel. Se o
painel ficar mais de 60 dias sem uso, a gaveta mostra "A conexão expirou" e basta conectar de novo.

## Como funciona por dentro

- `lib/instagram/index.js`: interface única (spec 9.1). `carregarApp()` decide o modo (app salvo no
  painel → real; senão `INSTAGRAM_MODO` + segredos). `mock.js` e `real.js` implementam `conectarUrl`,
  `trocarCodigo`, `renovar`, `criarPost`, `concluirPost` e `limiteUso`. Legenda: `lib/instagram/legenda.js`.
- **Publicação em duas etapas** (para não estourar o tempo de uma requisição): o navegador gera as
  imagens 1080×1350 (`public/js/admin/postar.js`) → `POST /api/admin/instagram/midias` (D1, 24 h,
  servidas em `/fotos/ig/<id>.jpg`) → `POST /publicar` cria o contêiner na Meta (1 foto ou carrossel
  de até 10) → o navegador chama `POST /concluir` a cada 3 s até a Meta terminar e o post sair.
  Histórico em `instagram_posts` (gaveta Instagram). Repost = post novo do mesmo imóvel.
- Testes do fluxo simulado: `bash scripts/testa-integracoes.sh`.
- O token fica em `integracoes` criptografado com AES-GCM (segredo `TOKEN_KEY`, `lib/cripto.js`).
- `GET /api/admin/instagram/conectar` (só admin) grava um `state` aleatório num cookie de 10 min e
  manda ao login do Instagram. `GET /api/instagram/callback` confere sessão de admin e o `state`,
  troca o código pelo token de 60 dias e volta para `/admin/?instagram=conectado|cancelado|erro`.
- Renovação preguiçosa (sem cron): toda chamada a `/api/admin/instagram/*` renova se faltarem menos
  de 30 dias e o token tiver mais de 24 h.
