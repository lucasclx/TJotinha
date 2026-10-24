// Caderno (notas, grifos, estrelas), questões, resumos e cronograma.
import { E, salvar, hoje } from './estado.js';
import { D, esc, siglaLei, idsDeArtigos, carregarQuestoes, carregarCronograma, avisoResumos } from './dados.js';
import { $ } from './dom.js';
import { linkArt, barra, pct, quandoFoi, itemTarefa, ligarTarefas, toast, definirProva } from './app.js';

const ordemLei = id => D.normas.findIndex(n => n.id === id);
const ordemArt = id => { const a = D.art.get(id); return a ? ordemLei(a.lei) * 1e4 + a.i : 1e9; };

function linkificar(texto, lei) {
  return esc(texto).replace(/(art(?:igo)?s?\.?\s*)([\d.]+(?:-[A-Z])?)/gi, (m, pre, num) => {
    const id = `${lei}-${num.replace(/\./g, '')}`;
    return D.art.has(id) ? `<a href="${linkArt(id)}">${m}</a>` : m;
  });
}
function linksArtigos(ref, lei) {
  const ids = idsDeArtigos(ref, lei);
  if (!ids.length) return ref ? esc(Array.isArray(ref) ? ref.join(', ') : ref) : '';
  return ids.slice(0, 12).map(id => `<a href="${linkArt(id)}">${esc(D.art.get(id).rotulo)}</a>`).join(', ') + (ids.length > 12 ? ` e mais ${ids.length - 12}` : '');
}

// ---------- Caderno ----------
export function abrirCaderno(vista, aba = 'notas') {
  const abas = { notas: 'Notas', grifos: 'Grifos', estrelas: 'Estrelas' };
  if (!abas[aba]) aba = 'notas';
  const fonte = aba === 'notas' ? E.notas : aba === 'grifos' ? E.grifos : E.estrelas;
  const ids = Object.keys(fonte).filter(id => D.art.has(id)).sort((a, b) => ordemArt(a) - ordemArt(b));
  const porLei = new Map();
  for (const id of ids) {
    const l = D.art.get(id).lei;
    if (!porLei.has(l)) porLei.set(l, []);
    porLei.get(l).push(id);
  }
  const item = id => {
    const a = D.art.get(id);
    const cab = `<b>${esc(a.rotulo)}</b>${a.epigrafe ? ` · ${esc(a.epigrafe)}` : ''}`;
    if (aba === 'notas') return `<a class="cad-it" href="${linkArt(id)}">${cab} <small class="dica">${quandoFoi(E.notas[id].ts)}</small><p class="nt">${esc(E.notas[id].texto)}</p></a>`;
    if (aba === 'grifos') return `<a class="cad-it" href="${linkArt(id)}">${cab}${E.grifos[id].map(g => `<p class="q"><mark class="g-${g.c}">${esc(g.t || '')}</mark></p>`).join('')}</a>`;
    return `<a class="cad-it" href="${linkArt(id)}">${cab}${E.notas[id] ? `<p class="nt">${esc(E.notas[id].texto)}</p>` : ''}</a>`;
  };
  vista.innerHTML = `<div class="pg" style="max-width:860px">
    <div class="pg-h"><div><p class="kicker">Caderno</p><h1>Suas marcações</h1><p>Tudo o que você anotou, grifou ou marcou com estrela, na ordem das normas.</p></div>
    <button class="btn ghost" id="btnExpCad" style="margin-left:auto" type="button">Baixar caderno (.md)</button></div>
    <div class="filtros">${Object.entries(abas).map(([k, t]) => `<a class="chip ${k === aba ? 'ativo' : ''}" href="#/caderno/${k}">${t} (${Object.keys(k === 'notas' ? E.notas : k === 'grifos' ? E.grifos : E.estrelas).filter(id => D.art.has(id)).length})</a>`).join('')}</div>
    ${ids.length ? [...porLei].map(([l, lista]) => `<section class="cad-lei"><h2>${esc(D.lei.get(l).titulo)}</h2>${lista.map(item).join('')}</section>`).join('') :
      `<p class="vazio">${aba === 'notas' ? 'Nenhuma nota ainda. No texto da lei, use o lápis ao lado do artigo ou a tecla N.' : aba === 'grifos' ? 'Nenhum grifo ainda. Selecione um trecho da lei e escolha uma cor.' : 'Nenhuma estrela ainda. Use a estrela ao lado do artigo ou a tecla E para marcar os difíceis.'}</p>`}
  </div>`;
  $('#btnExpCad').onclick = exportarCaderno;
}

