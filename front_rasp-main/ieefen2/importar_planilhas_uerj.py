import json
import os
import re
import unicodedata
from datetime import time
from pathlib import Path
import pandas as pd

# ================= CONFIGURAÇÕES =================
PASTA_PLANILHAS = "planilhas_secretaria"
ARQUIVO_SAIDA = "public/horarios2.json"

# True = mantém as aulas já existentes no horarios2.json e apenas adiciona/atualiza as do CSV
# False = apaga o horarios2.json anterior e salva apenas o que estiver nas planilhas da pasta
MESCLAR_COM_JSON_ATUAL = True

# True = se a planilha tiver coluna CURSO (como as do IME), filtra apenas turmas de Engenharia
FILTRAR_APENAS_ENGENHARIA = True
# =================================================

HORARIOS_UERJ = {
    "M1": (time(7, 0), time(7, 50)),
    "M2": (time(7, 50), time(8, 40)),
    "M3": (time(8, 50), time(9, 40)),
    "M4": (time(9, 40), time(10, 30)),
    "M5": (time(10, 40), time(11, 30)),
    "M6": (time(11, 30), time(12, 20)),
    "T1": (time(12, 30), time(13, 20)),
    "T2": (time(13, 20), time(14, 10)),
    "T3": (time(14, 20), time(15, 10)),
    "T4": (time(15, 10), time(16, 0)),
    "T5": (time(16, 10), time(17, 0)),
    "T6": (time(17, 10), time(18, 0)),
    "N1": (time(18, 0), time(18, 50)),
    "N2": (time(18, 50), time(19, 40)),
    "N3": (time(19, 40), time(20, 30)),
    "N4": (time(20, 30), time(21, 20)),
    "N5": (time(21, 20), time(22, 10)),
}

MAPA_DIAS = [
    (r"(?:segunda(?:-feira)?|\bseg\b|2[ªaº]?)", "seg"),
    (r"(?:ter[çc]a(?:-feira)?|\bter\b|3[ªaº]?)", "ter"),
    (r"(?:quarta(?:-feira)?|\bqua\b|4[ªaº]?)", "qua"),
    (r"(?:quinta(?:-feira)?|\bqui\b|5[ªaº]?)", "qui"),
    (r"(?:sexta(?:-feira)?|\bsex\b|6[ªaº]?)", "sex"),
    (r"(?:s[áa]bado|\bsab\b|7[ªaº]?)", "sab"),
]


def normalizar_texto(texto: str) -> str:
    sem_acento = "".join(
        c for c in unicodedata.normalize("NFD", str(texto)) if unicodedata.category(c) != "Mn"
    )
    return sem_acento.strip().lower()


def carregar_tabela(caminho: Path) -> pd.DataFrame:
    """Lê CSV (detectando encoding e delimitador) ou XLSX e localiza a linha real de cabeçalho."""
    if caminho.suffix.lower() in {".xlsx", ".xls"}:
        df_bruto = pd.read_excel(caminho, header=None, dtype=str)
    else:
        df_bruto = None
        for enc in ("utf-8-sig", "utf-8", "latin1", "cp1252"):
            try:
                df_bruto = pd.read_csv(
                    caminho, sep=None, engine="python", header=None, encoding=enc, dtype=str
                )
                break
            except Exception:
                continue
        if df_bruto is None:
            raise ValueError(f"Não foi possível decodificar o arquivo {caminho.name}")

    df_bruto = df_bruto.dropna(how="all").reset_index(drop=True)

    # Procura nas primeiras 10 linhas onde começa o cabeçalho real da tabela
    linha_header = 0
    palavras_chave = {"disciplina", "materia", "turma", "sala", "salas", "tempo", "tempos", "hor", "horario", "dia", "dias"}
    for idx in range(min(10, len(df_bruto))):
        valores = {normalizar_texto(v) for v in df_bruto.iloc[idx].dropna()}
        if len(valores.intersection(palavras_chave)) >= 2:
            linha_header = idx
            break

    headers = [str(col).strip() if pd.notna(col) else f"col_{i}" for i, col in enumerate(df_bruto.iloc[linha_header])]
    df = df_bruto.iloc[linha_header + 1 :].copy()
    df.columns = headers
    return df.reset_index(drop=True)


