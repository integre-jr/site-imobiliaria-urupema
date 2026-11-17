// GET /api/imoveis/opcoes — vocabulários (tipos, finalidades, características…) para filtros e para o admin.
import { json } from '../../../lib/http.js';
import { opcoes } from '../../../lib/imoveis.js';

export const onRequestGet = () => json(opcoes(), 200, { 'Cache-Control': 'public, max-age=3600' });