function exportarCaderno() {
  const ids = [...new Set([...Object.keys(E.notas), ...Object.keys(E.grifos), ...Object.keys(E.estrelas)])].filter(id => D.art.has(id)).sort((a, b) => ordemArt(a) - ordemArt(b));
  let md = `# Caderno de lei seca, Bloco II\n\nExportado em ${new Date().toLocaleDateString('pt-BR')}\n`;
  let leiAtual = '';
  for (const id of ids) {
    const a = D.art.get(id);
    if (a.lei !== leiAtual) { leiAtual = a.lei; md += `\n## ${D.lei.get(a.lei).titulo}\n`; }
    md += `\n### ${E.estrelas[id] ? '★ ' : ''}${a.rotulo}${a.epigrafe ? ` · ${a.epigrafe}` : ''}\n`;
    for (const g of E.grifos[id] || []) md += `\n> ${g.t}\n`;
    if (E.notas[id]) md += `\n${E.notas[id].texto}\n`;
  }
  const el = document.createElement('a');
  el.href = URL.createObjectURL(new Blob([md], { type: 'text/markdown' }));
  el.download = `caderno-lei-seca-${hoje()}.md`;
  el.click();
  URL.revokeObjectURL(el.href);
}

// ---------- Questões ----------
let filtroQ = 'todas';

export async function abrirQuestoes(vista, slug) {
  const q = await carregarQuestoes();
  if (!q) { vista.innerHTML = '<div class="pg vazio">As questões ainda não foram publicadas.</div>'; return; }
  const lista = slug ? q.todas.filter(x => x.slug === slug) : q.todas;
  const resp = q.todas.filter(x => E.questoes[x.id]);
  const certas = resp.filter(x => E.questoes[x.id].ok).length;
  vista.innerHTML = `<div class="pg" style="max-width:900px">
    <div class="pg-h"><div><p class="kicker">Questões de treino</p><h1>Questões no estilo VUNESP</h1>
    <p>${resp.length ? `Você respondeu ${resp.length} de ${q.todas.length} e acertou ${certas} (${Math.round(pct(certas, resp.length) * 100)}%).` : `${q.todas.length} questões, cada uma ligada ao artigo que ela cobra.`}</p></div></div>
    <div class="filtros"><a class="chip ${!slug ? 'ativo' : ''}" href="#/questoes">Todas as matérias</a>${q.materias.map(m => `<a class="chip ${m.slug === slug ? 'ativo' : ''}" href="#/questoes/${m.slug}">${esc(m.materia)} (${m.questoes.length})</a>`).join('')}</div>
    <div id="qLista"></div></div>`;
  renderQuestoes($('#qLista'), lista);
}

export function renderQuestoes(el, lista, { semFiltro } = {}) {
  const desenhar = () => {
    const vis = lista.filter(x => filtroQ === 'todas' || (filtroQ === 'novas' ? !E.questoes[x.id] : E.questoes[x.id] && !E.questoes[x.id].ok));
    el.innerHTML = `<div class="filtros" ${semFiltro ? 'style="margin-top:18px"' : ''}>${[['todas', 'Todas'], ['novas', 'Não respondidas'], ['erradas', 'Errei']].map(([k, t]) => `<button type="button" class="chip ${filtroQ === k ? 'ativo' : ''}" data-f="${k}">${t}</button>`).join('')}</div>
      ${vis.length ? vis.map(cartaoQuestao).join('') : '<p class="vazio">Nenhuma questão neste filtro.</p>'}`;
  };
  el.onclick = e => {
    const f = e.target.closest('[data-f]');
    if (f) { filtroQ = f.dataset.f; desenhar(); return; }
    const alt = e.target.closest('.alt');
    if (alt && !alt.disabled) {
      const q = lista.find(x => x.id === alt.dataset.q);
      E.questoes[q.id] = { r: alt.dataset.l, ok: alt.dataset.l === q.gabarito, ts: Date.now() };
      salvar();
      alt.closest('.qst').outerHTML = cartaoQuestao(q);
      return;
    }
    const re = e.target.closest('[data-refazer]');
    if (re) {
      delete E.questoes[re.dataset.refazer];
      salvar();
      re.closest('.qst').outerHTML = cartaoQuestao(lista.find(x => x.id === re.dataset.refazer));
    }
  };
  desenhar();
}

