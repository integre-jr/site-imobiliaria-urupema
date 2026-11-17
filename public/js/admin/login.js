import { enviar } from './api.js';

// Só volta para páginas do próprio admin (evita redirecionar para outro site).
function destino() {
  const volta = new URLSearchParams(location.search).get('volta') || '';
  return /^\/admin(\/|$)/.test(volta) ? volta : '/admin/';
}

const form = document.getElementById('form-login');
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (await enviar(form, '/api/auth/login')) location.href = destino();
});
