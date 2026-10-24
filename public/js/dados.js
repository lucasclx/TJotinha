// Carregamento do conteúdo gerado por scripts/build.py e dos dados opcionais
// (questões, resumos, cronograma) produzidos pelas outras frentes do projeto.

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

async function json(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.json();
}
async function jsonOpcional(url) {
  try { return await json(url); } catch (e) { return null; }
}

export const D = {
  capa: null,
  materias: [],
  normas: [],
  lei: new Map(),     // id -> norma
  art: new Map(),     // artId -> {id, rotulo, epigrafe, titulo, lei, i}
  total: 0,
};

export async function carregarIndice() {
  const d = await json('data/indice.json');
  D.capa = d.capa;
  D.materias = d.materias;
  D.normas = d.normas;
  for (const n of d.normas) {
    D.lei.set(n.id, n);
    n.materiaObj = d.materias.find(m => m.id === n.materia);
    n.artigos.forEach((a, i) => D.art.set(a.id, { ...a, lei: n.id, i }));
  }
  D.total = D.art.size;
}

export const nomeArt = id => {
  const a = D.art.get(id);
  return a ? a.rotulo : id;
};
export const siglaLei = id => {
  const n = D.lei.get(id);
  if (!n) return id;
  const curtas = { cp: 'CP', cpp: 'CPP', cpc: 'CPC', cf: 'CF/88', ri: 'RI TJSP', nscgj: 'NSCGJ' };
  return curtas[id] || n.titulo.split(' — ')[0];
};

// Texto das normas
const cacheLei = new Map();
export function htmlLei(id) {
  if (!cacheLei.has(id)) cacheLei.set(id, fetch(`leis/${id}.html`).then(r => { if (!r.ok) throw new Error(r.status); return r.text(); }));
  return cacheLei.get(id);
}
const cacheDoc = new Map();
export async function artigoHTML(id) {
  const a = D.art.get(id);
  if (!a) return '';
  if (!cacheDoc.has(a.lei)) {
    const doc = new DOMParser().parseFromString(`<div>${await htmlLei(a.lei)}</div>`, 'text/html');
    cacheDoc.set(a.lei, doc);
  }
  const el = cacheDoc.get(a.lei).getElementById(id);
  return el ? el.outerHTML : '';
}

// Busca
let busca = null;
export async function indiceBusca() {
  if (!busca) busca = json('data/busca.json').then(l => l.map(x => ({ ...x, n: norm(x.t) })));
  return busca;
}

// Dados opcionais
let questoes;
export function carregarQuestoes() {
  if (questoes === undefined) {
    questoes = (async () => {
      const idx = await jsonOpcional('data/questoes/index.json');
      const lista = Array.isArray(idx) ? idx : idx?.materias;
      if (!Array.isArray(lista) || !lista.length) return null;
      const arquivos = await Promise.all(lista.map(m => jsonOpcional(`data/questoes/${m.arquivo || m.slug + '.json'}`)));
      const materias = lista.map((m, i) => ({ slug: m.slug, materia: m.materia, questoes: arquivos[i]?.questoes || [] }));
      const todas = materias.flatMap(m => m.questoes.map(q => ({ ...q, slug: m.slug, materia: m.materia })));
      return todas.length ? { materias, todas } : null;
    })();
  }
  return questoes;
}

const resumos = new Map();
let indiceResumos;
export function avisoResumos() {
  return indiceResumos?.then(i => i?.aviso || '');
}
export async function carregarResumo(lei) {
  if (indiceResumos === undefined) indiceResumos = jsonOpcional('data/resumos/index.json');
  const idx = await indiceResumos;
  const lista = Array.isArray(idx) ? idx : idx?.resumos || idx?.leis || idx?.normas || [];
  const item = lista.find(x => (typeof x === 'string' ? x : x.slug || x.id || x.ancora) === lei);
  if (!idx || !item) return null;
  const arquivo = typeof item === 'object' && item.arquivo ? item.arquivo : `${lei}.json`;
  if (!resumos.has(lei)) resumos.set(lei, jsonOpcional(`data/resumos/${arquivo}`));
  return resumos.get(lei);
}

let cronograma;
export function carregarCronograma() {
  if (cronograma === undefined) {
    cronograma = (async () => {
      const [c, u] = await Promise.all([jsonOpcional('data/cronograma.json'), jsonOpcional('data/unidades.json')]);
      if (!c || !Array.isArray(c.semanas)) return null;
      const lista = Array.isArray(u) ? u : u?.unidades || [];
      return { ...c, unidades: new Map(lista.map(x => [x.id, x])) };
    })();
  }
  return cronograma;
}

// Artigos de uma unidade do cronograma (intervalo "de" a "ate" na ordem da norma)
export function artigosDoIntervalo(lei, de, ate) {
  const n = D.lei.get(lei);
  if (!n) return [];
  const i = de ? n.artigos.findIndex(a => a.id === de) : 0;
  const j = ate ? n.artigos.findIndex(a => a.id === ate) : n.artigos.length - 1;
  if (i < 0 || j < 0) return [];
  return n.artigos.slice(i, j + 1).map(a => a.id);
}

// Converte referências a artigos em ids do site. Aceita "cp-312" ou "art. 312" (na norma informada).
export function idsDeArtigos(ref, lei) {
  if (!ref) return [];
  const itens = Array.isArray(ref) ? ref : [ref];
  const ids = [];
  for (const r of itens) {
    const s = String(r);
    if (D.art.has(s)) { ids.push(s); continue; }
    const re = /art(?:igo)?s?\.?\s*([\d.]+(?:-[A-Z])?)(?:\s*(?:a|até)\s*([\d.]+(?:-[A-Z])?))?/gi;
    let m;
    while ((m = re.exec(s))) {
      const a = `${lei}-${m[1].replace(/\./g, '')}`;
      if (m[2]) ids.push(...artigosDoIntervalo(lei, a, `${lei}-${m[2].replace(/\./g, '')}`));
      else if (D.art.has(a)) ids.push(a);
    }
  }
  return [...new Set(ids)];
}