function cartaoQuestao(q) {
  const r = E.questoes[q.id];
  const alts = Object.entries(q.alternativas || {});
  return `<article class="qst">
    <div class="qst-h"><span class="tag">${esc(siglaLei(q.lei))}</span>${q.tema ? `<span>${esc(q.tema)}</span>` : ''}${q.dificuldade ? `<span class="tag">${esc(q.dificuldade)}</span>` : ''}${r ? `<span style="margin-left:auto;font-weight:600;color:${r.ok ? 'var(--ok)' : '#b3261e'}">${r.ok ? 'Acertou' : 'Errou'}</span>` : ''}</div>
    <p class="qst-e">${esc(q.enunciado)}</p>
    <div class="alts">${alts.map(([l, t]) => {
      const cls = r ? (l === q.gabarito ? 'certa' : l === r.r ? 'errada' : '') : '';
      return `<button type="button" class="alt ${cls}" data-q="${esc(q.id)}" data-l="${l}" ${r ? 'disabled' : ''}><b>${l})</b><span>${esc(t)}</span></button>`;
    }).join('')}</div>
    ${r ? `<div class="coment"><b>Gabarito: ${esc(q.gabarito)}.</b> ${esc(q.comentario || '')}
      ${q.artigos?.length ? `<p style="margin:8px 0 0">Artigos: ${linksArtigos(q.artigos, q.lei)}</p>` : ''}
      <p style="margin:8px 0 0"><button type="button" class="btn ghost peq" data-refazer="${esc(q.id)}">Refazer</button></p></div>` : ''}
  </article>`;
}

// ---------- Resumo e mapa mental ----------
export async function renderResumo(el, lei, r) {
  if (!r) { el.innerHTML = '<p class="vazio">O resumo desta norma ainda não foi publicado.</p>'; return; }
  const aviso = await avisoResumos();
  const no = n => `<li><span class="no">${esc(n.titulo)}</span>${n.nota ? `<small>${linkificar(n.nota, lei)}</small>` : ''}${n.artigos ? `<small>${linksArtigos(n.artigos, lei)}</small>` : ''}${n.filhos?.length ? `<ul>${n.filhos.map(no).join('')}</ul>` : ''}</li>`;
  const lista = l => (l?.length ? `<ul>${l.map(x => `<li>${linkificar(x, lei)}</li>`).join('')}</ul>` : '');
  el.innerHTML = `<div class="resumo">
    ${r.visaoGeral ? `<h2>Visão geral</h2>${String(r.visaoGeral).split(/\n\n+/).map(p => `<p>${linkificar(p, lei)}</p>`).join('')}` : ''}
    ${r.mapaMental ? `<h2>Mapa mental</h2><div class="mapa"><ul>${no(r.mapaMental)}</ul></div>` : ''}
    ${r.maisCobrados?.length ? `<h2>O que mais cai</h2>${r.maisCobrados.map(c => `<div class="cobrado">
      <h3>${esc(c.tema || '')} ${c.incidencia ? `<span class="tag inc-${esc(c.incidencia)}">incidência ${esc(c.incidencia)}</span>` : ''}</h3>
      ${c.artigos ? `<p><small>${linksArtigos(c.artigos, lei)}</small></p>` : ''}
      ${c.porQueCai ? `<p>${linkificar(c.porQueCai, lei)}</p>` : ''}
      ${c.pegadinha ? `<p><b>Pegadinha:</b> ${linkificar(c.pegadinha, lei)}</p>` : ''}</div>`).join('')}` : ''}
    ${aviso ? `<p class="dica">${esc(aviso)}</p>` : ''}
    ${r.pegadinhas?.length ? `<h2>Pegadinhas</h2>${lista(r.pegadinhas)}` : ''}
    ${r.dicasDeMemorizacao?.length ? `<h2>Dicas de memorização</h2>${lista(r.dicasDeMemorizacao)}` : ''}
  </div>`;
}

// ---------- Cronograma ----------
let planoCache = null;
export async function planoCronograma() {
  const base = await carregarCronograma();
  if (!base) return null;
  const op = E.config.crono;
  if (!op) return base;
  const chave = JSON.stringify(op);
  if (planoCache?.chave === chave) return planoCache.plano;
  try {
    const { gerarCronograma } = await import('./cronograma/gerar.js');
    const plano = { ...gerarCronograma([...base.unidades.values()], op), unidades: base.unidades };
    planoCache = { chave, plano };
    return plano;
  } catch (e) {
    console.warn(e);
    return base;
  }
}

