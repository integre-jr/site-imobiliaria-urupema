// Toda a API: erro inesperado vira 500 com mensagem genérica (o detalhe vai para o log).
import { erroInterno } from '../../lib/http.js';

export async function onRequest({ next }) {
  try {
    return await next();
  } catch (e) {
    return erroInterno(e);
  }
}