def identificar_colunas(colunas: list[str]) -> dict:
    """Mapeia os nomes variados das colunas da UERJ para um padrão único."""
    mapa = {
        "disciplina": None,
        "turma": None,
        "professor": None,
        "sala": None,
        "dia": None,
        "curso": None,
        "horarios": [],
    }

    for col in colunas:
        norm = normalizar_texto(col)
        if not mapa["disciplina"] and any(k in norm for k in ("disciplina", "materia", "componente")):
            mapa["disciplina"] = col
        elif not mapa["turma"] and (norm in ("t", "turma", "turmas") or "turma" in norm):
            mapa["turma"] = col
        elif not mapa["professor"] and any(k in norm for k in ("prof", "docente")):
            mapa["professor"] = col
        elif not mapa["sala"] and any(k in norm for k in ("sala", "local")):
            mapa["sala"] = col
        elif not mapa["dia"] and norm in ("dia", "dias", "dia da semana"):
            mapa["dia"] = col
        elif not mapa["curso"] and "curso" in norm:
            mapa["curso"] = col
        elif any(k in norm for k in ("tempo", "hor", "horario")):
            mapa["horarios"].append(col)

    return mapa


def extrair_dia(texto: str) -> str | None:
    norm = normalizar_texto(texto)
    for padrao, sigla in MAPA_DIAS:
        if re.search(padrao, norm):
            return sigla
    return None


def extrair_intervalo_horas(texto: str) -> tuple[str, str] | None:
    """Converte blocos 'M3M4' / 'M1 - M3' / 'T3, T4' ou horários diretos '08:50 - 10:30' para (HH:MM, HH:MM)."""
    texto_up = str(texto).upper()

    # Caso 1: códigos de tempo da UERJ (M1..N5)
    blocos = re.findall(r"[MTN]\d", texto_up)
    if blocos and blocos[0] in HORARIOS_UERJ and blocos[-1] in HORARIOS_UERJ:
        inicio = HORARIOS_UERJ[blocos[0]][0].strftime("%H:%M")
        fim = HORARIOS_UERJ[blocos[-1]][1].strftime("%H:%M")
        return inicio, fim

    # Caso 2: horários já escritos em HH:MM (ex: "07:00 - 08:40" ou "19h30 às 22h00")
    horas = re.findall(r"(\d{1,2})[:hH](\d{2})", texto_up)
    if len(horas) >= 2:
        h_ini = f"{int(horas[0][0]):02d}:{horas[0][1]}"
        h_fim = f"{int(horas[-1][0]):02d}:{horas[-1][1]}"
        return h_ini, h_fim

    return None


def limpar_disciplina_e_turma(disc_raw: str, turma_raw: str) -> tuple[str, str]:
    disc = str(disc_raw).strip()
    turma = str(turma_raw).strip() if pd.notna(turma_raw) else ""

    # Se a turma vier embutida na coluna disciplina (ex: "Antenas - FEN05-00124 - 7 - Turma: 1")
    match_turma_embutida = re.search(r"Turma\s*:?\s*([A-Za-z0-9/]+)", disc, flags=re.IGNORECASE)
    if match_turma_embutida and (not turma or turma.lower() == "nan"):
        turma = match_turma_embutida.group(1)

    # Remove códigos numéricos e sufixo de turma do nome da disciplina
    disc = re.sub(r"\s*-\s*(?:[A-Z]{2,5}\d{2}-[A-Z0-9-]+|\d{2}-\d{5})(?:\s*-\s*\d+)?", "", disc)
    disc = re.sub(r"\s*-\s*Turma\s*:?\s*.*$", "", disc, flags=re.IGNORECASE)
    disc = re.sub(r"^\d+\s*-\s*", "", disc).strip()

    # Limpa o campo turma ("Turma 1" -> "1", "T1 - 40" -> "T1")
    turma = re.sub(r"^Turmas?\s*:?\s*", "", turma, flags=re.IGNORECASE)
    turma = re.sub(r"\s*\(\d+\s*alunos?\)", "", turma, flags=re.IGNORECASE)
    turma = re.sub(r"\s*-\s*\d+\s*$", "", turma).strip()

    return disc, (turma or "1")


