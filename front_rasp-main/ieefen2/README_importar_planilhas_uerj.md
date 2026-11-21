# Importador de Planilhas das Secretarias (`importar_planilhas_uerj.py`)

## Visão Geral
Quando as secretarias dos departamentos enviam os arquivos originais de alocação (`.csv` ou `.xlsx`), este script oferece o caminho mais rápido e livre de erros para atualizar o painel. Ele lê as planilhas localmente usando `pandas`, reconhece os diferentes padrões de colunas usados na UERJ, normaliza os horários e mescla os dados ao `public/horarios2.json` em menos de 1 segundo — sem depender de internet ou APIs de IA.

---

## Como o Script Funciona (Passo a Passo Interno)

1. **Detecção Automática de Formato e Codificação (`carregar_tabela`):**
   - Suporta planilhas Excel (`.xlsx`, `.xls`) e arquivos `.csv`.
   - Para CSVs, detecta automaticamente se o separador é ponto e vírgula (`;`, padrão do Excel em português) ou vírgula (`,`), e testa múltiplas codificações (`utf-8-sig`, `utf-8`, `latin1`, `cp1252`) para evitar quebra de acentos em nomes de disciplinas e professores.
   - **Busca inteligente do cabeçalho:** Planilhas de secretaria costumam ter 2 ou 3 linhas de título no topo (ex.: `"UNIVERSIDADE DO ESTADO DO RIO DE JANEIRO"`, `"ALOCAÇÃO DE SALAS 2026.2"`). O script varre as 10 primeiras linhas até encontrar onde estão os títulos reais (`Disciplina`, `Turma`, `Sala`, `Tempo`, etc.).

2. **Mapeamento Dinâmico de Colunas (`identificar_colunas`):**
   - Não exige que os arquivos tenham nomes de colunas idênticos. Ele normaliza acentos e maiúsculas/minúsculas para mapear variações como:
     - `Disciplina`, `Matéria`, `Componente` ➔ `DISCIPLINA`
     - `T`, `Turma`, `Turmas` ➔ `TURMA`
     - `Prof`, `Professor`, `Docente` ➔ `PROFESSOR`
     - `Sala`, `Salas`, `Local` ➔ `SALA`
     - `Dia`, `Dias` ➔ `DIA_DA_SEMANA`
     - `Tempo`, `Tempos`, `Hor`, `Horário` ➔ `HORÁRIO_INICIAL` e `HORÁRIO_FINAL`

3. **Preenchimento de Células Mescladas (`ffill`):**
   - No Excel, quando uma disciplina tem duas turmas ou dois dias da semana, o nome da disciplina costuma ficar em uma célula mesclada (deixando as linhas de baixo vazias na exportação CSV). O script preenche automaticamente esses espaços vazios com o nome da disciplina imediatamente acima.

4. **Suporte a Dois Layouts de Horário:**
   - **Layout A (Colunas separadas):** Quando há uma coluna `Dia` (`Segunda-feira`) e uma coluna `Tempo` (`M3M4`), ele cruza as duas diretamente.
   - **Layout B (Células agrupadas):** Quando dia e horário vêm juntos (ex.: `"Seg T2T3T4, Qui T2T3"` ou colunas múltiplas `HOR` como `"2ªT1T3"` e `"4ªT1T2"`), ele quebra cada dia em um objeto separado e associa com a sala correspondente.
   - Aceita tanto códigos da UERJ (`M1` a `N5`) quanto horários escritos diretamente (`07:00 - 08:40` ou `19h30 às 22h00`).

5. **Modo Mesclagem (`MESCLAR_COM_JSON_ATUAL`):**
   - Permite importar a planilha de **apenas um departamento** (ex.: só o CSV da Elétrica) sem apagar os outros 5 departamentos que já estavam no `public/horarios2.json`. Ele usa a chave `(DISCIPLINA, TURMA, DIA_DA_SEMANA, HORÁRIO_INICIAL)` para atualizar salas e professores exatamente nas turmas correspondentes.

---

## Pré-requisitos e Instalação

- **Python 3.10 ou superior**
- **Bibliotecas necessárias:**
  ```bash
  pip install pandas openpyxl
  ```
  *(O pacote `openpyxl` é necessário apenas para ler arquivos `.xlsx`.)*

---

## Configurações no Código

No início do arquivo `importar_planilhas_uerj.py`:

```python
PASTA_PLANILHAS = "planilhas_secretaria"
ARQUIVO_SAIDA = "public/horarios2.json"

# True = mantém as aulas já existentes no horarios2.json e apenas adiciona/atualiza as do CSV
# False = apaga o horarios2.json anterior e salva somente o que estiver nas planilhas da pasta
MESCLAR_COM_JSON_ATUAL = True

# True = se a planilha tiver coluna CURSO (como as do IME), filtra apenas turmas da Engenharia
FILTRAR_APENAS_ENGENHARIA = True
```

---

## Como Executar

1. Crie a pasta `planilhas_secretaria/` na raiz do projeto (caso ainda não exista).
2. Coloque dentro dela os arquivos `.csv` ou `.xlsx` recebidos.
3. Execute no terminal:
   ```bash
   python importar_planilhas_uerj.py
   ```
4. Confira o resultado e publique na TV:
   ```bash
   git add public/horarios2.json
   git commit -m "Atualiza horarios via planilha da secretaria"
   git push
   ```

---

## Solução de Problemas Comuns

- **`Colunas de disciplina ou horário não identificadas`:** Abra o CSV/Excel e verifique se os nomes das colunas contêm palavras como `Disciplina` (ou `Matéria`) e `Tempo` (ou `Horário` / `Hor`). Caso a secretaria use um cabeçalho diferente, basta incluir a palavra-chave na função `identificar_colunas`.
- **`Missing optional dependency 'openpyxl'`:** A planilha está em formato Excel (`.xlsx`) e a biblioteca não está instalada. Rode `pip install openpyxl` no terminal.
- **Horários duplicados após mudança de turno pela secretaria:** Se uma secretaria mudou o dia ou horário de uma turma inteira (ex.: passou de segunda para terça), o modo `MESCLAR_COM_JSON_ATUAL = True` manterá o horário antigo de segunda-feira salvo. Nesse caso, remova manualmente a entrada antiga no JSON ou rode o script com `MESCLAR_COM_JSON_ATUAL = False` contendo todas as planilhas atualizadas do semestre.