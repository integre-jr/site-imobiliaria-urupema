// Leads dos formulários do site (spec 7.5, marco M4): campos aceitos por origem, validação,
// fotos do "Negocie", retenção (LGPD) e exportação CSV.
import { normalizarRef } from './imoveis.js';

export const ORIGENS = {
  contato: 'Contato',
  negocie: 'Negocie seu imóvel',
  financie: 'Financiamento',
  interesse_imovel: 'Interesse em imóvel',
};

export const STATUS_LEAD = {
  novo: 'Novo',
  em_atendimento: 'Em atendimento',
  concluido: 'Concluído',
  descartado: 'Descartado',
};

// Campos de cada formulário (além de nome, email e telefone, que viram colunas) e seus rótulos.
// O que não está aqui é ignorado: ninguém consegue gravar campos inventados.
const C = (rotulo, max = 200) => ({ rotulo, max });
export const CAMPOS_LEAD = {
  contato: { assunto: C('Assunto'), mensagem: C('Mensagem', 3000) },
  negocie: {
    cpf: C('CPF / CNPJ', 30), negocio: C('Objetivo', 40), tipo: C('Tipo de imóvel', 40), valor: C('Valor pretendido', 40),
    cep: C('CEP', 12), cidade: C('Cidade', 80), bairro: C('Bairro', 80), rua: C('Rua', 120), numero: C('Número', 20),
    complemento: C('Complemento', 120), area: C('Área (m²)', 20), quartos: C('Quartos', 5), banheiros: C('Banheiros', 5),
    vagas: C('Vagas', 5), diferenciais: C('Diferenciais', 300), descricao: C('Descrição', 3000),
  },
  financie: {
    cpf: C('CPF', 20), nascimento: C('Data de nascimento', 10), estado_civil: C('Estado civil', 30), fgts: C('Possui FGTS', 5),
    renda: C('Renda familiar', 40), valor: C('Valor do imóvel', 40), entrada: C('Entrada', 40), prazo: C('Prazo', 40),
    tipo_imovel: C('Tipo de imóvel', 40), cidade: C('Cidade', 80), horario: C('Melhor horário', 20), observacoes: C('Observações', 3000),
  },
  interesse_imovel: { mensagem: C('Mensagem', 3000) },
};

export const MAX_FOTOS_LEAD = 5;
export const MAX_BYTES_FOTO_LEAD = 2 * 1024 * 1024;
export const MAX_LEADS_POR_HORA = 10;
export const TEMPO_MINIMO_MS = 3000;           // envio em menos de 3 s depois de abrir a página = robô
export const RETENCAO_DIAS = 730;              // 2 anos (privacidade.html)

const texto = (v) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');

