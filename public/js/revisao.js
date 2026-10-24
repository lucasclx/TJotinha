import { E, avaliar, pendentes, proximoIntervalo } from './estado.js';
import { D, esc, artigoHTML, siglaLei } from './dados.js';
import { $ } from './dom.js';
import { linkArt, atualizarLateral, lidosDe } from './app.js';

let S = null; // sessão: {fila, i, mostrado, feitos, acertos, titulo, repetidos}

// Números, prazos, frações e espécies de pena: o que mais cai em lei seca.
const NUM = '(?:\\d+(?:[.,]\\d+)?(?:\\s*\\([^)]{2,40}\\))?|um|uma|dois|duas|três|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|treze|quatorze|catorze|quinze|dezesseis|dezessete|dezoito|dezenove|vinte|trinta|quarenta|quarenta e cinco|cinquenta|sessenta|noventa|cento e vinte|cento e oitenta|cem|trezentos e sessenta e cinco)';
const UNID = '(?:dias?(?: úteis| corridos)?|anos?|meses|mês|horas?|minutos?|sessões|vezes|salários?[- ]mínimos?)';
const LACUNA = new RegExp(
  `\\b${NUM}(?:\\s+(?:a|e|até)\\s+${NUM})?\\s+${UNID}\\b` +
  `|\\b(?:um|dois)\\s+terços?\\b|\\b(?:um\\s+)?(?:sexto|quinto|quarto)\\b|\\bsexta parte\\b|\\bmetade\\b|\\bdobro\\b|\\btriplo\\b` +
  `|\\b(?:reclusão|detenção)\\b`,
  'gi');

