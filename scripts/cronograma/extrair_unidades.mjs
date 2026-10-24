// Extrai do HTML da Lei Seca as "unidades de estudo": trechos contínuos de uma
// lei, com tamanho parecido, cortados de preferência nos títulos/capítulos.
//
// Uso: node scripts/cronograma/extrair_unidades.mjs "<Lei Seca ... .html>" [saida.json]
// Saída padrão: public/data/unidades.json

import { readFileSync, writeFileSync } from 'node:fs';

// Ritmo de primeira leitura atenta (lendo, grifando e anotando), em caracteres
// por minuto.
const CHARS_POR_MINUTO = 250;
// Tamanho-alvo de uma unidade, em minutos de leitura.
const ALVO_MIN = 60;
const MIN_MIN = 35;

// Peso estimado de incidência na prova (1 = baixa, 3 = alta). É uma estimativa
// a partir do histórico da VUNESP para Escrevente, não um dado oficial.
const PESOS = {
  cp: 3, cpp: 3, l9099pen: 2, cpc: 3, l9099civ: 2, l12153: 2, cf: 3,
  l10261: 2, l8429: 2, res850: 1, res963: 2, lc1111: 1, ri: 1, nscgj: 3,
};

// Nomes curtos para os títulos das unidades.
const CURTOS = {
  cp: 'CP', cpp: 'CPP', l9099pen: 'Lei 9.099 (criminal)', cpc: 'CPC',
  l9099civ: 'Lei 9.099 (cível)', l12153: 'Lei 12.153', cf: 'CF/88',
  l10261: 'Lei 10.261', l8429: 'Lei 8.429', res850: 'Res. 850', res963: 'Res. 963',
  lc1111: 'LC 1.111', ri: 'Regimento Interno', nscgj: 'NSCGJ',
};

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const unescape = (s) =>
  s.replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e) => {
    if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : +e.slice(1));
    return ENT[e] ?? m;
  });
const texto = (s) => unescape(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

// "CAPÍTULO I" + "DOS DIREITOS E DEVERES" -> "Capítulo I · Dos direitos e deveres"
const caixaAlta = (s) => s === s.toUpperCase() && /[A-ZÀ-Ú]/.test(s);
const frase = (s) => (caixaAlta(s) ? s.charAt(0) + s.slice(1).toLowerCase() : s);
function rotuloTitulo(h) {
  const hl = texto((h.match(/<span class="hl">([\s\S]*?)<\/span>/) || [, ''])[1]);
  const ht = texto((h.match(/<span class="ht">([\s\S]*?)<\/span>/) || [, ''])[1]);
  const rot = caixaAlta(hl) ? hl.split(' ').map((w, i) => (i === 0 ? w.charAt(0) + w.slice(1).toLowerCase() : w)).join(' ') : hl;
  return [rot, frase(ht)].filter(Boolean).join(' · ');
}

const [, , entrada, saida = 'public/data/unidades.json'] = process.argv;
if (!entrada) {
  console.error('Uso: node scripts/cronograma/extrair_unidades.mjs "<Lei Seca.html>" [saida.json]');
  process.exit(1);
}

let html = readFileSync(entrada, 'utf8');
html = html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<script[\s\S]*?<\/script>/g, '');

const unidades = [];
const leis = [];

