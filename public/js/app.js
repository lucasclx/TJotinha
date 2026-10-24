import { $, $$ } from './dom.js';
import { E, salvar, salvarJa, substituir, zerar, hoje, somarDias, diasEntre, pendentes, sequencia } from './estado.js';
import { D, esc, carregarIndice, carregarQuestoes, carregarCronograma, siglaLei, artigosDoIntervalo } from './dados.js';
import { abrirLeitor, fecharLeitor, teclaLeitor } from './leitor.js';
import { abrirRevisao, teclaRevisao } from './revisao.js';
import { abrirCaderno, abrirQuestoes, abrirCronograma, tarefasDoDia, planoCronograma } from './extras.js';
import { abrirBusca, iniciarBusca } from './busca.js';

const vista = $('#vista');

export let dataProva = '2027-03-14';
let provaCapa = dataProva;
export function definirProva(iso) { dataProva = iso || provaCapa; }

// ---------- Utilidades de interface ----------
let toastT;
export function toast(msg, acao) {
  const t = $('#toast');
  t.innerHTML = `<span>${esc(msg)}</span>`;
  if (acao) {
    const b = document.createElement('button');
    b.textContent = acao.rotulo;
    b.onclick = () => { t.hidden = true; acao.fn(); };
    t.append(b);
  }
  t.hidden = false;
  clearTimeout(toastT);
  toastT = setTimeout(() => (t.hidden = true), acao ? 7000 : 3000);
}

export function barra(p) { return `<span class="barra"><i style="width:${Math.round(p * 100)}%"></i></span>`; }
export const pct = (a, b) => (b ? a / b : 0);
export const lidosDe = ids => ids.reduce((n, id) => n + (E.lidos[id] ? 1 : 0), 0);

export function quandoFoi(ts) {
  const min = Math.round((Date.now() - ts) / 6e4);
  if (min < 1) return 'agora há pouco';
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? 'ontem' : `há ${d} dias`;
}

export function linkArt(id) {
  const a = D.art.get(id);
  return a ? `#/lei/${a.lei}/${id}` : '#/painel';
}

// ---------- Barra lateral ----------
export function atualizarLateral() {
  const rota = location.hash.split('/')[1] || 'painel';
  const leiAtual = rota === 'lei' ? location.hash.split('/')[2] : null;
  $$('.side-nav a').forEach(a => a.classList.toggle('ativo', a.dataset.rota === rota));
  const abertas = new Set($$('#arvore details[open]').map(d => d.dataset.m));
  const primeiraVez = !$('#arvore').children.length;
  $('#arvore').innerHTML = D.materias.map((m, i) => {
    const normas = m.normas.map(id => D.lei.get(id));
    const tot = normas.reduce((s, n) => s + n.artigos.length, 0);
    const lid = normas.reduce((s, n) => s + lidosDe(n.artigos.map(a => a.id)), 0);
    const aberta = abertas.has(m.id) || normas.some(n => n.id === leiAtual) || (primeiraVez && i === 0);
    return `<details class="mt" data-m="${m.id}" ${aberta ? 'open' : ''}><summary>${esc(m.titulo)}<span class="mt-p">${Math.round(pct(lid, tot) * 100)}%</span></summary>
      ${normas.map(n => {
        const l = lidosDe(n.artigos.map(a => a.id));
        return `<a class="lk ${n.id === leiAtual ? 'ativo' : ''}" href="#/lei/${n.id}"><span class="lk-t">${esc(n.titulo)}</span><span class="lk-b">${barra(pct(l, n.artigos.length))}${l}/${n.artigos.length}</span></a>`;
      }).join('')}</details>`;
  }).join('');
  const p = pendentes().length;
  $('#badgeRevisao').hidden = !p;
  $('#badgeRevisao').textContent = p;
  const u = E.ultimo;
  $('#btnContinuar').hidden = !u || !D.art.has(u.art) || leiAtual === u.lei;
  if (u) $('#btnContinuar').href = linkArt(u.art);
}

