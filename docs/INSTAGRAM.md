# Instagram: do modo demonstração para a conta real

Decisão de 17/11/2026: usar o **convite de testador** (sem a análise da Meta). É rápido e grátis, e
basta porque o site só publica na conta da própria imobiliária. Reavaliar a análise da Meta perto da
entrega (marco M9), se quiserem que o cliente não precise aceitar o convite.

Hoje o site roda com `INSTAGRAM_MODO = "mock"` (`wrangler.toml`): o botão "Conectar" e os posts são
simulados, e a gaveta Instagram mostra a etiqueta "Modo demonstração".

## O que a INTEGRE faz (uma vez)

Itens marcados com [CONFERIR] dependem da tela atual do painel da Meta, que muda de nome com frequência.

1. Em <https://developers.facebook.com/apps>, com a conta de desenvolvedor da INTEGRE, crie um app
   (portfólio da INTEGRE) com o caso de uso de **gerenciar conteúdo no Instagram** [CONFERIR o nome].
2. No produto **Instagram > API setup with Instagram login** [CONFERIR]:
   - anote o **Instagram App ID** e o **Instagram App Secret** (não são os do Facebook);
   - em **Business login settings**, cadastre o redirect URI exatamente assim:
     `https://urupema-imoveis.pages.dev/api/instagram/callback`.
     Quando o domínio do cliente entrar (M10), acrescente `https://<domínio>/api/instagram/callback`
     e troque o `SITE_URL` no `wrangler.toml`.
   - permissões: `instagram_business_basic` e `instagram_business_content_publish`.
3. Em **App roles > Roles > Add people > Instagram Tester** [CONFERIR], adicione o @ da conta da
   imobiliária. Isso dispara o convite que o cliente aceita.
4. Mantenha o app em **modo de desenvolvimento**. Nesse modo, só contas adicionadas ao app conseguem
   conectar, e é exatamente o que precisamos (acesso padrão, sem análise).
5. Guarde os segredos e ligue o modo real:
   ```bash
   npx wrangler whoami                                   # conta "Urupema Negócios Imobiliários"
   npx wrangler pages secret put IG_APP_ID --project-name urupema-imoveis
   npx wrangler pages secret put IG_APP_SECRET --project-name urupema-imoveis
   ```
   No `wrangler.toml`, troque `INSTAGRAM_MODO = "mock"` por `"real"` e rode `npm run deploy`.
   Antes, apague a conexão simulada para o painel não mostrar a conta `@urupema_demo`: "Desconectar"
   na gaveta Instagram.

## O que o cliente faz (uma vez, guiado pela gaveta Instagram do painel)

1. Deixa a conta **profissional** (Comercial ou Criador de conteúdo). É grátis, pelo app do Instagram.
2. Aceita o convite de testador: <https://www.instagram.com/accounts/manage_access>, aba
   **"Convites de testador"** [CONFERIR o caminho atual], **Aceitar**.
3. No painel: barra de edição > **Instagram** > **Conectar Instagram** > entra com a conta da imobiliária.

Depois disso, o acesso vale 60 dias e é **renovado sozinho** sempre que alguém usa o painel. Se o
painel ficar mais de 60 dias sem uso, a gaveta mostra "A conexão expirou" e basta conectar de novo.

## Como funciona por dentro

- `lib/instagram/index.js`: interface única (spec 9.1). `mock.js` e `real.js` implementam
  `conectarUrl`, `trocarCodigo` e `renovar`. `publicar` e `limiteUso` chegam no marco M6.
- O token fica em `integracoes` criptografado com AES-GCM (segredo `TOKEN_KEY`, `lib/cripto.js`).
- `GET /api/admin/instagram/conectar` (só admin) grava um `state` aleatório num cookie de 10 min e
  manda ao login do Instagram. `GET /api/instagram/callback` confere sessão de admin e o `state`,
  troca o código pelo token de 60 dias e volta para `/admin/?instagram=conectado|cancelado|erro`.
- Renovação preguiçosa (sem cron): toda chamada a `/api/admin/instagram/*` renova se faltarem menos
  de 30 dias e o token tiver mais de 24 h.