for (const blocoMat of html.split('<section class="materia" id="').slice(1)) {
  const materiaId = blocoMat.slice(0, blocoMat.indexOf('"'));
  const materia = unescape(blocoMat.match(/class="mat-title" data-bm="([^"]+)"/)[1]);

  for (const blocoLei of blocoMat.split('<section class="law" id="').slice(1)) {
    const leiId = blocoLei.slice(0, blocoLei.indexOf('"'));
    const lei = unescape(blocoLei.match(/class="law-title" data-bm="([^"]+)"/)[1]);
    const curto = CURTOS[leiId] ?? lei;
    const peso = PESOS[leiId] ?? 2;

    // Percorre títulos e artigos na ordem em que aparecem.
    const re = /<h([3-6]) class="hd (lv\d)" id="([^"]+)">([\s\S]*?)<\/h\1>|<article class="art" id="([^"]+)">([\s\S]*?)<\/article>/g;
    const arts = [];
    let titulo = '';
    // Nível do título mais alto visto antes do artigo (0 = Parte ... 5 = Subseção).
    let novoTitulo = 9;
    for (let m; (m = re.exec(blocoLei)); ) {
      if (m[3]) {
        // Títulos de nível mais baixo (Parte/Livro) não descrevem bem o trecho.
        const t = rotuloTitulo(m[4]);
        if (m[2] !== 'lv0' && m[2] !== 'lv1') titulo = t;
        novoTitulo = Math.min(novoTitulo, +m[2].slice(2));
        continue;
      }
      const corpo = m[6];
      const rotulo = (corpo.match(/<b class="al">([\s\S]*?)<\/b>/) || [, ''])[1];
      let num = texto(rotulo).replace(/^Art(igo)?\.?\s*/i, '').replace(/[\s.\-–º°]+$/, '').replace(/[º°]/g, '');
      if (m[5].includes('-dt-')) num += ' (ADT)';
      arts.push({ id: m[5], num, chars: texto(corpo).length, titulo, nivelTitulo: novoTitulo });
      novoTitulo = 9;
    }

    // Agrupa artigos em unidades. Títulos "estruturais" (Título/Livro, ou
    // Capítulo quando a lei não tem níveis acima) sempre começam unidade nova.
    // Dentro deles, corta num título menor quando a unidade já tem tamanho
    // razoável, ou ao passar do alvo, desde que o resto do trecho não fique
    // pequeno demais para virar unidade própria.
    const nivelMax = Math.min(...arts.map((a) => a.nivelTitulo));
    const corteForcado = nivelMax === 9 ? -1 : Math.max(2, nivelMax);
    const restante = new Array(arts.length);
    for (let i = arts.length - 1, acc = 0; i >= 0; i--) {
      acc += arts[i].chars / CHARS_POR_MINUTO;
      restante[i] = acc;
      if (arts[i].nivelTitulo <= corteForcado) acc = 0;
    }
    const grupos = [];
    let g = [];
    let min = 0;
    arts.forEach((a, i) => {
      const m = a.chars / CHARS_POR_MINUTO;
      const sobra = restante[i] >= MIN_MIN / 2;
      const corte =
        a.nivelTitulo <= corteForcado ||
        (sobra && a.nivelTitulo < 9 && min >= MIN_MIN) ||
        (sobra && min + m > ALVO_MIN * 1.3);
      if (g.length && corte) {
        grupos.push(g);
        g = [];
        min = 0;
      }
      g.push(a);
      min += m;
    });
    if (g.length) grupos.push(g);
    // Trechos muito curtos (ex.: um Título de um artigo só) vão para a unidade
    // seguinte, ou para a anterior quando são o fim da lei.
    const minDe = (grupo) => grupo.reduce((s, a) => s + a.chars, 0) / CHARS_POR_MINUTO;
    for (let i = 0; i < grupos.length; i++) {
      if (grupos.length > 1 && minDe(grupos[i]) < MIN_MIN / 3) {
        if (i + 1 < grupos.length) grupos[i + 1].unshift(...grupos[i]);
        else grupos[i - 1].push(...grupos[i]);
        grupos.splice(i--, 1);
      }
    }

    let totalMin = 0;
    grupos.forEach((grupo, i) => {
      const de = grupo[0];
      const ate = grupo[grupo.length - 1];
      const minutos = Math.max(10, Math.round(grupo.reduce((s, a) => s + a.chars, 0) / CHARS_POR_MINUTO / 5) * 5);
      totalMin += minutos;
      const faixa = grupo.length === 1 ? `Art. ${de.num}` : `Arts. ${de.num} a ${ate.num}`;
      unidades.push({
        id: `${leiId}-u${i + 1}`,
        materiaId,
        materia,
        leiId,
        lei,
        titulo: `${curto}, ${faixa}`,
        assunto: de.titulo,
        de: de.id,
        ate: ate.id,
        nArtigos: grupo.length,
        minutos,
        peso,
      });
    });
    leis.push({ leiId, lei, materia, unidades: grupos.length, artigos: arts.length, minutos: totalMin });
  }
}

writeFileSync(saida, JSON.stringify({ geradoEm: new Date().toISOString().slice(0, 10), charsPorMinuto: CHARS_POR_MINUTO, unidades }, null, 1) + '\n');
console.table(leis);
console.log(`${unidades.length} unidades, ${Math.round(unidades.reduce((s, u) => s + u.minutos, 0) / 60)} h de primeira leitura -> ${saida}`);
