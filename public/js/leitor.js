import { E, marcarLido, alternarEstrela, alternarRevisao, addGrifo, remGrifo, salvarNota, registrarPosicao } from './estado.js';
import { D, esc, norm, htmlLei, carregarResumo, carregarQuestoes } from './dados.js';
import { $, $$ } from './dom.js';
import { toast, barra, pct, lidosDe, atualizarLateral } from './app.js';
import { renderResumo, renderQuestoes } from './extras.js';

const IC = {
  lido: '<svg viewBox="0 0 20 20"><path d="M4 10.5l4 4 8-9"/></svg>',
  estrela: '<svg viewBox="0 0 20 20"><path d="M10 2.8l2.2 4.6 5 .6-3.7 3.4 1 5-4.5-2.5-4.5 2.5 1-5L2.8 8l5-.6z"/></svg>',
  revisao: '<svg viewBox="0 0 20 20"><path d="M4 10a6 6 0 1 0 2-4.5M4 3.5V6h2.5"/></svg>',
  nota: '<svg viewBox="0 0 20 20"><path d="M13.5 3.5l3 3L7 16H4v-3z"/></svg>',
};

let L = null;            // estado do leitor aberto: {lei, aba, arts, atual, corpo}
const originais = new Map();
let destaque = '';       // termo vindo da busca, realçado no artigo de destino

export function destacar(q) { destaque = q; }

// ---------- Abertura ----------
export async function abrirLeitor(vista, lei, sub) {
  const aba = sub === 'resumo' || sub === 'questoes' ? sub : 'texto';
  const alvo = aba === 'texto' ? sub : null;
  if (L && L.lei === lei && L.aba === aba && aba === 'texto' && document.contains(L.corpo)) {
    if (alvo) irPara(alvo);
    return;
  }
  fecharLeitor();
  const n = D.lei.get(lei);
  vista.innerHTML = `<div class="leitor"><div class="leitor-col">
    <header class="lei-cab">
      <p class="kicker">${esc(n.materiaObj.titulo)}</p>
      <h1>${esc(n.titulo)}</h1>
      ${n.subtitulo ? `<p class="sub">${esc(n.subtitulo)}</p>` : ''}
      ${n.recorte ? `<p class="rec"><b>Recorte do edital</b>${esc(n.recorte)}</p>` : ''}
      <div class="lei-prog" id="leiProg"></div>
      <nav class="abas">
        <a href="#/lei/${lei}" class="${aba === 'texto' ? 'ativo' : ''}">Texto da lei</a>
        <a href="#/lei/${lei}/resumo" id="abaResumo" class="${aba === 'resumo' ? 'ativo' : ''}" hidden>Resumo e mapa mental</a>
        <a href="#/lei/${lei}/questoes" id="abaQuestoes" class="${aba === 'questoes' ? 'ativo' : ''}" hidden>Questões</a>
      </nav>
    </header>
    <div id="leiCorpo"><p class="vazio">Carregando…</p></div>
  </div><aside class="trilho" id="trilho" aria-label="Títulos e capítulos"></aside></div>`;
  const corpo = $('#leiCorpo');
  L = { lei, aba, arts: [], atual: null, corpo };
  atualizarProgresso();

  carregarResumo(lei).then(r => { const a = $('#abaResumo'); if (a) a.hidden = !r; });
  carregarQuestoes().then(q => { const a = $('#abaQuestoes'); if (a) a.hidden = !q?.todas.some(x => x.lei === lei); });

  if (aba === 'resumo') {
    $('#trilho').remove();
    renderResumo(corpo, lei, await carregarResumo(lei));
    window.scrollTo(0, 0);
    return;
  }
  if (aba === 'questoes') {
    $('#trilho').remove();
    const q = await carregarQuestoes();
    renderQuestoes(corpo, (q?.todas || []).filter(x => x.lei === lei), { semFiltro: true });
    window.scrollTo(0, 0);
    return;
  }

  let html;
  try { html = await htmlLei(lei); } catch (e) { corpo.innerHTML = '<p class="vazio">Não foi possível carregar o texto desta norma.</p>'; return; }
  if (!L || L.corpo !== corpo) return;
  corpo.innerHTML = `<div class="lei-texto">${html}</div>`;
  L.arts = $$('article.art', corpo);
  for (const el of L.arts) {
    originais.set(el.id, el.innerHTML);
    decorar(el);
  }
  montarTrilho();
  ligarEventos(corpo);

  const retomar = !alvo && E.posLei[lei] && document.getElementById(E.posLei[lei]);
  const destino = alvo || (retomar ? E.posLei[lei] : null);
  if (destino) {
    irPara(destino, true);
    if (retomar) toast(`Retomando de ${D.art.get(destino)?.rotulo || 'onde você parou'}.`, { rotulo: 'Ir para o início', fn: () => { window.scrollTo(0, 0); definirAtual(L.arts[0]); } });
  } else {
    window.scrollTo(0, 0);
    definirAtual(L.arts[0]);
  }
  window.addEventListener('scroll', aoRolar, { passive: true });
}

