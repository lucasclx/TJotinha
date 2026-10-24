// Gera public/data/cronograma.json (e docs/cronograma.md) com as premissas
// padrão de public/js/cronograma/gerar.js ou com as passadas na linha de comando.
//
// Uso: node scripts/cronograma/gerar_cronograma.mjs [--prova AAAA-MM-DD] [--inicio AAAA-MM-DD]
//        [--minutos dom,seg,ter,qua,qui,sex,sab]

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { gerarCronograma } from '../../public/js/cronograma/gerar.js';

const args = process.argv.slice(2);
const arg = (nome) => {
  const i = args.indexOf(`--${nome}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const opcoes = {};
if (arg('prova')) opcoes.dataProva = arg('prova');
if (arg('inicio')) opcoes.inicio = arg('inicio');
if (arg('minutos')) opcoes.minutosPorDia = arg('minutos').split(',').map(Number);

const { unidades } = JSON.parse(readFileSync('public/data/unidades.json', 'utf8'));
const plano = gerarCronograma(unidades, opcoes);
writeFileSync('public/data/cronograma.json', JSON.stringify(plano, null, 1) + '\n');

// Versão legível, para conferir o plano sem abrir o site.
const fmt = (s) => s.split('-').reverse().join('/');
const h = (m) => (m % 60 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}` : `${m / 60}h`);
const p = plano.premissas;
const linhas = [
  '# Cronograma de estudo — Bloco II TJ-SP',
  '',
  'Gerado por `scripts/cronograma/gerar_cronograma.mjs`. Não edite à mão: rode o script de novo.',
  '',
  '## Premissas',
  '',
  `- Prova: ${fmt(p.dataProva)}. Início: ${fmt(p.inicio)}.`,
  `- Tempo por dia: ${['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'].map((d, i) => `${d} ${h(p.minutosPorDia[i])}`).join(', ')}.`,
  '- Domingo é dia de revisão semanal. Reta final de ' + p.semanasFinais + ' semanas com simulados.',
  '- Ritmo de primeira leitura: 250 caracteres por minuto (ler, grifar e anotar). Pesos de incidência são estimativas.',
  '',
  '## Resumo',
  '',
  `- ${plano.resumo.semanas} semanas, ${plano.resumo.horasTotais} h no total (${Object.entries(plano.resumo.horasPorTipo).map(([k, v]) => `${k} ${v} h`).join(', ')}).`,
  `- Primeira leitura completa termina em ${plano.resumo.fimPrimeiraLeitura ? fmt(plano.resumo.fimPrimeiraLeitura) : '(não termina antes da reta final)'}; ciclos iniciados: ${plano.resumo.ciclosIniciados}.`,
  `- Reta final começa em ${fmt(plano.resumo.inicioRetaFinal)}.`,
  ...plano.avisos.map((a) => `- **Atenção:** ${a}`),
  '',
];
for (const s of plano.semanas) {
  linhas.push(`## Semana ${s.n} (${fmt(s.inicio)} a ${fmt(s.fim)}) — ${s.fase}`, '');
  for (const d of s.dias) {
    if (!d.tarefas.length) continue;
    linhas.push(`**${d.diaSemana} ${fmt(d.data)}** (${h(d.minutos)})`, '');
    for (const t of d.tarefas) linhas.push(`- [ ] ${t.descricao} — ${h(t.minutos)}`);
    linhas.push('');
  }
}
mkdirSync('docs', { recursive: true });
writeFileSync('docs/cronograma.md', linhas.join('\n'));

console.log(JSON.stringify(plano.resumo, null, 1));
for (const a of plano.avisos) console.log('AVISO:', a);
