// /api/auth/*: mesma proteção CSRF do admin (o login também só aceita o fetch do próprio site).
import { csrfOk } from '../../../lib/auth.js';
import { erro } from '../../../lib/http.js';

export const onRequest = ({ request, next }) => (csrfOk(request) ? next() : erro('Requisição inválida.', 403));