export function fecharLeitor() {
  window.removeEventListener('scroll', aoRolar);
  $('#grifoBar').hidden = true;
  L = null;
}

function irPara(id, inicial) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ block: 'start' });
  const art = el.closest('article.art') || (el.matches('.hd') ? proximoArtigo(el) : null);
  if (art) definirAtual(art);
  if (destaque && art) { realcar(art, destaque); destaque = ''; }
  if (!inicial) history.replaceState(null, '', `#/lei/${L.lei}/${id}`);
}

function proximoArtigo(el) {
  let n = el.nextElementSibling;
  while (n && !n.matches('article.art')) n = n.nextElementSibling;
  return n;
}

// ---------- Artigo ----------
function decorar(el) {
  const id = el.id;
  el.innerHTML = originais.get(id);
  aplicarGrifos(el, E.grifos[id] || []);
  el.classList.toggle('lido', !!E.lidos[id]);
  el.classList.toggle('estrela', !!E.estrelas[id]);
  const acoes = document.createElement('div');
  acoes.className = 'acoes ui';
  acoes.innerHTML = [
    ['lido', E.lidos[id], 'Marcar como lido (L)'],
    ['estrela', E.estrelas[id], 'Estrela: difícil ou importante (E)'],
    ['revisao', E.revisao[id], 'Incluir na revisão espaçada (R)'],
    ['nota', E.notas[id], 'Escrever nota (N)'],
  ].map(([a, on, t]) => `<button type="button" data-a="${a}" class="${on ? 'on' : ''}" title="${t}" aria-label="${t}">${IC[a]}</button>`).join('');
  el.prepend(acoes);
  if (E.notas[id]) {
    const nt = document.createElement('div');
    nt.className = 'nota ui';
    nt.title = 'Clique para editar';
    nt.textContent = E.notas[id].texto;
    el.append(nt);
  }
}

function textos(el) {
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
    acceptNode: n => (n.parentElement.closest('.ui') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  const l = [];
  while (w.nextNode()) l.push(w.currentNode);
  return l;
}

function envolver(el, s, e, criar) {
  let pos = 0;
  for (const t of textos(el)) {
    const ini = pos, fim = pos + t.length;
    pos = fim;
    if (fim <= s || ini >= e) continue;
    let alvo = t;
    if (s > ini) alvo = alvo.splitText(s - ini);
    if (e < fim) alvo.splitText(e - Math.max(s, ini));
    if (!alvo.length || !alvo.data.trim()) continue;
    const m = criar();
    alvo.parentNode.insertBefore(m, alvo);
    m.append(alvo);
  }
}

function aplicarGrifos(el, lista) {
  lista.forEach((g, i) => envolver(el, g.s, g.e, () => {
    const m = document.createElement('mark');
    m.className = `g g-${g.c}`;
    m.dataset.gi = i;
    return m;
  }));
}

function realcar(el, q) {
  const termos = norm(q).split(/\s+/).filter(t => t.length > 2 && !/^art/.test(t));
  if (!termos.length) return;
  const txt = norm(textos(el).map(t => t.data).join(''));
  for (const termo of termos) {
    let i = txt.indexOf(termo);
    const achados = [];
    while (i >= 0 && achados.length < 20) { achados.push(i); i = txt.indexOf(termo, i + termo.length); }
    for (const p of achados.reverse()) envolver(el, p, p + termo.length, () => { const m = document.createElement('mark'); m.className = 'busca'; return m; });
  }
}

function posicao(el, no, off) {
  const r = document.createRange();
  r.setStart(el, 0);
  r.setEnd(no, off);
  return r.toString().length;
}

function atualizarArtigo(id) {
  const el = document.getElementById(id);
  if (el) decorar(el);
  atualizarProgresso();
  montarTrilho();
}

function atualizarProgresso() {
  const n = D.lei.get(L.lei);
  const l = lidosDe(n.artigos.map(a => a.id));
  const p = $('#leiProg');
  if (p) p.innerHTML = `${barra(pct(l, n.artigos.length))}<span>${l} de ${n.artigos.length} artigos lidos (${Math.round(pct(l, n.artigos.length) * 100)}%)</span>`;
}

// ---------- Ações ----------
function acao(id, a) {
  if (a === 'lido') {
    const sim = !E.lidos[id];
    marcarLido(id, sim);
    atualizarArtigo(id);
    atualizarLateral();
    return sim;
  }
  if (a === 'estrela') {
    const on = alternarEstrela(id);
    atualizarArtigo(id);
    toast(on ? 'Marcado com estrela. Aparece no Caderno.' : 'Estrela removida.');
  }
  if (a === 'revisao') {
    const on = alternarRevisao(id);
    atualizarArtigo(id);
    atualizarLateral();
    toast(on ? 'Incluído na revisão de hoje.' : 'Removido da revisão.');
  }
  if (a === 'nota') editarNota(document.getElementById(id));
}

function editarNota(el) {
  if (!el || $('.nota-ed', el)) return;
  $('.nota', el)?.remove();
  const box = document.createElement('div');
  box.className = 'nota-ed ui';
  box.innerHTML = `<textarea placeholder="Sua anotação sobre este artigo (Ctrl+Enter salva, Esc cancela)"></textarea>
    <div class="linha"><button type="button" class="btn peq" data-n="ok">Salvar nota</button><button type="button" class="btn ghost peq" data-n="cancelar">Cancelar</button>${E.notas[el.id] ? '<button type="button" class="btn perigo peq" data-n="apagar">Apagar</button>' : ''}</div>`;
  el.append(box);
  const ta = $('textarea', box);
  ta.value = E.notas[el.id]?.texto || '';
  ta.focus();
  const fim = salvar => {
    if (salvar !== null) salvarNota(el.id, salvar);
    atualizarArtigo(el.id);
  };
  box.onclick = e => {
    const b = e.target.closest('[data-n]');
    if (!b) return;
    fim(b.dataset.n === 'ok' ? ta.value : b.dataset.n === 'apagar' ? '' : null);
  };
  ta.onkeydown = e => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); fim(ta.value); }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); fim(null); }
  };
}

