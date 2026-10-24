#!/usr/bin/env python3
"""Gera o site a partir do HTML-fonte da Lei Seca.

Lê fonte/lei-seca-bloco-ii.html e escreve em public/:
  leis/<id>.html      conteúdo de cada norma (carregado sob demanda)
  data/indice.json    matérias, normas, títulos e artigos (para navegação e progresso)
  data/busca.json     texto puro de cada artigo (para a busca)
  fonts/*.woff2       fontes que estavam embutidas em base64
  css/fonts.css       @font-face apontando para os arquivos acima
  lei-seca-bloco-ii.pdf

Uso: python3 scripts/build.py
"""
import base64
import html
import json
import re
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
FONTE = RAIZ / "fonte" / "lei-seca-bloco-ii.html"
SAIDA = RAIZ / "public"


def texto(fragmento):
    """Remove tags e normaliza espaços."""
    s = re.sub(r"<[^>]+>", " ", fragmento)
    return re.sub(r"\s+", " ", html.unescape(s)).strip()


def extrair_fontes(src):
    pasta = SAIDA / "fonts"
    pasta.mkdir(parents=True, exist_ok=True)
    css = []
    for i, m in enumerate(re.finditer(r"@font-face\{(.*?)\}", src)):
        bloco = m.group(1)
        dados = re.search(r"url\(data:font/woff2;base64,([^)]+)\)", bloco)
        familia = re.search(r"font-family:'([^']+)'", bloco).group(1)
        peso = re.search(r"font-weight:(\d+)", bloco).group(1)
        estilo = re.search(r"font-style:(\w+)", bloco).group(1)
        nome = f"{familia.lower().replace(' ', '-')}-{peso}-{estilo}-{i % 2}.woff2"
        (pasta / nome).write_bytes(base64.b64decode(dados.group(1)))
        css.append("@font-face{" + bloco.replace(dados.group(0), f"url(../fonts/{nome})") + "}")
    (SAIDA / "css" / "fonts.css").write_text("\n".join(css) + "\n", encoding="utf-8")
    return len(css)


def extrair_pdf(src):
    m = re.search(r'<script type="application/octet-stream" id="pdfdata">\s*(.*?)\s*</script>', src, re.S)
    (SAIDA / "lei-seca-bloco-ii.pdf").write_bytes(base64.b64decode(m.group(1)))


def extrair_capa(src):
    capa = re.search(r'<section class="cover">(.*?)</section>', src, re.S).group(1)
    kicker = texto(re.search(r'<p class="kicker">(.*?)</p>', capa, re.S).group(1))
    notas = [m.group(1).strip() for m in re.finditer(r"<li>(.*?)</li>", re.search(r'<ul class="notes">(.*?)</ul>', capa, re.S).group(1), re.S)]
    return {"kicker": kicker, "notas": notas}


def extrair_normas(src):
    inicio = src.find('<section class="materia"')
    fim = src.find("</main>")
    corpo = src[inicio:fim]

    materias = []
    marcas = [(m.start(), "materia", m) for m in re.finditer(r'<section class="materia" id="([^"]+)">.*?<h1 class="mat-title"[^>]*>(.*?)</h1>', corpo, re.S)]
    marcas += [(m.start(), "law", m) for m in re.finditer(r'<section class="law" id="([^"]+)">', corpo)]
    marcas.sort(key=lambda x: x[0])

    normas = []
    for idx, (pos, tipo, m) in enumerate(marcas):
        if tipo == "materia":
            materias.append({"id": m.group(1), "titulo": texto(m.group(2)), "normas": []})
            continue
        fim_norma = marcas[idx + 1][0] if idx + 1 < len(marcas) else len(corpo)
        bloco = corpo[m.end():fim_norma]
        bloco = re.sub(r"(\s*</section>)+\s*$", "", bloco)
        normas.append((m.group(1), materias[-1], bloco))
    return materias, normas


def processar_norma(lei_id, materia, bloco, busca):
    cab = re.search(r'<header class="law-head">(.*?)</header>', bloco, re.S).group(1)
    titulo = texto(re.search(r'<h2 class="law-title"[^>]*>(.*?)</h2>', cab, re.S).group(1))
    sub = re.search(r'<p class="law-sub">(.*?)</p>', cab, re.S)
    recorte = re.search(r'<p class="scope"><span>Recorte do edital</span>(.*?)</p>', cab, re.S)

    # Títulos sem id ganham um, para poderem aparecer no índice.
    contador = [0]

    def dar_id(m):
        contador[0] += 1
        return f'{m.group(1)} id="{lei_id}-hx{contador[0]}">'

    bloco = re.sub(r'(<h[3-6] class="hd[^"]*")>', dar_id, bloco)

    titulos, artigos = [], []
    titulo_atual = None
    for m in re.finditer(r'<h([3-6]) class="hd lv(\d)" id="([^"]+)">(.*?)</h\1>|<article class="art[^"]*" id="([^"]+)">(.*?)</article>', bloco, re.S):
        if m.group(3):
            hl = re.search(r'<span class="hl">(.*?)</span>', m.group(4), re.S)
            ht = re.search(r'<span class="ht">(.*?)</span>', m.group(4), re.S)
            rotulo = " — ".join(texto(x.group(1)) for x in (hl, ht) if x)
            titulo_atual = m.group(3)
            titulos.append({"id": m.group(3), "nivel": int(m.group(2)), "rotulo": rotulo, "artigos": 0})
            continue
        art_id, conteudo = m.group(5), m.group(6)
        al = re.search(r'<b class="al">(.*?)</b>', conteudo, re.S)
        rotulo = texto(al.group(1)).rstrip(" -–.").replace("Artigo", "Art.") if al else "Art. " + art_id[len(lei_id) + 1:]
        epi = re.search(r'<p class="epi">(.*?)</p>', conteudo, re.S)
        artigos.append({"id": art_id, "rotulo": rotulo, "epigrafe": texto(epi.group(1)) if epi else "", "titulo": titulo_atual})
        if titulos:
            titulos[-1]["artigos"] += 1
        busca.append({"id": art_id, "lei": lei_id, "t": texto(conteudo)})

    (SAIDA / "leis" / f"{lei_id}.html").write_text(bloco.strip() + "\n", encoding="utf-8")
    norma = {
        "id": lei_id,
        "materia": materia["id"],
        "titulo": titulo,
        "subtitulo": texto(sub.group(1)) if sub else "",
        "recorte": texto(recorte.group(1)) if recorte else "",
        "titulos": titulos,
        "artigos": artigos,
    }
    materia["normas"].append(lei_id)
    return norma


def main():
    src = FONTE.read_text(encoding="utf-8")
    for pasta in ("leis", "data", "css"):
        (SAIDA / pasta).mkdir(parents=True, exist_ok=True)

    n_fontes = extrair_fontes(src)
    extrair_pdf(src)
    materias, blocos = extrair_normas(src)
    busca = []
    normas = [processar_norma(lei_id, mat, bloco, busca) for lei_id, mat, bloco in blocos]

    indice = {"capa": extrair_capa(src), "materias": materias, "normas": normas}
    (SAIDA / "data" / "indice.json").write_text(json.dumps(indice, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    (SAIDA / "data" / "busca.json").write_text(json.dumps(busca, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    total = sum(len(n["artigos"]) for n in normas)
    print(f"{len(materias)} matérias, {len(normas)} normas, {total} artigos, {n_fontes} fontes")


if __name__ == "__main__":
    main()
