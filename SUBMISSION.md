# Como submeter uma solução

Cada submissão é um diretório dentro de `<desafio>/solutions/<seu-usuario>/`
contendo:

- `Dockerfile` - constrói a imagem que roda sua solução
- Arquivos-fonte que o `Dockerfile` referencia
- `meta.json` (opcional) - metadados extras

Use `<desafio>/example/<linguagem>/` como template. Cada subpasta tem um
Dockerfile mínimo que já respeita o contrato de I/O do desafio (stdin
binário in, stdout binário out, sem disco gravável). Linguagens disponíveis
no exemplo de Maio/2026: `c`, `cpp`, `go`, `js`, `python`, `rust`, `zig`.

O **contrato de I/O**, **caps duros**, **comando exato do
harness** e **dicas específicas** ficam no `README.md` de cada desafio.

## Passo a passo

Cada passo abaixo lista as opções de **terminal** e de **navegador**.
Você pode misturar - por exemplo: forkar e criar a branch pela web,
editar no [github.dev](https://github.dev), e só descer pro terminal pra
rodar o teste com Docker.

Substitua `MEU-USUARIO` pelo seu usuário do GitHub e `2026-05-deblur`
pelo slug do desafio do mês.

Pré-requisitos variam pelo caminho:

- **Terminal**: [`gh`](https://cli.github.com/) (`gh auth login`), `git`
  e `docker`. Faltando `gh`, dá pra forkar/abrir PR pela web e usar
  `git` puro no resto.
- **Só navegador**: nada além de uma conta no GitHub. Você abre mão do
  passo 5 (teste local com Docker) e descobre o resultado pelo feedback
  do PR.

### 1. Fork do repo

- **Web**: na página `github.com/wainejr/acelerado-desafios`, clica em
  **Fork** no canto superior direito e confirma.
- **Terminal** (com `gh`):
  ```bash
  gh repo fork wainejr/acelerado-desafios --clone --remote
  cd acelerado-desafios
  ```
- **Terminal** (sem `gh`): forka pela web, depois clona seu fork:
  ```bash
  git clone git@github.com:MEU-USUARIO/acelerado-desafios.git
  cd acelerado-desafios
  ```

### 2. Cria a branch da submissão

`submissions/<usuario>` fica privada (PR aberto até o fechamento do
desafio). `solutions/<usuario>` fica pública desde já (mergeada em main
durante o mês).

- **Web (UI normal)**: no seu fork, clica no dropdown de branches e
  digita `submissions/MEU-USUARIO` -> **Create branch ... from main**.
- **Web (github.dev)**: no seu fork, aperta `.` no teclado pra abrir o
  editor. No canto inferior esquerdo, clica em `main` -> **Create new
  branch** -> digita o nome.
- **Terminal**:
  ```bash
  git checkout -b submissions/MEU-USUARIO
  ```

### 3. Copia o template da linguagem

Cada subpasta de `<desafio>/example/` tem um Dockerfile mínimo
passthrough. Copia ela inteira pra `<desafio>/solutions/MEU-USUARIO/`.

- **Web (github.dev)**: no painel de arquivos, botão direito em
  `2026-05-deblur/example/python/` -> **Copy**. Entra em
  `2026-05-deblur/solutions/` -> botão direito -> **Paste**, e renomeia
  a pasta colada para `MEU-USUARIO`.
- **Web (UI normal)**: cria a pasta abrindo um arquivo novo em
  `2026-05-deblur/solutions/MEU-USUARIO/Dockerfile`, e cola o conteúdo
  de cada arquivo do `example/` que você quer reaproveitar (mais
  trabalhoso, evita se der).
- **Terminal**:
  ```bash
  cp -r 2026-05-deblur/example/python 2026-05-deblur/solutions/MEU-USUARIO
  ```

### 4. Edita o código

- **Web (github.dev)**: edita direto no editor.
- **Web (UI normal)**: clica no lápis em cada arquivo - já abre o modal
  de commit no fim.
- **Terminal**:
  ```bash
  $EDITOR 2026-05-deblur/solutions/MEU-USUARIO/solution.py
  ```

### 5. Testa localmente (terminal apenas)

Esse passo precisa de Docker. Se você está só pelo navegador, pula -
você vai descobrir se passa a validação pelo feedback do PR.

```bash
docker build -t deblur-meu 2026-05-deblur/solutions/MEU-USUARIO/
docker run --rm --network=none --read-only -i deblur-meu \
    < 2026-05-deblur/inputs/house.bmp > /tmp/out.bmp

# Confere PSNR contra o esperado:
uv run --project 2026-05-deblur/reference \
    python 2026-05-deblur/reference/score.py \
    /tmp/out.bmp 2026-05-deblur/expected/house.bmp
```

### 6. Commit + push pro seu fork

- **Web (github.dev)**: aba **Source Control** (`Ctrl+Shift+G`), digita
  a mensagem (ex: `submission(2026-05-deblur): MEU-USUARIO em Python`)
  e clica em **Commit & Push**.
- **Web (UI normal)**: cada edição/upload abre um modal de commit -
  preenche e salva direto na sua branch.
- **Terminal**:
  ```bash
  git add 2026-05-deblur/solutions/MEU-USUARIO/
  git commit -m "submission(2026-05-deblur): MEU-USUARIO em Python"
  git push -u origin HEAD
  ```

### 7. Abre o PR contra o upstream

O formulário do PR já vem preenchido com o template em
`.github/PULL_REQUEST_TEMPLATE.md` - completa as seções e abre.

- **Web**: na página do seu fork depois do push, aparece um banner
  amarelo **Compare & pull request** - clica. Confirma que o base é
  `wainejr/acelerado-desafios:main` e o compare é sua branch.
- **Terminal** (com `gh`): sem `--body`, o `gh` abre o editor já com o
  template carregado.
  ```bash
  gh pr create --repo wainejr/acelerado-desafios --base main \
      --title "submission(2026-05-deblur): MEU-USUARIO"
  ```

## Atualizando a submissão depois

Commita de novo no mesmo branch e empurra - o PR atualiza sozinho.

- **Web (github.dev)**: edita -> Source Control -> **Commit & Push**.
- **Terminal**:
  ```bash
  git add 2026-05-deblur/solutions/MEU-USUARIO/
  git commit -m "submission(2026-05-deblur): otimiza FFT in-place"
  git push
  ```

## Conferindo o status do PR

- **Web**: abre o PR direto no GitHub.
- **Terminal** (com `gh`):
  ```bash
  gh pr status                   # PRs abertos seus
  gh pr view --web               # abre no browser
  ```

## `meta.json` (opcional)

```json
{
  "language": "C",
  "display_name": "Fulano",
  "public_during_month": false
}
```

- `language`: aparece no post de resultados.
- `display_name`: como você quer ser citado (default: GitHub username).
- `public_during_month`: se `true`, sua submissão é mesclada em `main`
  imediatamente - fica visível pra todo mundo durante o mês. Default
  `false` (privada até o fechamento do desafio).

## Validação manual

Sem CI por enquanto - a validação roda local e a resposta sai no PR (pode
levar alguns dias). Se a submissão for desclassificada (não passa a
validação do desafio, ou estoura algum cap declarado), você fica sabendo
no PR e pode corrigir empurrando um novo commit no mesmo branch.
