import json
import os
import re
import time
from pathlib import Path
from typing import Literal
from google import genai
from google.genai import types
from PIL import Image, ImageEnhance, ImageOps
from pydantic import BaseModel, Field

# ================= CONFIGURAÇÕES =================
API_KEY = os.environ.get("GEMINI_API_KEY")
if not API_KEY:
    raise RuntimeError("Defina a variável export GEMINI_API_KEY="key" no terminal antes de executar.")

PASTA_FOTOS = "fotos_mural"
ARQUIVO_SAIDA = "public/horarios2.json"

# True = nas planilhas do IME (DEP I, II, III), extrai só turmas de Engenharia (FEN / C.Comp / Eng)
# False = extrai absolutamente todas as linhas visíveis nas fotos
FILTRAR_APENAS_ENGENHARIA = True

# Apenas modelos Flash completos (evita modelos Lite para máxima precisão visual)
MODELOS_CANDIDATOS = [
    "gemini-3.8-flash",
    "gemini-3.6-flash",
    "gemini-3-flash-preview",
    "gemini-2.5-flash",
]
# =================================================

client = genai.Client(
    api_key=API_KEY,
    http_options=types.HttpOptions(api_version="v1beta", timeout=120000),
)


class AulaItem(BaseModel):
    TRECHO_ORIGINAL: str = Field(
        description="Transcrição literal do dia, bloco de tempo e sala lidos na linha (ex: 'Qua M3M4 | 5097-F')"
    )
    DISCIPLINA: str = Field(
        description="Nome completo da disciplina sem o código numérico (ex: 'Cálculo Diferencial e Integral I')"
    )
    SALA: str = Field(
        description="Código exato da sala (ex: '5097-F', 'LEE 10', '6005'). Se não houver, use 'A definir'"
    )
    TURMA: str = Field(
        description="Número ou código da turma sem a palavra 'Turma' (ex: '1', '2', 'T1', 'T1/2')"
    )
    PROFESSOR: str = Field(
        description="Nome do professor. Se a planilha não informar (ex: Física, Química, FCE, ADM), use 'A definir'"
    )
    HORÁRIO_INICIAL: str = Field(
        description="Hora de início no formato HH:MM (ex: '07:00', '13:20', '18:00')"
    )
    HORÁRIO_FINAL: str = Field(
        description="Hora de término no formato HH:MM (ex: '08:40', '15:10', '22:10')"
    )
    DIA_DA_SEMANA: Literal["seg", "ter", "qua", "qui", "sex", "sab"] = Field(
        description="Dia da semana em 3 letras minúsculas"
    )


class ResultadoPlanilha(BaseModel):
    aulas: list[AulaItem]


