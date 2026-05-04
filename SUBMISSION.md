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

Pré-requisitos: [`gh`](https://cli.github.com/) autenticado (`gh auth login`)
e `docker` instalado. Substitua `MEU-USUARIO` pelo seu usuário do GitHub
e `2026-05-deblur` pelo slug do desafio do mês.

```bash
# 1. Fork + clone (cria o remote `origin` apontando pro seu fork)
gh repo fork wainejr/acelerado-desafios --clone --remote
cd acelerado-desafios

# 2. Branch da sua submissão
#    - submissions/<usuario> = privada (default; PR fica aberto até o fechamento)
#    - solutions/<usuario>   = pública desde já (mergeada em main)
git checkout -b submissions/MEU-USUARIO

# 3. Copia o template da linguagem que você prefere
cp -r 2026-05-deblur/example/python 2026-05-deblur/solutions/MEU-USUARIO

# 4. Edita o código
$EDITOR 2026-05-deblur/solutions/MEU-USUARIO/solution.py

# 5. Testa local (exemplo pro deblur de Maio/2026):
docker build -t deblur-meu 2026-05-deblur/solutions/MEU-USUARIO/
docker run --rm --network=none --read-only -i deblur-meu \
    < 2026-05-deblur/inputs/house.bmp > /tmp/out.bmp

#    Confere PSNR contra o esperado:
uv run --project 2026-05-deblur/reference \
    python 2026-05-deblur/reference/score.py \
    /tmp/out.bmp 2026-05-deblur/expected/house.bmp

# 6. Commit + push pro seu fork
git add 2026-05-deblur/solutions/MEU-USUARIO/
git commit -m "submission(2026-05-deblur): MEU-USUARIO em Python"
git push -u origin HEAD

# 7. Abre o PR contra o upstream
gh pr create --repo wainejr/acelerado-desafios --base main \
    --title "submission(2026-05-deblur): MEU-USUARIO" \
    --body "linguagem: python"
```

Conferindo depois:

```bash
gh pr status                   # PRs abertos seus
gh pr checks                   # estado das checks (se/quando tiverem)
gh pr view --web               # abre no browser
```

Pra atualizar a submissão, é só commitar de novo no mesmo branch e
empurrar - o PR atualiza sozinho:

```bash
git add 2026-05-deblur/solutions/MEU-USUARIO/
git commit -m "submission(2026-05-deblur): otimiza FFT in-place"
git push
```

### Sem `gh`?

Mesmo fluxo com `git` puro - a única diferença é fazer o fork pela UI do
GitHub e abrir o PR pelo botão. Os comandos de branch/commit/push são iguais.

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