// Valida o corpo enviado pelo site. Devolve { lead } ou { erro, campo }.
export function validarLead(b) {
  const origem = texto(b.origem);
  if (!ORIGENS[origem]) return { erro: 'Formulário desconhecido.' };
  if (b.consentimento !== true && b.consentimento !== 'true' && b.consentimento !== 'on') {
    return { erro: 'Para enviar, marque que concorda com a Política de Privacidade.', campo: 'consentimento' };
  }
  const nome = texto(b.nome).replace(/\s+/g, ' ');
  if (!nome) return { erro: 'Informe o seu nome.', campo: 'nome' };
  if (nome.length > 100) return { erro: 'Nome longo demais (máx. 100 caracteres).', campo: 'nome' };
  const email = texto(b.email).toLowerCase();
  if (email && (email.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) return { erro: 'Confira o e-mail.', campo: 'email' };
  const telefone = texto(b.telefone);
  const digitos = telefone.replace(/\D/g, '').length;
  if (telefone && (digitos < 10 || digitos > 13 || telefone.length > 30)) return { erro: 'Telefone com DDD, por exemplo: (49) 99160-3030.', campo: 'telefone' };
  if (!email && !telefone) return { erro: 'Informe um telefone ou e-mail para retornarmos.', campo: 'telefone' };

  const dados = {};
  for (const [chave, { rotulo, max }] of Object.entries(CAMPOS_LEAD[origem])) {
    const v = texto(b[chave]);
    if (!v) continue;
    if (v.length > max) return { erro: `"${rotulo}" pode ter até ${max} caracteres.`, campo: chave };
    dados[chave] = v;
  }
  let imovelRef = null;
  if (origem === 'interesse_imovel') {
    imovelRef = normalizarRef(texto(b.imovel_ref));
    if (!imovelRef) return { erro: 'Imóvel não informado.' };
  }
  return { lead: { origem, nome, email: email || null, telefone: telefone || null, imovel_ref: imovelRef, dados } };
}

// Linha do banco → formato do painel (dados como lista de { rotulo, valor }, na ordem do formulário).
export function formatarLead(l, fotos = []) {
  let dados = {};
  try { dados = JSON.parse(l.dados || '{}'); } catch { /* vazio */ }
  const campos = CAMPOS_LEAD[l.origem] || {};
  return {
    id: l.id, origem: l.origem, origem_rotulo: ORIGENS[l.origem], nome: l.nome, email: l.email, telefone: l.telefone,
    imovel_ref: l.imovel_ref, status: l.status, notas: l.notas || '', criado_em: l.criado_em, atualizado_em: l.atualizado_em,
    consentimento_em: l.consentimento_em, dados,
    campos: Object.entries(campos).filter(([k]) => dados[k]).map(([k, c]) => ({ chave: k, rotulo: c.rotulo, valor: dados[k] })),
    fotos: fotos.map((f, i) => ({ id: f.id, url: `/api/admin/leads/${l.id}/fotos/${f.id}`, n: i + 1 })),
  };
}

// WhatsApp do lead: só números, com 55 na frente quando vier só com DDD.
export function whatsappDo(telefone) {
  const d = String(telefone || '').replace(/\D/g, '');
  if (d.length === 10 || d.length === 11) return '55' + d;
  return d.length >= 12 ? d : null;
}

// CSV para Excel em português: UTF-8 com BOM, separador ";", aspas em tudo.
// Fórmulas (=, +, -, @) ganham um apóstrofo para não serem executadas ao abrir.
export function csv(linhas) {
  const cel = (v) => {
    let s = String(v ?? '');
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  return '﻿' + linhas.map((l) => l.map(cel).join(';')).join('\r\n') + '\r\n';
}

// Apaga leads mais antigos que a retenção (e as fotos deles no KV). Chamado ao abrir a lista no painel.
export async function apagarVencidos(env) {
  const limite = new Date(Date.now() - RETENCAO_DIAS * 86400000).toISOString();
  const fotos = await env.DB.prepare(
    'SELECT f.kv_chave FROM lead_fotos f JOIN leads l ON l.id = f.lead_id WHERE l.criado_em < ?',
  ).bind(limite).all();
  await Promise.all(fotos.results.map((f) => env.FOTOS.delete(f.kv_chave)));
  await env.DB.batch([
    env.DB.prepare('DELETE FROM lead_fotos WHERE lead_id IN (SELECT id FROM leads WHERE criado_em < ?)').bind(limite),
    env.DB.prepare('DELETE FROM leads WHERE criado_em < ?').bind(limite),
  ]);
}

// Apaga um lead e as fotos dele (pedido de exclusão do titular, LGPD).
export async function apagarLead(env, id) {
  const fotos = await env.DB.prepare('SELECT kv_chave FROM lead_fotos WHERE lead_id = ?').bind(id).all();
  await Promise.all(fotos.results.map((f) => env.FOTOS.delete(f.kv_chave)));
  await env.DB.batch([
    env.DB.prepare('DELETE FROM lead_fotos WHERE lead_id = ?').bind(id),
    env.DB.prepare('DELETE FROM leads WHERE id = ?').bind(id),
  ]);
}
