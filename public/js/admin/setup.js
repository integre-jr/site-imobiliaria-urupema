import { enviar, lerForm, senhasConferem } from './api.js';

const form = document.getElementById('form-setup');
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!senhasConferem(form)) return;
  const { token, nome, email, senha } = lerForm(form);
  if (await enviar(form, '/api/auth/setup', { dados: { token, nome, email, senha } })) location.href = '/admin/';
});
