// Rota de API inexistente: 404 em JSON (sem isso, o Pages devolveria uma página HTML).
import { erro } from '../../lib/http.js';

export const onRequest = () => erro('Endereço não encontrado.', 404);
