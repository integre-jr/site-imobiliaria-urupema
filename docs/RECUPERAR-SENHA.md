# Recuperar o acesso ao painel

O plano grátis não manda e-mail de "esqueci a senha" (isso depende do domínio estar na Cloudflare).

## Um corretor ou outro usuário esqueceu a senha

O administrador entra no painel, abre **Usuários** e usa **Redefinir senha** na pessoa. Depois,
passa a senha nova para ela, que pode trocá-la em **Minha conta**.

## O próprio administrador esqueceu a senha

Precisa de um computador com este projeto, Node.js e acesso à conta Cloudflare da Urupema.

1. Confira se o terminal está na conta certa:
   ```bash
   npx wrangler whoami        # deve mostrar "Urupema Negócios Imobiliários"
   ```
2. Gere o comando com a senha nova (pelo menos 12 caracteres, sem o nome da imobiliária, sequências ou o seu nome):
   ```bash
   node scripts/hash-senha.mjs dono@exemplo.com.br "NovaSenhaForte123"
   ```
3. Rode o comando `npx wrangler d1 execute urupema --remote --file "..."` que o script imprimir.
   A última tabela do resultado deve mostrar o usuário. Se vier vazia, o e-mail está errado.
4. Entre no painel com a senha nova e apague o arquivo `.sql` indicado.

O script também reativa o usuário, encerra as sessões abertas dele e zera o bloqueio por excesso de
tentativas.

## Ninguém consegue entrar e não há nenhum usuário

Com o banco sem usuários, a página `/admin/setup` volta a funcionar. Ela pede o código de
configuração (segredo `SETUP_TOKEN` do projeto na Cloudflare). Para trocar esse código:
`npx wrangler pages secret put SETUP_TOKEN --project-name urupema-imoveis`.
