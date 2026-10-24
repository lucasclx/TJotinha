// Gera o cronograma de estudo dia a dia até a prova, a partir das unidades de
// estudo (public/data/unidades.json). Módulo ES sem dependências: roda no
// navegador e no Node (scripts/cronograma/gerar_cronograma.mjs).
//
// Estrutura do plano:
// - Ciclo 1: primeira leitura de todas as unidades, intercalando as matérias,
//   cada unidade seguida de questões. Revisões espaçadas em D+1, D+7 e D+30.
// - Ciclos 2, 3...: releituras mais rápidas com questões, priorizando o que
//   mais cai, enquanto houver tempo antes da reta final.
// - Dia de revisão semanal (padrão: domingo): revisa os grifos da semana.
// - Reta final: revisão geral por peso e simulados semanais.

export const PADRAO = {
  dataProva: '2027-03-28',
  inicio: '2026-10-26',
  // Minutos por dia da semana, de domingo (0) a sábado (6).
  minutosPorDia: [60, 120, 120, 120, 120, 120, 240],
  diaRevisaoSemanal: 0,
  // Semanas de reta final; null = automático (cerca de 12% do período, de 1 a 4).
  semanasFinais: null,
};

const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const DIA_MS = 86400000;

const paraData = (s) => new Date(s + 'T00:00:00Z');
const paraTexto = (d) => d.toISOString().slice(0, 10);
const somaDias = (d, n) => new Date(d.getTime() + n * DIA_MS);
const arred5 = (m) => Math.max(10, Math.round(m / 5) * 5);

// Fatores de cada ciclo: tempo de leitura e de questões relativos à unidade, e
// peso mínimo das unidades que entram.
function fatoresCiclo(c) {
  if (c === 1) return { leitura: 1, questoes: 0.3, pesoMin: 1 };
  if (c === 2) return { leitura: 0.5, questoes: 0.3, pesoMin: 1 };
  if (c === 3) return { leitura: 0.35, questoes: 0.3, pesoMin: 2 };
  return { leitura: 0.3, questoes: 0.3, pesoMin: 3 };
}

// Ordena as unidades intercalando matérias em sessões de cerca de uma hora: a
// próxima sessão é sempre da matéria com menor fração já estudada, mantendo a
// ordem dos artigos dentro de cada lei.
function intercalar(unidades, minutosSessao = 50) {
  const filas = new Map();
  for (const u of unidades) {
    if (!filas.has(u.materiaId)) filas.set(u.materiaId, { fila: [], total: 0, feito: 0 });
    const f = filas.get(u.materiaId);
    f.fila.push(u);
    f.total += u.minutos;
  }
  const ordem = [];
  while (ordem.length < unidades.length) {
    let melhor = null;
    for (const f of filas.values()) {
      if (!f.fila.length) continue;
      if (!melhor || f.feito / f.total < melhor.feito / melhor.total) melhor = f;
    }
    let sessao = 0;
    while (melhor.fila.length && sessao < minutosSessao) {
      const u = melhor.fila.shift();
      melhor.feito += u.minutos;
      sessao += u.minutos;
      ordem.push(u);
    }
  }
  return ordem;
}

// Cada item da fila de um ciclo é um par [leitura, questões] da mesma unidade,
// que vão sempre juntos no mesmo dia.
function tarefasDoCiclo(unidades, c) {
  const f = fatoresCiclo(c);
  const lista = intercalar(unidades.filter((u) => u.peso >= f.pesoMin), c === 1 ? 50 : 100);
  return lista.map((u) => {
    const base = { unidadeId: u.id, leiId: u.leiId, de: u.de, ate: u.ate, ciclo: c };
    return [
      {
        ...base,
        id: `estudo-${u.id}-c${c}`,
        tipo: 'estudo',
        minutos: arred5(u.minutos * f.leitura),
        descricao: `${c === 1 ? 'Ler' : 'Reler'} ${u.titulo}${u.assunto ? ` (${u.assunto})` : ''}`,
      },
      {
        ...base,
        id: `questoes-${u.id}-c${c}`,
        tipo: 'questoes',
        minutos: arred5(u.minutos * f.questoes),
        descricao: `Questões VUNESP: ${u.titulo}`,
      },
    ];
  });
}

// "CPC, Arts. 144 a 155" + "CPC, Arts. 188 a 211" -> "CPC, Arts. 144 a 211"
function juntaFaixa(us) {
  if (us.length === 1) return us[0].titulo;
  const [lei, ini] = us[0].titulo.split(/, Arts?\. /);
  const fim = us[us.length - 1].titulo.split(/, Arts?\. /)[1];
  return `${lei}, Arts. ${ini.split(' a ')[0]} a ${fim.split(' a ').pop()}`;
}

const leisDe = (us) => [...new Set(us.map((u) => u.titulo.split(',')[0]))].join(', ');

