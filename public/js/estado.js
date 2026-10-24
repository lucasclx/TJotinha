// Progresso do estudo, salvo só no navegador (localStorage).
const CHAVE = 'tjotinha:v1';

function padrao() {
  return {
    versao: 1,
    lidos: {},      // artId -> timestamp
    estrelas: {},   // artId -> timestamp
    grifos: {},     // artId -> [{s, e, c, t}] (offsets no texto do artigo, cor, trecho)
    notas: {},      // artId -> {texto, ts}
    revisao: {},    // artId -> {due, int, ease, reps, lapses}
    ultimo: null,   // {lei, art, ts}
    posLei: {},     // lei -> artId
    dias: {},       // 'AAAA-MM-DD' -> {l: lidos, r: revisões}
    questoes: {},   // questaoId -> {r, ok, ts}
    tarefas: {},    // tarefaId do cronograma -> timestamp
    config: { meta: 30, tema: 'auto', fonte: 17, revisaoAuto: true, ocultarAn: false },
  };
}

function completar(d) {
  const p = padrao();
  for (const k of Object.keys(p)) if (d[k] === undefined || d[k] === null && k !== 'ultimo') d[k] = p[k];
  d.config = { ...p.config, ...d.config };
  return d;
}

function carregar() {
  try {
    const d = JSON.parse(localStorage.getItem(CHAVE));
    if (d && typeof d === 'object') return completar(d);
  } catch (e) { /* armazenamento indisponível: segue em memória */ }
  return padrao();
}

export const E = carregar();

let timer = null;
export function salvar() {
  clearTimeout(timer);
  timer = setTimeout(salvarJa, 300);
}
export function salvarJa() {
  clearTimeout(timer);
  try { localStorage.setItem(CHAVE, JSON.stringify(E)); } catch (e) { console.warn('Não foi possível salvar o progresso', e); }
}
window.addEventListener('pagehide', salvarJa);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') salvarJa(); });

export function substituir(novo) {
  const d = completar(novo);
  for (const k of Object.keys(E)) delete E[k];
  Object.assign(E, d);
  salvarJa();
}
export function zerar() { substituir(padrao()); }

// Datas no fuso local, no formato AAAA-MM-DD.
const p2 = n => String(n).padStart(2, '0');
export const dataISO = d => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
export const hoje = () => dataISO(new Date());
export function somarDias(iso, n) {
  const [a, m, d] = iso.split('-').map(Number);
  return dataISO(new Date(a, m - 1, d + n));
}
export function diasEntre(deISO, ateISO) {
  const [a1, m1, d1] = deISO.split('-').map(Number);
  const [a2, m2, d2] = ateISO.split('-').map(Number);
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 864e5);
}

function dia(iso = hoje()) { return E.dias[iso] || (E.dias[iso] = { l: 0, r: 0 }); }

// Leitura
export function marcarLido(id, sim) {
  if (sim && !E.lidos[id]) {
    E.lidos[id] = Date.now();
    dia().l++;
    if (E.config.revisaoAuto && !E.revisao[id]) E.revisao[id] = novoCartao(somarDias(hoje(), 1));
  } else if (!sim && E.lidos[id]) {
    if (dataISO(new Date(E.lidos[id])) === hoje() && dia().l > 0) dia().l--;
    delete E.lidos[id];
    const c = E.revisao[id];
    if (c && c.reps === 0 && c.auto) delete E.revisao[id];
  }
  salvar();
}

export function alternarEstrela(id) {
  if (E.estrelas[id]) delete E.estrelas[id]; else E.estrelas[id] = Date.now();
  salvar();
  return !!E.estrelas[id];
}

// Revisão espaçada (variação simples do SM-2)
function novoCartao(due, auto = true) { return { due, int: 0, ease: 2.5, reps: 0, lapses: 0, auto }; }

export function alternarRevisao(id) {
  if (E.revisao[id]) delete E.revisao[id];
  else E.revisao[id] = novoCartao(hoje(), false);
  salvar();
  return !!E.revisao[id];
}

export function proximoIntervalo(c, nota) {
  c = c || novoCartao(hoje());
  if (nota === 0) return 1;
  if (nota === 1) return c.reps === 0 ? 1 : Math.max(1, Math.round(c.int * 1.2));
  if (nota === 2) return c.reps === 0 ? 1 : c.reps === 1 ? 3 : Math.round(c.int * c.ease);
  return c.reps === 0 ? 3 : c.reps === 1 ? 6 : Math.round(c.int * c.ease * 1.3);
}

export function avaliar(id, nota) {
  const c = E.revisao[id] || novoCartao(hoje(), false);
  const int = Math.min(90, proximoIntervalo(c, nota));
  if (nota === 0) { c.reps = 0; c.lapses++; c.ease = Math.max(1.3, c.ease - 0.2); }
  else {
    c.reps++;
    if (nota === 1) c.ease = Math.max(1.3, c.ease - 0.15);
    if (nota === 3) c.ease = Math.min(3.2, c.ease + 0.15);
  }
  c.int = int;
  c.due = somarDias(hoje(), int);
  c.auto = false;
  E.revisao[id] = c;
  dia().r++;
  salvar();
  return int;
}

export function pendentes() {
  const h = hoje();
  return Object.entries(E.revisao).filter(([, c]) => c.due <= h).sort((a, b) => a[1].due.localeCompare(b[1].due)).map(([id]) => id);
}

// Grifos e notas
export function addGrifo(id, g) {
  (E.grifos[id] || (E.grifos[id] = [])).push(g);
  salvar();
}
export function remGrifo(id, i) {
  const l = E.grifos[id];
  if (!l) return;
  l.splice(i, 1);
  if (!l.length) delete E.grifos[id];
  salvar();
}
export function salvarNota(id, texto) {
  texto = texto.trim();
  if (texto) E.notas[id] = { texto, ts: Date.now() }; else delete E.notas[id];
  salvar();
}

// Onde parei
export function registrarPosicao(lei, art) {
  E.posLei[lei] = art;
  E.ultimo = { lei, art, ts: Date.now() };
  salvar();
}

export function sequencia() {
  let n = 0, d = hoje();
  const ativo = iso => { const x = E.dias[iso]; return x && (x.l + x.r) > 0; };
  if (!ativo(d)) d = somarDias(d, -1);
  while (ativo(d)) { n++; d = somarDias(d, -1); }
  return n;
}
