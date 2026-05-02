# Como submeter uma solução

Cada submissão é um diretório dentro de `<desafio>/solutions/<seu-usuario>/`
contendo:

- `Dockerfile` — constrói a imagem que roda sua solução
- Arquivos-fonte que o `Dockerfile` referencia
- `meta.json` (opcional) — metadados extras

O **contrato de I/O**, **caps de tempo/memória**, **comando exato do
harness** e **dicas específicas** ficam no `README.md` de cada desafio.
Cada desafio também tem um `<desafio>/example/` com um Dockerfile mínimo
que serve de template.

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
  imediatamente — fica visível pra todo mundo durante o mês. Default
  `false` (privada até o fechamento do desafio).

## Como abrir o PR

1. Fork do repo
2. Branch `submissions/<seu-usuario>` (privacidade padrão) **ou**
   `solutions/<seu-usuario>` no `main` (público)
3. PR contra o branch correspondente no upstream
4. Aguarde validação manual — sem CI por enquanto, eu confirmo no PR (pode levar alguns dias)