// ---------- Grifos ----------
let pendente = null;

function mostrarBarra(rect, modo) {
  const bar = $('#grifoBar');
  bar.hidden = false;
  $('.g-rem', bar).hidden = modo !== 'existente';
  const w = bar.offsetWidth;
  bar.style.left = `${Math.max(8, Math.min(innerWidth - w - 8, rect.left + rect.width / 2 - w / 2 + scrollX))}px`;
  bar.style.top = `${rect.top + scrollY - bar.offsetHeight - 8}px`;
}

function aoSelecionar() {
  const s = getSelection();
  if (!L || s.isCollapsed || !s.rangeCount) { if (!pendente?.gi) $('#grifoBar').hidden = true; return; }
  const r = s.getRangeAt(0);
  const no = r.startContainer.nodeType === 1 ? r.startContainer : r.startContainer.parentElement;
  const art = no.closest('article.art');
  if (!art || no.closest('.ui')) return;
  const total = textos(art).reduce((n, t) => n + t.length, 0);
  const s0 = posicao(art, r.startContainer, r.startOffset);
  const e0 = art.contains(r.endContainer) && !(r.endContainer.parentElement?.closest('.ui')) ? posicao(art, r.endContainer, r.endOffset) : total;
  const e1 = Math.min(e0, total);
  if (e1 - s0 < 2) return;
  const texto = s.toString().replace(/\s+/g, ' ').trim().slice(0, 400);
  pendente = { art: art.id, s: s0, e: e1, t: texto };
  mostrarBarra(r.getBoundingClientRect(), 'novo');
}

function aplicarCor(cor) {
  if (!pendente) return;
  const { art } = pendente;
  if (pendente.gi !== undefined) {
    if (cor === 'remover') remGrifo(art, pendente.gi);
    else { E.grifos[art][pendente.gi].c = cor; registrarPosicao(L.lei, art); }
  } else if (cor !== 'remover') {
    addGrifo(art, { s: pendente.s, e: pendente.e, c: cor, t: pendente.t });
  }
  getSelection().removeAllRanges();
  $('#grifoBar').hidden = true;
  pendente = null;
  atualizarArtigo(art);
}

// ---------- Eventos ----------
function ligarEventos(corpo) {
  corpo.addEventListener('click', e => {
    const b = e.target.closest('.acoes button');
    if (b) {
      const id = b.closest('article.art').id;
      const marcou = acao(id, b.dataset.a);
      if (b.dataset.a === 'lido' && marcou) toast('Artigo marcado como lido.');
      return;
    }
    const nt = e.target.closest('.nota');
    if (nt) { editarNota(nt.closest('article.art')); return; }
    const m = e.target.closest('mark.g');
    if (m && getSelection().isCollapsed) {
      pendente = { art: m.closest('article.art').id, gi: +m.dataset.gi };
      mostrarBarra(m.getBoundingClientRect(), 'existente');
      return;
    }
    const art = e.target.closest('article.art');
    if (art) definirAtual(art);
  });
  corpo.addEventListener('mouseup', () => setTimeout(aoSelecionar, 0));
}