function lacunas(el) {
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
    acceptNode: n => (n.parentElement.closest('.al,.dl,.epi,.epi-in,.an,.nt') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  const achados = [];
  while (w.nextNode()) {
    const t = w.currentNode;
    LACUNA.lastIndex = 0;
    let m;
    while ((m = LACUNA.exec(t.data))) achados.push({ t, i: m.index, n: m[0].length });
  }
  let escolhidos = achados;
  if (achados.length > 6) {
    const passo = achados.length / 6;
    escolhidos = Array.from({ length: 6 }, (_, k) => achados[Math.floor(k * passo)]);
  }
  for (const a of escolhidos.reverse()) {
    const meio = a.t.splitText(a.i);
    meio.splitText(a.n);
    const s = document.createElement('span');
    s.className = 'lac';
    s.title = 'Clique para revelar';
    meio.parentNode.insertBefore(s, meio);
    s.append(meio);
  }
  return escolhidos.length;
}

function embaralhar(l) {
  for (let i = l.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [l[i], l[j]] = [l[j], l[i]]; }
  return l;
}

export function abrirRevisao(vista, lei) {
  if (lei && D.lei.has(lei)) {
    const ids = D.lei.get(lei).artigos.map(a => a.id);
    const prior = embaralhar(ids.filter(id => E.estrelas[id]));
    const lidos = embaralhar(ids.filter(id => E.lidos[id] && !E.estrelas[id]));
    const resto = embaralhar(ids.filter(id => !E.lidos[id] && !E.estrelas[id]));
    S = { fila: [...prior, ...lidos, ...resto].slice(0, 20), i: 0, feitos: 0, acertos: 0, titulo: `Treino: ${D.lei.get(lei).titulo}`, repetidos: new Set() };
  } else {
    S = { fila: pendentes().filter(id => D.art.has(id)), i: 0, feitos: 0, acertos: 0, titulo: 'Revisão de hoje', repetidos: new Set() };
  }
  vista.innerHTML = `<div class="pg"><div class="rev">
    <div class="pg-h"><div><p class="kicker">Revisão espaçada</p><h1>${esc(S.titulo)}</h1>
    <p>Os artigos voltam em intervalos cada vez maiores conforme você acerta. Prazos, números e penas viram lacunas para você completar de cabeça.</p></div></div>
    <div id="revArea"></div></div></div>`;
  mostrarCartao();
}

function telaFim() {
  const area = $('#revArea');
  const normas = D.normas.map(n => {
    const ids = n.artigos.map(a => a.id);
    return `<a class="chip" href="#/revisao/${n.id}">${esc(siglaLei(n.id))} <small>(${lidosDe(ids)} lidos)</small></a>`;
  }).join('');
  area.innerHTML = `<div class="rev-card">
    ${S.feitos ? `<h2 class="rev-q">Sessão concluída</h2><p>${S.feitos} cartões revisados, ${S.acertos} lembrados de primeira.</p>` :
      `<h2 class="rev-q">Nada pendente por agora</h2><p class="dica">Os artigos que você marca como lido entram aqui no dia seguinte (dá para desligar em Ajustes). Também dá para incluir qualquer artigo com o botão de revisão ao lado dele.</p>`}
    <h3 style="margin-top:22px">Treino livre por norma</h3>
    <p class="dica">20 artigos sorteados, começando pelos marcados com estrela e pelos já lidos.</p>
    <div class="filtros">${normas}</div>
  </div>`;
  atualizarLateral();
}

async function mostrarCartao() {
  const area = $('#revArea');
  if (!area) return;
  if (S.i >= S.fila.length) return telaFim();
  const id = S.fila[S.i];
  const a = D.art.get(id);
  const n = D.lei.get(a.lei);
  const html = await artigoHTML(id);
  const corpo = document.createElement('div');
  corpo.className = 'lei-texto';
  corpo.innerHTML = html;
  const art = corpo.firstElementChild;
  art.removeAttribute('id');
  art.querySelector('.epi')?.remove();
  const nLac = lacunas(art);
  S.mostrado = false;
  S.modo = nLac ? 'lacunas' : 'recordar';
  if (!nLac) {
    const cap = art.querySelector('.cap');
    const dica = cap ? cap.textContent.replace(/^Art\.?\s*[\d.ºo-]+[A-Z]?\s*[-–.]?\s*/i, '').split(/\s+/).slice(0, 7).join(' ') : '';
    art.classList.add('oculto-recordar');
    S.dica = dica;
  }
  const c = E.revisao[id];
  area.innerHTML = `<div class="rev-meta"><span>Cartão ${S.i + 1} de ${S.fila.length}${c?.reps ? ` · revisado ${c.reps}×` : ' · primeira vez'}</span><a href="${linkArt(id)}">Abrir no texto da lei</a></div>
    <div class="rev-card">
      <p class="kicker">${esc(n.titulo)}</p>
      <h2 class="rev-q">${esc(a.rotulo)}${a.epigrafe ? ` · ${esc(a.epigrafe)}` : ''}</h2>
      <p class="rev-modo">${S.modo === 'lacunas' ? `Complete as ${nLac} lacunas de cabeça e depois revele.` : `Lembre o que diz este artigo${S.dica ? `. Começa com: “${esc(S.dica)}…”` : ''}`}</p>
      <div id="revCorpo"></div>
    </div>
    <div id="revAcoes"><button class="btn rev-mostrar" id="btnMostrar" type="button">Mostrar resposta <kbd>Espaço</kbd></button></div>`;
  $('#revCorpo').append(corpo);
  $('#revCorpo').onclick = e => { const l = e.target.closest('.lac'); if (l) l.classList.add('ver'); };
  $('#btnMostrar').onclick = revelar;
}

function revelar() {
  if (S.mostrado) return;
  S.mostrado = true;
  document.querySelectorAll('#revCorpo .lac').forEach(l => l.classList.add('ver'));
  document.querySelector('#revCorpo .oculto-recordar')?.classList.remove('oculto-recordar');
  const c = E.revisao[S.fila[S.i]];
  const rot = d => (d === 1 ? 'amanhã' : `${d} dias`);
  $('#revAcoes').innerHTML = `<div class="rev-resp">${['Errei', 'Difícil', 'Bom', 'Fácil'].map((t, k) =>
    `<button type="button" data-r="${k}">${t}<small>${k === 0 ? 'repete hoje e amanhã' : rot(proximoIntervalo(c, k))}</small><small><kbd>${k + 1}</kbd></small></button>`).join('')}</div>`;
  $('#revAcoes').onclick = e => { const b = e.target.closest('[data-r]'); if (b) responder(+b.dataset.r); };
}

function responder(nota) {
  const id = S.fila[S.i];
  avaliar(id, nota);
  S.feitos++;
  if (nota >= 2 && !S.repetidos.has(id)) S.acertos++;
  if (nota === 0 && !S.repetidos.has(id)) { S.fila.push(id); S.repetidos.add(id); }
  S.i++;
  atualizarLateral();
  mostrarCartao();
  window.scrollTo({ top: 0 });
}

export function teclaRevisao(e) {
  if (!S || !$('#revArea')) return false;
  if (e.key === ' ' || e.key === 'Enter') { if (!S.mostrado && S.i < S.fila.length) { revelar(); return true; } return false; }
  if (S.mostrado && ['1', '2', '3', '4'].includes(e.key)) { responder(+e.key - 1); return true; }
  return false;
}