export function gerarCronograma(unidades, opcoes = {}) {
  const op = { ...PADRAO, ...opcoes };
  const inicio = paraData(op.inicio);
  const prova = paraData(op.dataProva);
  const avisos = [];
  const totalDias = Math.round((prova - inicio) / DIA_MS);
  if (totalDias < 7) throw new Error('A data da prova precisa ser pelo menos uma semana depois do início.');

  const semanasTotais = totalDias / 7;
  const semanasFinais = op.semanasFinais ?? Math.min(4, Math.max(1, Math.round(semanasTotais * 0.12)));
  const inicioFinal = somaDias(prova, -semanasFinais * 7);
  const porId = new Map(unidades.map((u) => [u.id, u]));
  const maiorDia = Math.max(...op.minutosPorDia);
  const diaSimulado = op.minutosPorDia.lastIndexOf(maiorDia);

  let ciclo = 1;
  let fila = tarefasDoCiclo(unidades, 1);
  let fimCiclo1 = null;
  // Revisões espaçadas agrupadas pelo dia em que as unidades foram lidas:
  // { vence: Date, n: 1|7|30, origem: 'AAAA-MM-DD', unidades: [...] }
  const revisoes = [];
  let estudadasNaSemana = [];
  let filaFinal = null;
  const dias = [];

  const tarefaRevisao = (r) => {
    const us = r.unidades.map((id) => porId.get(id));
    const minutos = r.n === 1 ? arred5(5 * us.length) : arred5(us.reduce((s, u) => s + u.minutos * 0.15, 0));
    return {
      id: `revisao-d${r.n}-${r.origem}`, tipo: 'revisao', unidades: r.unidades, minutos,
      descricao: `Revisão D+${r.n} (grifos e anotações do dia ${r.origem.split('-').reverse().join('/')}): ${us.map((u) => u.titulo).join('; ')}`,
    };
  };

  for (let d = inicio; d < prova; d = somaDias(d, 1)) {
    const dow = d.getUTCDay();
    const orcamento = op.minutosPorDia[dow] || 0;
    const dia = { data: paraTexto(d), diaSemana: DIAS[dow], minutos: 0, tarefas: [] };
    dias.push(dia);
    if (!orcamento) continue;
    let livre = orcamento;
    const poe = (...ts) => {
      for (const t of ts) {
        dia.tarefas.push(t);
        dia.minutos += t.minutos;
        livre -= t.minutos;
      }
    };
    // Passar um pouco do tempo do dia é aceitável; deixar um dia vazio, não.
    const cabe = (min) => livre >= min || (livre >= 0.7 * min && livre >= 20) || livre === orcamento;
    const tirarVencidas = (filtro = () => true) => {
      const vs = revisoes.filter((r) => r.vence <= d && filtro(r)).sort((a, b) => a.vence - b.vence);
      for (const r of vs) revisoes.splice(revisoes.indexOf(r), 1);
      return vs;
    };

    // Véspera da prova: só revisão leve.
    if (paraTexto(somaDias(d, 1)) === op.dataProva) {
      poe({ id: `vespera-${dia.data}`, tipo: 'revisao', minutos: Math.min(60, orcamento), descricao: 'Véspera: revisão leve dos grifos e anotações, sem conteúdo novo. Descanse.' });
      continue;
    }

    if (d >= inicioFinal) {
      // Reta final: o que faltou do ciclo 1, revisão geral por peso e simulados.
      if (!filaFinal) {
        const pendentes = ciclo === 1 ? fila : [];
        if (pendentes.length) avisos.push(`Não deu tempo de terminar a primeira leitura antes da reta final: ${pendentes.length} unidades ficaram para as últimas semanas. Aumente as horas por dia ou antecipe o início.`);
        // Revisão final em blocos de até 1h de unidades seguidas da mesma lei,
        // das leis de maior peso para as de menor.
        const ordem = [...unidades].sort((a, b) => b.peso - a.peso);
        const blocos = [];
        for (const u of ordem) {
          const ultimo = blocos[blocos.length - 1];
          const min = u.minutos * 0.25;
          if (ultimo && ultimo[0].leiId === u.leiId && ultimo.min + min <= 60) {
            ultimo.push(u);
            ultimo.min += min;
          } else blocos.push(Object.assign([u], { min }));
        }
        filaFinal = [
          ...pendentes,
          ...blocos.map((us) => [{
            id: `final-${us[0].id}`, tipo: 'revisao', leiId: us[0].leiId, de: us[0].de, ate: us[us.length - 1].ate,
            unidades: us.map((u) => u.id), minutos: arred5(us.min), descricao: `Revisão final: ${juntaFaixa(us)}`,
          }]),
        ];
        revisoes.length = 0;
      }
      if (dow === diaSimulado) {
        poe({ id: `simulado-${dia.data}`, tipo: 'simulado', minutos: Math.min(orcamento, 240), descricao: 'Simulado: prova anterior da VUNESP com tempo cronometrado. Depois corrija e releia os artigos das questões que errou.' });
      }
      while (filaFinal.length && livre > 0) {
        const par = filaFinal[0];
        if (!cabe(par.reduce((s, t) => s + t.minutos, 0))) break;
        poe(...filaFinal.shift());
      }
      if (livre >= 20 && !filaFinal.length) poe({ id: `questoes-mistas-${dia.data}`, tipo: 'questoes', minutos: livre, descricao: 'Questões mistas de todas as matérias, focando nos assuntos em que mais errou.' });
      continue;
    }

    if (dow === op.diaRevisaoSemanal) {
      // A revisão semanal já cobre as revisões D+1 da semana.
      tirarVencidas((r) => r.n === 1);
      for (const r of tirarVencidas()) poe(tarefaRevisao(r));
      if (livre >= 20) {
        const us = [...new Set(estudadasNaSemana)].map((id) => porId.get(id));
        poe({
          id: `semanal-${dia.data}`, tipo: 'revisao', minutos: livre, unidades: us.map((u) => u.id),
          descricao: us.length ? `Revisão da semana: reler grifos e anotações de ${leisDe(us)} e refazer as questões que errou.` : 'Revisão da semana: reler grifos e anotações.',
        });
      }
      estudadasNaSemana = [];
      continue;
    }

    // Revisões espaçadas primeiro, usando no máximo metade do dia.
    for (const r of revisoes.filter((r) => r.vence <= d).sort((a, b) => a.vence - b.vence)) {
      const t = tarefaRevisao(r);
      if (dia.tarefas.length && orcamento - livre + t.minutos > orcamento / 2) break;
      revisoes.splice(revisoes.indexOf(r), 1);
      poe(t);
    }

    // Conteúdo do ciclo atual; ao terminar um ciclo, começa o próximo.
    const lidasHoje = [];
    while (livre > 0) {
      if (!fila.length) {
        if (ciclo === 1) fimCiclo1 = paraTexto(somaDias(d, -1));
        ciclo += 1;
        fila = tarefasDoCiclo(unidades, ciclo);
      }
      // Se a próxima unidade não cabe, tenta uma das seguintes que caiba.
      const i = fila.slice(0, 4).findIndex(([e, q]) => cabe(e.minutos + q.minutos));
      if (i < 0) break;
      const [estudo, questoes] = fila.splice(i, 1)[0];
      poe(estudo, questoes);
      estudadasNaSemana.push(estudo.unidadeId);
      if (estudo.ciclo === 1) lidasHoje.push(estudo.unidadeId);
    }
    if (lidasHoje.length) {
      for (const n of [1, 7, 30]) revisoes.push({ vence: somaDias(d, n), n, origem: dia.data, unidades: lidasHoje });
    }
  }

  if (filaFinal?.length) avisos.push(`A reta final ficou curta: ${filaFinal.length} blocos de revisão não couberam antes da prova.`);

  // Agrupa os dias em semanas de segunda a domingo.
  const semanas = [];
  for (const dia of dias) {
    const d = paraData(dia.data);
    if (!semanas.length || d.getUTCDay() === 1) {
      semanas.push({ n: semanas.length + 1, inicio: dia.data, fim: dia.data, fase: '', minutos: 0, dias: [] });
    }
    const s = semanas[semanas.length - 1];
    s.fim = dia.data;
    s.minutos += dia.minutos;
    s.dias.push(dia);
  }
  for (const s of semanas) {
    const ts = s.dias.flatMap((d) => d.tarefas);
    const ciclos = ts.map((t) => t.ciclo).filter(Boolean);
    if (paraData(s.inicio) >= inicioFinal || ts.some((t) => t.tipo === 'simulado')) s.fase = 'Reta final: revisão geral e simulados';
    else if (ciclos.length) s.fase = Math.min(...ciclos) === 1 ? 'Ciclo 1: primeira leitura com questões' : `Ciclo ${Math.min(...ciclos)}: releitura com questões`;
    else s.fase = 'Revisão';
  }

  const porTipo = {};
  for (const t of dias.flatMap((d) => d.tarefas)) porTipo[t.tipo] = (porTipo[t.tipo] || 0) + t.minutos;

  return {
    premissas: { dataProva: op.dataProva, inicio: op.inicio, minutosPorDia: op.minutosPorDia, diaRevisaoSemanal: op.diaRevisaoSemanal, semanasFinais },
    resumo: {
      semanas: semanas.length,
      horasTotais: Math.round(Object.values(porTipo).reduce((a, b) => a + b, 0) / 60),
      horasPorTipo: Object.fromEntries(Object.entries(porTipo).map(([k, v]) => [k, Math.round(v / 60)])),
      fimPrimeiraLeitura: fimCiclo1,
      ciclosIniciados: ciclo,
      inicioRetaFinal: paraTexto(inicioFinal),
    },
    avisos,
    semanas,
  };
}
