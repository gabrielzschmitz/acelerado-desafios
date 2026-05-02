# acelerado-desafios

Desafios mensais de performance da comunidade do canal **Waine - Dev do Desempenho**.

Todo dia 1º de cada mês um problema novo é publicado aqui. Você implementa a solução em **qualquer linguagem**, empacota num `Dockerfile`, abre um PR. No fim do mês as soluções são executadas em hardware fixo, o ranking é gerado e os resultados saem no Discord.

## Como funciona

1. **Dia 1**: o desafio do mês é publicado em `YYYY-MM-<nome>/`. O bot anuncia no Discord.
2. **Durante o mês**: você desenvolve sua solução em `solutions/<seu-usuario>/` no formato descrito em [SUBMISSION.md](SUBMISSION.md). Submissões ficam em branches `submissions/<usuario>` (privadas até o fechamento) ou opcionalmente em `main` (públicas durante o mês — quem quer flexar antes do tempo).
3. **Dia 1 do mês seguinte**: prazo encerra. O mantenedor roda o benchmark em hardware fixo, gera `results.json`, e o bot publica o post de resultados.

## Estrutura

```
YYYY-MM-<nome>/
├── README.md            ← enunciado do problema (PT-BR)
├── spec.json            ← métrica primária, direção, caps
├── inputs/              ← entradas de teste públicas
├── expected/            ← saídas de referência (ground truth)
├── bench/run.sh         ← harness de benchmark
└── reference/           ← implementação de referência + ferramentas
```

## Métricas

Cada desafio declara **uma métrica primária** em `spec.json`. Pode ser:

- `time_ms` — tempo mediano de execução (via `hyperfine`)
- `peak_rss_mb` — pico de memória residente
- `disk_write_mb` — bytes escritos em disco
- `binary_size_bytes` — tamanho do executável
- `code_size_bytes` — tamanho do código-fonte (estilo code-golf)
- `quality` — métrica específica do problema (PSNR, MSE, etc.)

**Validação roda primeiro.** Se a saída não bate com a esperada (ou não atinge o threshold de qualidade), a submissão é desclassificada — sem score de performance.

**Caps sempre se aplicam.** Estourar qualquer limite (`time_ms`, `peak_rss_mb`, etc.) também desclassifica.

## Anti-cheat

- Inputs ocultos só revelados após o fechamento
- `--network=none` no container (sem chamadas remotas)
- `--read-only` (sem escrever fora de `/tmp`)
- Todas as submissões públicas após o fechamento → comunidade pode auditar

## Desafio atual

→ [`2026-05-deblur/`](2026-05-deblur/) — Deconvolução de Wiener (deblur de imagem por FFT)

## Histórico

_(em breve)_

## Licença

Ferramentas e harness: MIT (ver [LICENSE](LICENSE)).
Imagens dos datasets: ver atribuição no `README.md` de cada desafio.
