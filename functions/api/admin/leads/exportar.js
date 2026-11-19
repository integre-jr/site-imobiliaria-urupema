// GET /api/admin/leads/exportar — todos os leads em CSV (abre direto no Excel em português).
import { todos } from '../../../../lib/db.js';
import { csv, formatarLead, STATUS_LEAD } from '../../../../lib/leads.js';

const dataBr = (iso) => {
  const d = new Date(iso);
  // horário de Brasília (UTC-3, sem horário de verão desde 2019)
  const b = new Date(d.getTime() - 3 * 3600000);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(b.getUTCDate())}/${p(b.getUTCMonth() + 1)}/${b.getUTCFullYear()} ${p(b.getUTCHours())}:${p(b.getUTCMinutes())}`;
};

export async function onRequestGet({ env }) {
  const linhas = await todos(env.DB, 'SELECT * FROM leads ORDER BY criado_em DESC, id DESC');
  const tabela = [['Data', 'Origem', 'Situação', 'Nome', 'Telefone', 'E-mail', 'Imóvel', 'Detalhes', 'Notas']];
  for (const l of linhas) {
    const f = formatarLead(l);
    tabela.push([
      dataBr(f.criado_em), f.origem_rotulo, STATUS_LEAD[f.status], f.nome, f.telefone || '', f.email || '', f.imovel_ref || '',
      f.campos.map((c) => `${c.rotulo}: ${c.valor}`).join(' | '), f.notas,
    ]);
  }
  const hoje = new Date().toISOString().slice(0, 10);
  return new Response(csv(tabela), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="leads-urupema-${hoje}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