PROMPT_EXTRACAO = f"""
Você é um auditor acadêmico especialista em extrair grades horárias da UERJ a partir de fotos de murais.
Sua prioridade máxima é a PRECISÃO: trace visualmente cada linha da esquerda até a direita para nunca trocar sala, turma ou horário entre linhas vizinhas.

REGRAS OBRIGATÓRIAS DE LEITURA E CONVERSÃO:

1. TABELA OFICIAL DE TEMPOS DA UERJ:
   - M1: 07:00 - 07:50 | M2: 07:50 - 08:40 | M3: 08:50 - 09:40 | M4: 09:40 - 10:30 | M5: 10:40 - 11:30 | M6: 11:30 - 12:20
   - T1: 12:30 - 13:20 | T2: 13:20 - 14:10 | T3: 14:20 - 15:10 | T4: 15:10 - 16:00 | T5: 16:10 - 17:00 | T6: 17:10 - 18:00
   - N1: 18:00 - 18:50 | N2: 18:50 - 19:40 | N3: 19:40 - 20:30 | N4: 20:30 - 21:20 | N5: 21:20 - 22:10

   Como converter blocos:
   - Pegue o HORÁRIO_INICIAL do PRIMEIRO tempo e o HORÁRIO_FINAL do ÚLTIMO tempo.
   - Exemplos:
     * "M3M4" -> "08:50" às "10:30"
     * "M1 - M3" ou "M1, M2, M3" -> "07:00" às "09:40"
     * "M4M5M6T1" -> "09:40" às "13:20"
     * "T2T3T4" -> "13:20" às "16:00"
     * "N1N2" -> "18:00" às "19:40"

2. DIAS DA SEMANA (sempre em 3 letras minúsculas):
   - "2ª", "Seg", "Segunda", "Segunda-feira" -> "seg"
   - "3ª", "Ter", "Terça", "Terça-feira" -> "ter"
   - "4ª", "Qua", "Quarta", "Quarta-feira" -> "qua"
   - "5ª", "Qui", "Quinta", "Quinta-feira" -> "qui"
   - "6ª", "Sex", "Sexta", "Sexta-feira" -> "sex"
   - "7ª", "Sab", "Sáb", "Sábado" -> "sab"

3. DESMEMBRAMENTO DE MÚLTIPLOS DIAS NA MESMA LINHA:
   - Planilhas de DETEL, MECAN, CARTO, Física, Química, FCE e IME costumam colocar 2 ou 3 dias na mesma linha:
     * DETEL: "Seg T2T3T4, Qui T2T3" | Sala "5044F, 5084F" -> gere 2 registros separados, associando a 1ª sala ao 1º dia e a 2ª sala ao 2º dia.
     * MECAN: "TER: T3, T4 / QUI: T3, T4" | Sala "4028B 2ª/5060F 5ª" -> gere 2 registros separados com suas respectivas salas.
     * Física/Química/FCE: Coluna 1 tem o nome da matéria no cabeçalho da seção e a turma na linha ("Turmas 1, 2 e 3 (45 alunos)" ou "T1 - 40"), Coluna 2 tem o 1º dia ("2ª M1 - M3"), Coluna 3 tem o 2º dia ("5ª M1 - M2"), e Coluna 4 tem a Sala ("5032F"). Gere 1 registro para cada coluna de tempo preenchida.
     * IME (DEP I, II, III): Colunas HOR ("2ªT1T3", "4ªT1T2") compartilham a mesma sala da direita ("6005"). Gere 1 registro para cada dia.

4. PADRONIZAÇÃO DOS CAMPOS:
   - DISCIPLINA: Remova códigos como "FEN05-00124 - 7", "01-00508", "03-00587". Mantenha apenas o nome da matéria.
   - TURMA: Remova "Turma:" ou "Turma". Em "T1 - 40" (onde 40 é vagas), extraia apenas "T1". Em "Turmas 1, 2 e 3 (45 alunos)", extraia "1, 2 e 3".
   - PROFESSOR: Se aparecer "(não informado)", "Turma sem professor", traço ou se a planilha não tiver coluna de docente (Física, Química, FCE, ADM, DESMA), use "A definir".
   - Se uma linha não tiver horário ou dia preenchido (ex.: "verificar na secretaria"), ignore essa linha.

5. FILTRO DE CURSO (quando existir coluna CURSO, como no IME DEP I, II, III):
   - {"Extraia APENAS linhas onde o CURSO inclua FEN, Engenharia, Eng, C.Comp ou CCOMP. Ignore turmas exclusivas de FIS, QUI, MAT, ESTAT, CECON, FAOC, ADM, etc." if FILTRAR_APENAS_ENGENHARIA else "Extraia todas as linhas independente do curso."}

6. RIGOR VISUAL:
   - Ignore tabelas cortadas nas bordas onde o nome da disciplina, o horário ou a sala estejam incompletos.
   - Nunca chute ou invente valores ilegíveis.
"""


def preparar_recortes(img_path: Path):
    """Corrige rotação EXIF, melhora nitidez e divide imagens verticais em 2 metades sobrepostas."""
    img = Image.open(img_path)
    img = ImageOps.exif_transpose(img).convert("RGB")

    # Realce suave de nitidez e contraste para letras pequenas de planilha
    img = ImageEnhance.Sharpness(img).enhance(1.35)
    img = ImageEnhance.Contrast(img).enhance(1.10)

    largura, altura = img.size
    # Se a foto for vertical ou muito alta, divide em topo e base com 25% de sobreposição
    if altura >= largura * 1.1:
        meio_sup = int(altura * 0.62)
        meio_inf = int(altura * 0.38)
        return [
            ("parte 1/2 (topo)", img.crop((0, 0, largura, meio_sup))),
            ("parte 2/2 (base)", img.crop((0, meio_inf, largura, altura))),
        ]
    return [("imagem inteira", img)]


def horario_valido(h: str) -> bool:
    return bool(re.match(r"^\d{2}:\d{2}$", h.strip()))


def salvar_json(aulas):
    ordem_dias = {"seg": 1, "ter": 2, "qua": 3, "qui": 4, "sex": 5, "sab": 6}
    aulas_ordenadas = sorted(
        aulas,
        key=lambda x: (
            ordem_dias.get(x["DIA_DA_SEMANA"], 9),
            x["HORÁRIO_INICIAL"],
            x["DISCIPLINA"],
        ),
    )
    os.makedirs(os.path.dirname(ARQUIVO_SAIDA), exist_ok=True)
    with open(ARQUIVO_SAIDA, "w", encoding="utf-8") as f:
        json.dump(aulas_ordenadas, f, ensure_ascii=False, indent=2)