def limpar_professor(prof_raw: str) -> str:
    if pd.isna(prof_raw):
        return "A definir"
    prof = str(prof_raw).strip()
    if not prof or normalizar_texto(prof) in ("nan", "-", "(nao informado)", "nao informado", "turma sem professor", "a definir"):
        return "A definir"
    return prof


def curso_eh_engenharia(curso_raw: str) -> bool:
    if pd.isna(curso_raw):
        return True
    norm = normalizar_texto(curso_raw)
    termos_eng = ("fen", "eng", "ccomp", "c.comp", "computacao")
    return any(t in norm for t in termos_eng)


def processar_planilhas():
    pasta = Path(PASTA_PLANILHAS)
    if not pasta.exists():
        os.makedirs(pasta, exist_ok=True)
        print(f"Pasta '{PASTA_PLANILHAS}' criada. Coloque os arquivos .csv ou .xlsx lá dentro e rode novamente.")
        return

    arquivos = sorted([p for p in pasta.iterdir() if p.suffix.lower() in {".csv", ".xlsx", ".xls"}])
    if not arquivos:
        print(f"Nenhum arquivo .csv ou .xlsx encontrado em '{PASTA_PLANILHAS}'.")
        return

    novas_aulas = []

    for arq in arquivos:
        print(f"Processando {arq.name}...")
        try:
            df = carregar_tabela(arq)
            cols = identificar_colunas(list(df.columns))

            if not cols["disciplina"] or not cols["horarios"]:
                print(f"   [Aviso] Colunas de disciplina ou horário não identificadas em {arq.name}. Pulando.")
                continue

            # Preenche células mescladas para baixo (comum em planilhas exportadas do Excel)
            df[cols["disciplina"]] = df[cols["disciplina"]].ffill()

            contador_arq = 0
            for _, row in df.iterrows():
                if FILTRAR_APENAS_ENGENHARIA and cols["curso"]:
                    if not curso_eh_engenharia(row.get(cols["curso"])):
                        continue

                disc_bruta = row.get(cols["disciplina"])
                if pd.isna(disc_bruta) or not str(disc_bruta).strip():
                    continue

                disciplina, turma = limpar_disciplina_e_turma(
                    disc_bruta, row.get(cols["turma"]) if cols["turma"] else ""
                )
                professor = limpar_professor(row.get(cols["professor"]) if cols["professor"] else None)

                sala_bruta = str(row.get(cols["sala"])).strip() if cols["sala"] and pd.notna(row.get(cols["sala"])) else "A definir"
                if not sala_bruta or sala_bruta.lower() == "nan":
                    sala_bruta = "A definir"
                lista_salas = [s.strip() for s in re.split(r"[,;]", sala_bruta) if s.strip()] or ["A definir"]

                # Caso A: Planilha tem coluna separada de DIA e coluna de TEMPO
                if cols["dia"] and pd.notna(row.get(cols["dia"])):
                    dia = extrair_dia(str(row.get(cols["dia"])))
                    for col_h in cols["horarios"]:
                        val_h = row.get(col_h)
                        if pd.isna(val_h):
                            continue
                        intervalo = extrair_intervalo_horas(str(val_h))
                        if dia and intervalo:
                            novas_aulas.append({
                                "DISCIPLINA": disciplina,
                                "SALA": lista_salas[0],
                                "TURMA": turma,
                                "PROFESSOR": professor,
                                "HORÁRIO_INICIAL": intervalo[0],
                                "HORÁRIO_FINAL": intervalo[1],
                                "DIA_DA_SEMANA": dia,
                            })
                            contador_arq += 1

                # Caso B: Planilha junta dia e tempo na mesma coluna (ex: "Seg T2T3T4, Qui T2T3" ou colunas HOR do IME)
                else:
                    segmentos = []
                    for col_h in cols["horarios"]:
                        val_h = row.get(col_h)
                        if pd.isna(val_h) or not str(val_h).strip():
                            continue
                        # Quebra múltiplos dias na mesma célula (ex: "Seg T2T3, Qui T2T3" ou "TER: T3, T4 / QUI: T3, T4")
                        partes = re.split(r"[/;]|(?=\b(?:seg|ter|qua|qui|sex|sab|2[ªaº]|3[ªaº]|4[ªaº]|5[ªaº]|6[ªaº]|7[ªaº])\b)", str(val_h), flags=re.IGNORECASE)
                        for p in partes:
                            p = p.strip(" ,:-")
                            if p:
                                segmentos.append(p)

                    for idx_seg, seg in enumerate(segmentos):
                        dia = extrair_dia(seg)
                        intervalo = extrair_intervalo_horas(seg)
                        if dia and intervalo:
                            sala_seg = lista_salas[idx_seg] if idx_seg < len(lista_salas) else lista_salas[0]
                            novas_aulas.append({
                                "DISCIPLINA": disciplina,
                                "SALA": sala_seg,
                                "TURMA": turma,
                                "PROFESSOR": professor,
                                "HORÁRIO_INICIAL": intervalo[0],
                                "HORÁRIO_FINAL": intervalo[1],
                                "DIA_DA_SEMANA": dia,
                            })
                            contador_arq += 1

            print(f"   -> {contador_arq} horários extraídos de {arq.name}.")

        except Exception as e:
            print(f"   -> Erro ao ler {arq.name}: {e}")

    if not novas_aulas:
        print("\nNenhum horário válido extraído. O 'public/horarios2.json' não foi alterado.")
        return

    # Carrega o JSON atual se o modo mesclar estiver ativo
    mapa_final = {}
    if MESCLAR_COM_JSON_ATUAL and os.path.exists(ARQUIVO_SAIDA):
        try:
            with open(ARQUIVO_SAIDA, "r", encoding="utf-8") as f:
                existentes = json.load(f)
            for aula in existentes:
                chave = (
                    aula["DISCIPLINA"].strip().upper(),
                    aula["TURMA"].strip().upper(),
                    aula["DIA_DA_SEMANA"].strip().lower(),
                    aula["HORÁRIO_INICIAL"].strip(),
                )
                mapa_final[chave] = aula
        except Exception:
            pass

    # Insere ou atualiza com os dados exatos dos CSVs
    for aula in novas_aulas:
        chave = (
            aula["DISCIPLINA"].strip().upper(),
            aula["TURMA"].strip().upper(),
            aula["DIA_DA_SEMANA"].strip().lower(),
            aula["HORÁRIO_INICIAL"].strip(),
        )
        mapa_final[chave] = aula

    lista_final = list(mapa_final.values())
    ordem_dias = {"seg": 1, "ter": 2, "qua": 3, "qui": 4, "sex": 5, "sab": 6}
    lista_final.sort(
        key=lambda x: (
            ordem_dias.get(x["DIA_DA_SEMANA"], 9),
            x["HORÁRIO_INICIAL"],
            x["DISCIPLINA"],
        )
    )

    os.makedirs(os.path.dirname(ARQUIVO_SAIDA), exist_ok=True)
    with open(ARQUIVO_SAIDA, "w", encoding="utf-8") as f:
        json.dump(lista_final, f, ensure_ascii=False, indent=2)

    print(f"\nConcluído! Total de {len(lista_final)} aulas salvas em '{ARQUIVO_SAIDA}'.")


if __name__ == "__main__":
    processar_planilhas()