// ---------- Painel ----------
async function abrirPainel() {
  const total = D.total;
  const lidos = Object.keys(E.lidos).filter(id => D.art.has(id)).length;
  const h = hoje();
  const dia = E.dias[h] || { l: 0, r: 0 };
  const meta = E.config.meta;
  const faltam = diasEntre(h, dataProva);
  const alvo = somarDias(dataProva, -30);
  const diasAlvo = Math.max(1, diasEntre(h, alvo));
  const restantes = total - lidos;
  const porDia = Math.ceil(restantes / diasAlvo);
  const pend = pendentes().length;
  const seq = sequencia();
  const u = E.ultimo && D.art.has(E.ultimo.art) ? E.ultimo : null;
  const ua = u && D.art.get(u.art);
  const primeira = D.normas[0];

  vista.innerHTML = `<div class="pg">
    <div class="pg-h"><div><p class="kicker">${esc(D.capa.kicker)}</p><h1>${faltam > 0 ? `Faltam ${faltam} dias para a prova` : 'Dia da prova!'}</h1>
    <p>${lidos ? `Você já leu ${lidos} de ${total} artigos do Bloco II.` : `São ${total} artigos em 14 normas. Comece pelo primeiro e o site guarda onde você parou.`}</p></div></div>

    <div class="grid" style="margin-bottom:16px">
      <section class="card continuar">
        <div class="c-t">${u ? `<p class="kicker">Continuar de onde parei · ${quandoFoi(u.ts)}</p>
          <h3>${esc(siglaLei(u.lei))}, ${esc(ua.rotulo)}${ua.epigrafe ? ` · ${esc(ua.epigrafe)}` : ''}</h3>
          <p>${esc(D.lei.get(u.lei).titulo)} · ${lidosDe(D.lei.get(u.lei).artigos.map(a => a.id))} de ${D.lei.get(u.lei).artigos.length} artigos lidos</p>`
          : `<p class="kicker">Por onde começar</p><h3>${esc(primeira.titulo)}</h3><p>${esc(primeira.recorte)}</p>`}</div>
        <a class="btn" href="${u ? linkArt(u.art) : `#/lei/${primeira.id}`}"><svg viewBox="0 0 20 20"><path d="M7 5l6 5-6 5z"/></svg>${u ? 'Continuar leitura' : 'Começar'}</a>
      </section>
    </div>

    <div class="grid g4" style="margin-bottom:16px">
      <section class="card stat"><h2>Leitura total</h2><b>${Math.round(pct(lidos, total) * 100)}%</b><span>${lidos} de ${total} artigos</span>${barra(pct(lidos, total))}</section>
      <section class="card stat"><h2>Meta de hoje</h2><div class="stat-r"><div class="anel" style="--p:${Math.min(100, Math.round(pct(dia.l, meta) * 100))}"><span>${dia.l}/${meta}</span></div><span>${dia.l >= meta ? 'Meta batida. Boa!' : `Faltam ${meta - dia.l} artigos`}${dia.r ? `<br>${dia.r} revisões feitas` : ''}</span></div></section>
      <section class="card stat"><h2>Revisões para hoje</h2><b>${pend}</b><span>${pend ? 'artigos esperando revisão' : 'nada pendente'}</span>${pend ? '<p style="margin:10px 0 0"><a class="btn peq" href="#/revisao">Revisar agora</a></p>' : ''}</section>
      <section class="card stat"><h2>Sequência</h2><b>${seq} ${seq === 1 ? 'dia' : 'dias'}</b><span>${seq ? 'estudando sem falhar' : 'estude hoje para começar'}</span></section>
    </div>

    <div class="grid g2">
      <section class="card"><h2>Progresso por matéria</h2><div class="mat-prog">${D.materias.map(m => {
        const ns = m.normas.map(id => D.lei.get(id));
        const tot = ns.reduce((s, n) => s + n.artigos.length, 0);
        const lid = ns.reduce((s, n) => s + lidosDe(n.artigos.map(a => a.id)), 0);
        return `<div><div class="mp-h">${esc(m.titulo)}<span>${lid}/${tot}</span></div>${barra(pct(lid, tot))}
          <div class="mp-leis">${ns.map(n => { const l = lidosDe(n.artigos.map(a => a.id)); return `<a class="mp-lei" href="#/lei/${n.id}"><span class="mp-n">${esc(n.titulo)}</span>${barra(pct(l, n.artigos.length))}<em>${l}/${n.artigos.length}</em></a>`; }).join('')}</div></div>`;
      }).join('')}</div></section>
      <div class="grid" style="align-content:start">
        <section class="card" id="cardCrono" hidden></section>
        <section class="card"><h2>Ritmo sugerido</h2><p class="ritmo">${restantes <= 0 ? 'Você já leu tudo. Agora é revisão e questões até a prova.' :
          `Para terminar a primeira leitura até <b>${new Date(alvo + 'T12:00').toLocaleDateString('pt-BR')}</b> (um mês antes da prova, sobrando tempo para revisar), leia cerca de <b>${porDia} artigos por dia</b>. Sua meta diária está em ${meta}${porDia > meta ? ', abaixo do necessário. Ajuste em <a href="#" id="lnkMeta">Ajustes</a>.' : '.'}`}</p></section>
        <section class="card"><h2>Últimas 12 semanas</h2>${mapaCalor()}</section>
      </div>
    </div>
  </div>`;
  const lm = $('#lnkMeta');
  if (lm) lm.onclick = e => { e.preventDefault(); abrirConfig(); };

  const c = await planoCronograma();
  if (c && location.hash.startsWith('#/painel')) {
    const card = $('#cardCrono');
    let dia = h, t = tarefasDoDia(c, h);
    for (let i = 1; !t.length && i <= 14; i++) { dia = somarDias(h, i); t = tarefasDoDia(c, dia); }
    const titulo = dia === h ? 'Hoje no cronograma' : `Próximo dia do cronograma · ${new Date(dia + 'T12:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })}`;
    card.hidden = false;
    card.innerHTML = `<h2>${titulo}</h2>${t.length ? `<ul class="lista-tarefas">${t.map(x => itemTarefa(c, x)).join('')}</ul>` : '<p class="dica">Nenhuma tarefa nos próximos dias.</p>'}<p style="margin:12px 0 0"><a class="btn ghost peq" href="#/cronograma">Ver cronograma completo</a></p>`;
    ligarTarefas(card);
  }
}

export function itemTarefa(c, t) {
  const un = (t.unidades || (t.unidadeId ? [t.unidadeId] : [])).map(id => c.unidades.get(id)).filter(Boolean);
  if (!un.length && t.leiId) un.push({ leiId: t.leiId, de: t.de, ate: t.ate, titulo: D.lei.get(t.leiId)?.titulo });
  const links = un.map(u => {
    const ids = artigosDoIntervalo(u.leiId, u.de, u.ate);
    const l = lidosDe(ids);
    return `<a href="${u.de && D.art.has(u.de) ? linkArt(u.de) : `#/lei/${u.leiId}`}">${esc(u.titulo || u.lei)}</a> <small class="dica">(${l}/${ids.length} lidos)</small>`;
  }).join('<br>');
  return `<li class="${E.tarefas[t.id] ? 'feito' : ''}"><input type="checkbox" data-t="${esc(t.id)}" ${E.tarefas[t.id] ? 'checked' : ''}><span><span class="tag">${esc(t.tipo || 'estudo')}</span>${esc(t.descricao || '')}${t.minutos ? ` <small class="dica">· ${t.minutos} min</small>` : ''}${links ? `<br>${links}` : ''}</span></li>`;
}
export function ligarTarefas(el) {
  el.addEventListener('change', e => {
    const id = e.target.dataset.t;
    if (!id) return;
    if (e.target.checked) E.tarefas[id] = Date.now(); else delete E.tarefas[id];
    e.target.closest('li').classList.toggle('feito', e.target.checked);
    salvar();
  });
}

function mapaCalor() {
  const h = hoje();
  const fimSemana = somarDias(h, 6 - new Date(h + 'T12:00').getDay());
  const inicio = somarDias(fimSemana, -83);
  let cel = '';
  for (let i = 0; i < 84; i++) {
    const d = somarDias(inicio, i);
    const x = E.dias[d];
    const n = x ? x.l + x.r : 0;
    const nv = d > h ? -1 : n === 0 ? 0 : n <= 10 ? 1 : n <= 30 ? 2 : 3;
    cel += `<i data-n="${nv}" title="${new Date(d + 'T12:00').toLocaleDateString('pt-BR')}: ${x ? `${x.l} lidos, ${x.r} revisões` : 'sem estudo'}"${nv < 0 ? ' style="visibility:hidden"' : ''}></i>`;
  }
  return `<div class="heat">${cel}</div><div class="heat-leg"><span>12 semanas atrás</span><span>hoje</span></div>`;
}

// ---------- Ajustes ----------
function abrirConfig() {
  const c = E.config;
  $('#cfMeta').value = c.meta;
  $('#cfFonte').value = c.fonte;
  $('#cfFonteV').textContent = c.fonte + 'px';
  $('#cfTema').value = c.tema;
  $('#cfAuto').checked = c.revisaoAuto;
  $('#cfAn').checked = c.ocultarAn;
  $('#dlgConfig').showModal();
}
function aplicarConfig() {
  const c = E.config;
  const r = document.documentElement;
  if (c.tema === 'auto') delete r.dataset.theme; else r.dataset.theme = c.tema;
  r.style.setProperty('--fs', c.fonte + 'px');
  document.body.classList.toggle('sem-an', c.ocultarAn);
}
function ligarConfig() {
  $('#btnConfig').onclick = abrirConfig;
  $('#btnAtalhos').onclick = () => $('#dlgAtalhos').showModal();
  $('#cfMeta').onchange = e => { E.config.meta = Math.max(1, +e.target.value || 30); salvar(); rotear(); };
  $('#cfFonte').oninput = e => { E.config.fonte = +e.target.value; $('#cfFonteV').textContent = e.target.value + 'px'; aplicarConfig(); salvar(); };
  $('#cfTema').onchange = e => { E.config.tema = e.target.value; aplicarConfig(); salvar(); };
  $('#cfAuto').onchange = e => { E.config.revisaoAuto = e.target.checked; salvar(); };
  $('#cfAn').onchange = e => { E.config.ocultarAn = e.target.checked; aplicarConfig(); salvar(); };
  $('#btnTema').onclick = () => {
    const escuro = E.config.tema === 'dark' || (E.config.tema === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
    E.config.tema = escuro ? 'light' : 'dark';
    aplicarConfig();
    salvar();
  };
  $('#cfExportar').onclick = () => {
    salvarJa();
    const blob = new Blob([JSON.stringify(E, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `tjotinha-backup-${hoje()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  $('#cfImportar').onchange = async e => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const d = JSON.parse(await f.text());
      if (!d || typeof d !== 'object' || !('lidos' in d)) throw new Error('formato');
      if (!confirm('Substituir o progresso atual por este backup?')) return;
      substituir(d);
      aplicarConfig();
      $('#dlgConfig').close();
      toast('Backup importado.');
      rotear();
    } catch (err) {
      alert('Este arquivo não parece um backup do TJotinha.');
    }
    e.target.value = '';
  };
  $('#cfZerar').onclick = () => {
    if (!confirm('Apagar todo o progresso, grifos e notas deste navegador? Não dá para desfazer (a não ser que você tenha um backup).')) return;
    zerar();
    aplicarConfig();
    $('#dlgConfig').close();
    rotear();
  };
}

// ---------- Rotas ----------
export async function rotear() {
  const h = decodeURIComponent(location.hash || '');
  // Âncoras antigas do HTML original (#cp, #cp-293) viram rotas do leitor.
  if (h && !h.startsWith('#/')) {
    const id = h.slice(1);
    if (D.art.has(id)) return location.replace(linkArt(id));
    if (D.lei.has(id)) return location.replace(`#/lei/${id}`);
    const lei = id.split('-')[0];
    if (D.lei.has(lei)) return location.replace(`#/lei/${lei}/${id}`);
    return location.replace('#/painel');
  }
  const [, rota = 'painel', a, b] = h.split('/');
  if (rota !== 'lei') fecharLeitor();
  if (rota === 'lei' && D.lei.has(a)) await abrirLeitor(vista, a, b);
  else if (rota === 'revisao') abrirRevisao(vista, a);
  else if (rota === 'caderno') abrirCaderno(vista, a);
  else if (rota === 'questoes') await abrirQuestoes(vista, a);
  else if (rota === 'cronograma') await abrirCronograma(vista);
  else { if (rota !== 'painel') history.replaceState(null, '', '#/painel'); await abrirPainel(); }
  if (rota !== 'lei') window.scrollTo(0, 0);
  atualizarLateral();
}

// ---------- Teclado ----------
function digitando(e) {
  const t = e.target;
  return t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName);
}
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); abrirBusca(); return; }
  if (digitando(e) || e.ctrlKey || e.metaKey || e.altKey || document.querySelector('dialog[open]')) return;
  if (e.key === '/') { e.preventDefault(); abrirBusca(); return; }
  if (e.key === '?') { $('#dlgAtalhos').showModal(); return; }
  const rota = location.hash.split('/')[1];
  if (rota === 'lei' && teclaLeitor(e)) { e.preventDefault(); return; }
  if (rota === 'revisao' && teclaRevisao(e)) { e.preventDefault(); return; }
  if (e.key.toLowerCase() === 'c' && E.ultimo && D.art.has(E.ultimo.art)) location.hash = linkArt(E.ultimo.art);
});

// ---------- Início ----------
async function iniciar() {
  aplicarConfig();
  try {
    await carregarIndice();
  } catch (e) {
    vista.innerHTML = '<div class="pg vazio">Não foi possível carregar o conteúdo. Recarregue a página.</div>';
    return;
  }
  const m = D.capa.kicker.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) provaCapa = dataProva = `${m[3]}-${m[2]}-${m[1]}`;
  if (E.config.crono?.dataProva) dataProva = E.config.crono.dataProva;
  const c = await carregarCronograma();
  $('#navCronograma').hidden = !c;
  carregarQuestoes().then(q => { $('#navQuestoes').hidden = !q; });
  ligarConfig();
  iniciarBusca();
  $('#btnBusca').onclick = abrirBusca;
  window.addEventListener('hashchange', rotear);
  if (!location.hash) history.replaceState(null, '', '#/painel');
  await rotear();
}
iniciar();
