// Escape de texto para HTML e XML. Toda saída montada no servidor passa por aqui (spec, seção 11).

const MAPA = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, (c) => MAPA[c]);
}

// Atributos e texto de XML usam o mesmo conjunto de entidades.
export const escapeXml = escapeHtml;

// Texto livre dentro de <![CDATA[...]]>: "]]>" encerraria o bloco antes da hora.
export function cdata(valor) {
  return '<![CDATA[' + String(valor ?? '').replaceAll(']]>', ']]]]><![CDATA[>') + ']]>';
}
