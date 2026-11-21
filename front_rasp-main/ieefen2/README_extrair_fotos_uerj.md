# Extrator de Grades via Fotos do Mural (`extrair_fotos_uerj.py`)

## Visão Geral
No início de cada período letivo, vários departamentos da UERJ divulgam a alocação de salas exclusivamente em folhas impressas coladas nos murais físicos antes de atualizarem o site. Cada departamento usa um layout de tabela diferente (alguns separam dia e tempo em colunas, outros juntam tudo em texto corrido, e o IME inclui colunas de curso).

O `extrair_fotos_uerj.py` resolve esse problema usando **Visão Computacional (API do Google Gemini)** combinada com validação rigorosa via **Pydantic**, transformando fotos tiradas pelo celular diretamente no arquivo `public/horarios2.json` pronto para a TV.

---

## Como o Script Funciona (Passo a Passo Interno)

1. **Pré-processamento e Recorte Inteligente (`preparar_recortes`):**
   - Corrige automaticamente a rotação da foto usando os metadados EXIF da câmera (`ImageOps.exif_transpose`).
   - Aplica um realce controlado de nitidez (`1.35x`) e contraste (`1.10x`) para destacar letras pequenas e bordas de células.
   - **Divisão em 2 metades com sobreposição:** Fotos verticais de murais costumam conter 2 ou 3 folhas empilhadas. Se enviadas inteiras, os números de sala ficam pequenos demais. O script corta cada imagem vertical em **Parte 1 (0% a 62% da altura)** e **Parte 2 (38% a 100% da altura)**. Essa sobreposição de ~24% no meio garante que nenhuma linha seja cortada ao meio sem leitura.

2. **Extração Estruturada de Alta Precisão (`chamar_gemini_com_precisao`):**
   - Envia cada recorte em resolução máxima (`MEDIA_RESOLUTION_HIGH`) com `temperature=0.0` (elimina criatividade/chutes) e orçamento de raciocínio (`thinking_budget=4096`) para que o modelo trace visualmente cada linha da esquerda até a coluna da sala.
   - **Âncora Anti-Alucinação (`TRECHO_ORIGINAL`):** O esquema Pydantic exige que a IA primeiro transcreva literalmente o trecho bruto lido na linha (ex.: `"Qua M3M4 | 5097-F"`) antes de preencher os campos convertidos `HORÁRIO_INICIAL` e `HORÁRIO_FINAL`. Antes de salvar no JSON final, o script descarta esse campo auxiliar.

3. **Fallback Automático de Modelos e Controle de Cota:**
   - Na camada gratuita do Google AI Studio, os modelos Flash completos possuem limite de **5 requisições por minuto (RPM)** e **20 requisições por dia (RPD)** por modelo.
   - O script aguarda **16 segundos** entre cada recorte para nunca estourar o limite por minuto.
   - Se um modelo atingir a cota diária (`429 RESOURCE_EXHAUSTED`), ele alterna automaticamente para o próximo da lista (`gemini-3.8-flash` ➔ `gemini-3.6-flash` ➔ `gemini-3-flash-preview` ➔ `gemini-2.5-flash`), somando até 80 requisições diárias sem interromper o trabalho.

4. **Deduplicação e Salvamento Incremental:**
   - Como os recortes têm faixa sobreposta (e pode haver fotos repetidas do mesmo mural), o script gera uma assinatura única `(DISCIPLINA, TURMA, DIA_DA_SEMANA, HORÁRIO_INICIAL, SALA)` para cada aula e descarta duplicatas.
   - O arquivo `public/horarios2.json` é salvo **após cada recorte processado**. Se você interromper o terminal no meio, todo o progresso anterior já estará salvo.

---

## Pré-requisitos e Instalação

- **Python 3.10 ou superior**
- **Chave de API gratuita do Google AI Studio** (`aistudio.google.com`)
- **Bibliotecas necessárias:**
  ```bash
  pip install google-genai pydantic pillow
  ```

---

## Preparação e Segurança

1. Crie a pasta `fotos_mural/` na raiz do projeto e coloque todas as fotos dentro dela.
2. **Importante:** Adicione `fotos_mural/` ao seu arquivo `.gitignore` para não subir imagens pesadas para o GitHub.
3. **Nunca escreva sua chave de API dentro do arquivo `.py`.** Defina-a apenas na memória da sessão do terminal antes de rodar:
   ```bash
   export GEMINI_API_KEY="SUA_CHAVE_DO_AI_STUDIO_AQUI"
   ```

---

## Configurações no Código

No topo do `extrair_fotos_uerj.py`:

```python
PASTA_FOTOS = "fotos_mural"
ARQUIVO_SAIDA = "public/horarios2.json"

# True = nas planilhas do IME (DEP I, II, III), extrai apenas turmas da Engenharia (FEN / C.Comp / Eng)
# False = extrai absolutamente todas as disciplinas visíveis (Física, Matemática, Química, etc.)
FILTRAR_APENAS_ENGENHARIA = True
```

---

## Como Executar

No terminal (Git Bash no Windows), utilize sempre a flag **`-u`** (*unbuffered*) para visualizar o progresso linha a linha em tempo real:

```bash
python -u extrair_fotos_uerj.py
```

*Nota: Devido à divisão em 2 recortes por foto e à pausa de 16 segundos para respeitar o limite gratuito da API, um lote de 15 fotos leva cerca de 8 a 10 minutos para concluir.*

---

## Boas Práticas e Solução de Problemas

- **Dicas para fotografar o mural:** Tire **1 foto por folha**, mantenha o celular paralelo à parede (evite fotos inclinadas) e, se receber imagens pelo WhatsApp, peça para enviarem como **Documento** (o envio comum como foto comprime a imagem e borra números de sala pequenos).
- **Terminal parece travado sem mostrar texto:** Você provavelmente rodou sem `-u`. Aperte `Ctrl + C` e execute `python -u extrair_fotos_uerj.py`.
- **`RuntimeError: Defina a variável GEMINI_API_KEY`:** Você abriu uma nova janela do terminal e a variável de ambiente foi limpa. Rode `export GEMINI_API_KEY="..."` novamente.