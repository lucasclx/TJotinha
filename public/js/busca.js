import { D, esc, norm, indiceBusca, siglaLei } from './dados.js';
import { $ } from './dom.js';
import { linkArt } from './app.js';
import { destacar } from './leitor.js';

let res = [], sel = 0, q = '';

export function iniciarBusca() {
  $('#buscaEscopo').innerHTML += D.normas.map(n => `<option value="${n.id}">${esc(n.titulo)}</option>`).join('');
  $('#buscaQ').addEventListener('input', buscar);
  $('#buscaEscopo').addEventListener('change', buscar);
  $('#buscaQ').addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); marcar(sel + 1); }
    if (e.key === 'ArrowUp') { e.preventDefault(); marcar(sel - 1); }
    if (e.key === 'Enter' && res[sel]) { e.preventDefault(); abrir(res[sel].id); }
  });
  $('#buscaRes').addEventListener('click', e => {
    const a = e.target.closest('[data-id]');
    if (a) { e.preventDefault(); abrir(a.dataset.id); }
  });
  $('#dlgBusca').addEventListener('click', e => { if (e.target === $('#dlgBusca')) $('#dlgBusca').close(); });
}

export function abrirBusca() {
  const lei = location.hash.split('/')[1] === 'lei' ? location.hash.split('/')[2] : '';
  if (!$('#dlgBusca').open) {
    $('#buscaEscopo').value = D.lei.has(lei) ? lei : '';
    $('#dlgBusca').showModal();
  }
  $('#buscaQ').select();
  indiceBusca();
  buscar();
}

function abrir(id) {
  destacar(q);
  $('#dlgBusca').close();
  location.hash = linkArt(id);
}

function marcar(i) {
  const itens = [...$('#buscaRes').querySelectorAll('.br')];
  if (!itens.length) return;
  sel = Math.max(0, Math.min(itens.length - 1, i));
  itens.forEach((el, k) => el.classList.toggle('sel', k === sel));
  itens[sel].scrollIntoView({ block: 'nearest' });
}

function trecho(t, n, termos) {
  let p = -1;
  for (const termo of termos) { p = n.indexOf(termo); if (p >= 0) break; }
  const ini = Math.max(0, p - 60);
  let s = (ini ? '…' : '') + t.slice(ini, ini + 240);
  let h = esc(s);
  for (const termo of termos) {
    const re = new RegExp(termo.split('').map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[\\u0300-\\u036f]*'), 'gi');
    h = h.normalize('NFD').replace(re, m => `<mark class="busca">${m}</mark>`).normalize('NFC');
  }
  return h;
}

async function buscar() {
  q = $('#buscaQ').value.trim();
  const escopo = $('#buscaEscopo').value;
  const box = $('#buscaRes');
  if (!q) {
    box.innerHTML = `<p class="dica" style="padding:14px">Digite um termo (“peculato”, “citação por edital”), um artigo (“art. 312”) ou combine (“312 cp”).</p>`;
    $('#buscaInfo').textContent = '';
    res = [];
    return;
  }
  const lista = await indiceBusca();
  if (q !== $('#buscaQ').value.trim()) return;
  const nq = norm(q);
  const termos = nq.split(/\s+/).filter(Boolean);

  // "art. 312", "312", "312 cp", "art 1.189 nscgj"
  const mArt = nq.match(/^(?:art(?:igo)?\.?\s*)?(\d[\d.]*(?:-?[a-z])?)\b\s*(.*)$/);
  let exatos = [];
  if (mArt) {
    const num = mArt[1].replace(/\./g, '').replace(/-?([a-z])$/, '-$1').toUpperCase();
    const leiQ = mArt[2].replace(/[^a-z0-9]/g, '');
    exatos = D.normas
      .filter(n => !escopo || n.id === escopo)
      .filter(n => !leiQ || n.id.startsWith(leiQ) || norm(siglaLei(n.id)).replace(/[^a-z0-9]/g, '').startsWith(leiQ))
      .map(n => `${n.id}-${num}`)
      .filter(id => D.art.has(id));
  }

  const achados = [];
  for (const x of lista) {
    if (escopo && x.lei !== escopo) continue;
    if (exatos.includes(x.id)) continue;
    if (!termos.every(t => x.n.includes(t))) continue;
    const a = D.art.get(x.id);
    const tit = D.lei.get(a.lei).titulos.find(t => t.id === a.titulo);
    const cab = norm(`${a.rotulo} ${a.epigrafe} ${tit ? tit.rotulo : ''}`);
    let pontos = termos.length > 1 && x.n.includes(nq) ? 30 : 0;
    if (termos.length > 1 && cab.includes(nq)) pontos += 30;
    for (const t of termos) { if (cab.includes(t)) pontos += 10; pontos += Math.min(5, x.n.split(t).length - 1); }
    achados.push({ x, pontos });
  }
  achados.sort((a, b) => b.pontos - a.pontos);
  res = [...exatos.map(id => ({ id, x: lista.find(y => y.id === id) })), ...achados.slice(0, 80).map(a => ({ id: a.x.id, x: a.x }))];
  $('#buscaInfo').textContent = `${exatos.length + achados.length} resultado${exatos.length + achados.length === 1 ? '' : 's'}`;
  box.innerHTML = res.length ? res.map(r => {
    const a = D.art.get(r.id);
    return `<a class="br" href="${linkArt(r.id)}" data-id="${r.id}"><div class="br-h">${esc(a.rotulo)}${a.epigrafe ? `<span class="ep">${esc(a.epigrafe)}</span>` : ''}<small>${esc(siglaLei(a.lei))}</small></div><p>${r.x ? trecho(r.x.t, r.x.n, termos) : ''}</p></a>`;
  }).join('') : '<p class="vazio">Nada encontrado. Tente outra palavra ou tire o filtro de norma.</p>';
  sel = 0;
  marcar(0);
}