document.addEventListener('mousedown', e => {
  if (!e.target.closest('#grifoBar') && !e.target.closest('mark.g')) { $('#grifoBar').hidden = true; pendente = null; }
});
$('#grifoBar').addEventListener('mousedown', e => e.preventDefault());
$('#grifoBar').addEventListener('click', e => {
  const b = e.target.closest('[data-cor]');
  if (b) aplicarCor(b.dataset.cor);
});

// ---------- Artigo atual e "onde parei" ----------
let raf = 0;
function aoRolar() {
  if (raf) return;
  raf = requestAnimationFrame(() => {
    raf = 0;
    if (!L || !L.arts.length) return;
    const linha = innerHeight * 0.3;
    let lo = 0, hi = L.arts.length - 1, ach = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (L.arts[mid].getBoundingClientRect().top <= linha) { ach = mid; lo = mid + 1; } else hi = mid - 1;
    }
    definirAtual(L.arts[ach]);
  });
}

function definirAtual(el) {
  if (!el || !L || L.atual === el) return;
  L.atual?.classList.remove('atual');
  L.atual = el;
  el.classList.add('atual');
  registrarPosicao(L.lei, el.id);
  const t = D.art.get(el.id)?.titulo;
  $$('#trilho a').forEach(a => a.classList.toggle('ativo', a.dataset.t === t));
  const at = $('#trilho a.ativo');
  if (at) {
    const tr = $('#trilho');
    const r = at.getBoundingClientRect(), rt = tr.getBoundingClientRect();
    if (r.top < rt.top + 40 || r.bottom > rt.bottom - 40) tr.scrollTop += r.top - rt.top - rt.height / 3;
  }
}

function montarTrilho() {
  const tr = $('#trilho');
  if (!tr || !L) return;
  const n = D.lei.get(L.lei);
  const porTitulo = new Map();
  for (const a of n.artigos) {
    if (!porTitulo.has(a.titulo)) porTitulo.set(a.titulo, []);
    porTitulo.get(a.titulo).push(a.id);
  }
  const ativo = L.atual && D.art.get(L.atual.id)?.titulo;
  const scroll = tr.scrollTop;
  tr.innerHTML = `<h2>Nesta norma</h2>${n.titulos.map(t => {
    const ids = porTitulo.get(t.id) || [];
    const l = lidosDe(ids);
    return `<a href="#/lei/${L.lei}/${t.id}" data-t="${t.id}" data-n="${t.nivel}" class="${t.id === ativo ? 'ativo' : ''} ${ids.length && l === ids.length ? 'completo' : ''}"><span class="tt">${esc(t.rotulo)}</span>${ids.length ? `<span class="tn">${l}/${ids.length}</span>` : ''}</a>`;
  }).join('') || '<p class="dica">Esta norma não tem divisões.</p>'}`;
  tr.scrollTop = scroll;
  tr.onclick = e => {
    const a = e.target.closest('a[data-t]');
    if (!a) return;
    e.preventDefault();
    irPara(a.dataset.t);
  };
}

// ---------- Teclado ----------
function vizinho(d) {
  const i = L.arts.indexOf(L.atual);
  return L.arts[Math.max(0, Math.min(L.arts.length - 1, i + d))];
}
function rolarPara(el) {
  el.scrollIntoView({ block: 'start', behavior: 'smooth' });
  definirAtual(el);
}

export function teclaLeitor(e) {
  if (!L || L.aba !== 'texto' || !L.atual) return false;
  const k = e.key.toLowerCase();
  if (!$('#grifoBar').hidden && pendente && ['1', '2', '3', '4'].includes(k)) {
    aplicarCor(['amarelo', 'verde', 'azul', 'rosa'][+k - 1]);
    return true;
  }
  const id = L.atual.id;
  if (k === 'j') { rolarPara(vizinho(1)); return true; }
  if (k === 'k') { rolarPara(vizinho(-1)); return true; }
  if (k === 'l') {
    // L marca e avança; para desmarcar, use o botão ao lado do artigo.
    if (!E.lidos[id]) acao(id, 'lido');
    if (vizinho(1) !== L.atual) rolarPara(vizinho(1));
    return true;
  }
  if (k === 'e') { acao(id, 'estrela'); return true; }
  if (k === 'r') { acao(id, 'revisao'); return true; }
  if (k === 'n') { acao(id, 'nota'); return true; }
  return false;
}
