// public/modelos/ guarda modelos de página preenchidos pelo servidor (ex.: a página do imóvel).
// Eles não devem ser abertos direto; o servidor os lê com env.ASSETS.fetch, que não passa por aqui.
export const onRequest = () => new Response('Não encontrado.', { status: 404 });