def chamar_gemini_com_precisao(img, modelos_ativos):
    while modelos_ativos:
        modelo_atual = modelos_ativos[0]
        try:
            config = types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=ResultadoPlanilha,
                temperature=0.0,
                media_resolution=types.MediaResolution.MEDIA_RESOLUTION_HIGH,
                thinking_config=types.ThinkingConfig(thinking_budget=4096),
            )
            response = client.models.generate_content(
                model=modelo_atual,
                contents=[img, PROMPT_EXTRACAO],
                config=config,
            )
            return response, modelo_atual
        except Exception as e:
            erro_str = str(e).lower()
            # Se o modelo específico não aceitar thinking_budget, tenta sem thinking_config
            if "thinking" in erro_str:
                config_sem_thinking = types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=ResultadoPlanilha,
                    temperature=0.0,
                    media_resolution=types.MediaResolution.MEDIA_RESOLUTION_HIGH,
                )
                response = client.models.generate_content(
                    model=modelo_atual,
                    contents=[img, PROMPT_EXTRACAO],
                    config=config_sem_thinking,
                )
                return response, modelo_atual

            if any(k in erro_str for k in ["404", "not_found", "quota", "429", "resource_exhausted"]):
                print(f"   [Aviso] '{modelo_atual}' atingiu cota ou indisponível. Trocando modelo...", flush=True)
                modelos_ativos.pop(0)
            else:
                raise
    raise RuntimeError("Todos os modelos Flash atingiram o limite diário.")


def processar_fotos():
    pasta = Path(PASTA_FOTOS)
    if not pasta.exists():
        print(f"Crie a pasta '{PASTA_FOTOS}' e coloque as imagens dentro dela.", flush=True)
        return

    extensoes = {".jpg", ".jpeg", ".png", ".webp"}
    imagens = sorted([p for p in pasta.iterdir() if p.suffix.lower() in extensoes])

    if not imagens:
        print(f"Nenhuma imagem encontrada em '{PASTA_FOTOS}'.", flush=True)
        return

    print(f"Iniciando extração de alta precisão de {len(imagens)} fotos...", flush=True)
    modelos_ativos = list(MODELOS_CANDIDATOS)
    todas_aulas = []
    chaves_vistas = set()

    for idx, img_path in enumerate(imagens, start=1):
        recortes = preparar_recortes(img_path)
        for nome_parte, img_recorte in recortes:
            inicio = time.time()
            print(f"[{idx}/{len(imagens)}] Lendo {img_path.name} ({nome_parte})...", flush=True)
            try:
                response, modelo_usado = chamar_gemini_com_precisao(img_recorte, modelos_ativos)
                resultado = json.loads(response.text)
                aulas_foto = resultado.get("aulas", [])
                novas = 0

                for aula in aulas_foto:
                    h_ini = aula["HORÁRIO_INICIAL"].strip()
                    h_fim = aula["HORÁRIO_FINAL"].strip()
                    if not (horario_valido(h_ini) and horario_valido(h_fim)):
                        continue

                    # Remove o campo auxiliar de conferência antes de salvar no JSON do site
                    aula_limpa = {
                        "DISCIPLINA": aula["DISCIPLINA"].strip(),
                        "SALA": aula["SALA"].strip(),
                        "TURMA": aula["TURMA"].strip(),
                        "PROFESSOR": aula["PROFESSOR"].strip(),
                        "HORÁRIO_INICIAL": h_ini,
                        "HORÁRIO_FINAL": h_fim,
                        "DIA_DA_SEMANA": aula["DIA_DA_SEMANA"].strip().lower(),
                    }

                    chave = (
                        aula_limpa["DISCIPLINA"].upper(),
                        aula_limpa["TURMA"].upper(),
                        aula_limpa["DIA_DA_SEMANA"],
                        aula_limpa["HORÁRIO_INICIAL"],
                        aula_limpa["SALA"].upper(),
                    )
                    if chave not in chaves_vistas:
                        chaves_vistas.add(chave)
                        todas_aulas.append(aula_limpa)
                        novas += 1

                if todas_aulas:
                    salvar_json(todas_aulas)

                duracao = round(time.time() - inicio, 1)
                print(
                    f"   -> [{modelo_usado}] {len(aulas_foto)} lidas ({novas} novas) em {duracao}s. Total acumulado: {len(todas_aulas)}",
                    flush=True,
                )

                # Pausa de 16s para respeitar tranquilamente o limite de 5 RPM sem bloqueios
                time.sleep(16)

            except Exception as e:
                print(f"   -> Erro em {img_path.name} ({nome_parte}): {e}", flush=True)
                if not modelos_ativos:
                    break

    if not todas_aulas:
        print("\nNenhuma aula extraída. O arquivo 'public/horarios2.json' não foi alterado.", flush=True)
        return

    print(f"\nConcluído! {len(todas_aulas)} aulas únicas salvas em '{ARQUIVO_SAIDA}'.", flush=True)


if __name__ == "__main__":
    processar_fotos()