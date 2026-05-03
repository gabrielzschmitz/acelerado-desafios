# acelerado-desafios

Desafios mensais de performance da [**Comunidade do Desempenho**](https://discord.gg/NNuzYsNPjV).

Todo dia 1º de cada mês um problema novo é publicado aqui. Você implementa em **qualquer linguagem**, empacota num `Dockerfile`, abre um PR. No fim do mês as soluções são executadas em hardware fixo, o ranking é gerado e os resultados saem em vídeo no [canal](https://www.youtube.com/@waine_jr) + post no [Discord](https://discord.gg/NNuzYsNPjV).

## Desafios

| Mês     | Desafio                                                       | Métrica  |
|---------|---------------------------------------------------------------|----------|
| 2026-05 | [Drone amador - desfocando o autofoco ruim](2026-05-deblur/)  | PSNR ↑   |

> Novos desafios são adicionados dia 1º de cada mês.

## Comunidade

A discussão dos desafios rola no [**Discord da Comunidade do Desempenho**](https://discord.gg/NNuzYsNPjV):
dúvidas, soluções, análises pós-fechamento e os anúncios oficiais dos
problemas saem por lá. Quem participa dos rankings tá no servidor.

**Entre:** [discord.gg/NNuzYsNPjV](https://discord.gg/NNuzYsNPjV)

Outros canais:

- **YouTube** - [@waine_jr](https://www.youtube.com/@waine_jr) (vídeos com explicações e retrospectivas)
- **Site** - [wainejr.com](https://wainejr.com)
- **GitHub** - [@wainejr](https://github.com/wainejr)
- **Instagram** - [@waine_jr](https://www.instagram.com/waine_jr/)
- **TikTok** - [@waine_jr](https://www.tiktok.com/@waine_jr)

## Como funciona

1. **Dia 1**: o desafio do mês é publicado em `YYYY-MM-<nome>/` e anunciado nos canais da [**Comunidade do Desempenho**](https://discord.gg/NNuzYsNPjV) ([YouTube](https://www.youtube.com/@waine_jr) / [Discord](https://discord.gg/NNuzYsNPjV)).
2. **Durante o mês**: você desenvolve sua solução em `<desafio>/solutions/<seu-usuario>/` no formato descrito em [SUBMISSION.md](SUBMISSION.md). Submissões ficam em branches `submissions/<usuario>` (privadas até o fechamento) ou opcionalmente em `main` (públicas durante o mês - pra quem quer flexar antes do tempo).
3. **Dia 1 do mês seguinte**: prazo encerra. Os benchmarks são rodados localmente em hardware fixo, monto o ranking, e os resultados são publicados no [Discord](https://discord.gg/NNuzYsNPjV) (*+ vídeo no [canal](https://www.youtube.com/@waine_jr)*).

> Nada disso é automatizado por enquanto - sem CI, sem bot. Se sua submissão tiver algum problema, respondo no PR.

## Métricas

Cada desafio declara no próprio `README.md` e `spec.json`:

- A **métrica primária** que define o ranking, junto com a direção (maximizar ou minimizar).
- Os **caps duros** que desclassificam a submissão se estourados.
- O **critério de validação** que a saída precisa atingir antes de entrar no ranking.

A natureza dessas três coisas varia desafio a desafio - não tem regra global. Vale sempre o que está escrito no enunciado do mês.

**Validação roda primeiro.** Se a saída não passa o critério do desafio, a submissão é desclassificada antes de qualquer pontuação.
**Caps sempre se aplicam.** Estourar qualquer cap declarado pelo desafio também desclassifica.

## Anti-cheat

- Inputs ocultos só revelados após o fechamento
- `--network=none` no container (sem chamadas remotas)
- `--read-only` no container - regras exatas de escrita em disco no README de cada desafio
- Todas as submissões públicas após o fechamento -> comunidade pode auditar

## Estrutura do repo

```
YYYY-MM-<nome>/
├── README.md            ← enunciado do problema (PT-BR)
├── spec.json            ← métrica primária, direção, caps
├── inputs/              ← entradas de teste públicas
├── expected/            ← saídas de referência (ground truth)
├── bench/run.sh         ← harness de benchmark
└── reference/           ← implementação de referência + ferramentas
```

## Licença

Ferramentas e harness: MIT (ver [LICENSE](LICENSE)).
Imagens dos datasets: ver atribuição no `README.md` de cada desafio.