export function tarefasDoDia(c, iso) {
  for (const s of c.semanas) for (const d of s.dias || []) if (d.data === iso) return d.tarefas || [];
  return [];
}

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export async function abrirCronograma(vista) {
  const c = await planoCronograma();
  if (!c) { vista.innerHTML = '<div class="pg vazio">O cronograma ainda não foi publicado.</div>'; return; }
  const h = hoje();
  const p = c.premissas || {};
  const r = c.resumo || {};
  const fmt = iso => (iso ? new Date(iso + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '');
  const semanas = c.semanas.map(s => {
    const ts = (s.dias || []).flatMap(d => d.tarefas || []);
    const feitas = ts.filter(t => E.tarefas[t.id]).length;
    const atual = s.inicio <= h && h <= s.fim;
    return `<details class="semana ${atual ? 'atual' : ''}" ${atual ? 'open' : ''}><summary>Semana ${s.n} · ${fmt(s.inicio)} a ${fmt(s.fim)} <small class="dica" style="font-weight:400">${esc(s.fase || '')}</small>${barra(pct(feitas, ts.length))}<small class="dica">${feitas}/${ts.length}</small></summary>
      <div class="sem-c">${(s.dias || []).map(d => `<div class="dia ${d.data === h ? 'hoje' : ''}"><h4>${new Date(d.data + 'T12:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })}${d.data === h ? ' · hoje' : ''}${d.minutos ? ` · ${Math.round(d.minutos / 6) / 10} h` : ''}</h4>
        ${(d.tarefas || []).length ? `<ul class="lista-tarefas">${d.tarefas.map(t => itemTarefa(c, t)).join('')}</ul>` : '<p class="dica">Descanso.</p>'}</div>`).join('')}</div></details>`;
  }).join('');
  const mpd = p.minutosPorDia || [60, 120, 120, 120, 120, 120, 240];
  vista.innerHTML = `<div class="pg" style="max-width:960px">
    <div class="pg-h"><div><p class="kicker">Cronograma</p><h1>Plano até a prova</h1>
    <p>${r.semanas ? `${r.semanas} semanas, cerca de ${r.horasTotais} horas. ` : ''}${r.fimPrimeiraLeitura ? `Primeira leitura termina em ${fmt(r.fimPrimeiraLeitura)}. ` : ''}${r.inicioRetaFinal ? `Reta final a partir de ${fmt(r.inicioRetaFinal)}.` : ''}</p></div></div>
    ${(c.avisos || []).map(a => `<p class="nt box" style="background:var(--warn-soft);padding:10px 14px;border-radius:8px">${esc(a)}</p>`).join('')}
    <details class="card" style="margin-bottom:18px"><summary style="cursor:pointer;font-weight:600">Ajustar datas e horas de estudo</summary>
      <form id="formCrono" style="margin-top:14px">
        <div class="linha" style="gap:16px;margin-bottom:12px">
          <label>Início <input type="date" name="inicio" value="${esc(p.inicio || h)}"></label>
          <label>Prova <input type="date" name="dataProva" value="${esc(p.dataProva || '')}"></label>
        </div>
        <p class="dica">Horas de estudo em cada dia da semana:</p>
        <div class="linha" style="gap:10px;margin-bottom:12px">${DIAS.map((d, i) => `<label style="display:grid;gap:2px;font-size:13px">${d}<input type="number" name="m${i}" min="0" max="12" step="0.5" value="${mpd[i] / 60}" style="width:64px"></label>`).join('')}</div>
        <div class="linha"><button class="btn" type="submit">Recalcular cronograma</button>${E.config.crono ? '<button class="btn ghost" type="button" id="cronoPadrao">Voltar ao plano padrão</button>' : ''}</div>
        <p class="dica" style="margin-top:8px">As tarefas já marcadas como feitas continuam marcadas depois de recalcular.</p>
      </form></details>
    ${semanas}
  </div>`;
  ligarTarefas(vista);
  $('#formCrono').onsubmit = async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const op = { ...p, inicio: f.get('inicio'), dataProva: f.get('dataProva'), minutosPorDia: DIAS.map((_, i) => Math.round((+f.get('m' + i) || 0) * 60)) };
    try {
      const { gerarCronograma } = await import('./cronograma/gerar.js');
      gerarCronograma([...(await carregarCronograma()).unidades.values()], op);
    } catch (err) {
      toast(`Não deu para recalcular: ${err.message}`);
      return;
    }
    E.config.crono = op;
    definirProva(op.dataProva);
    salvar();
    toast('Cronograma recalculado.');
    abrirCronograma(vista);
  };
  const bp = $('#cronoPadrao');
  if (bp) bp.onclick = () => { delete E.config.crono; definirProva(); salvar(); abrirCronograma(vista); };
  $('.semana.atual')?.scrollIntoView({ block: 'start' });
}

