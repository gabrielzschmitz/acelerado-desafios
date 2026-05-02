# Junho 2026 — Deconvolução de Wiener (deblur por FFT)

> **TL;DR**: você recebe uma imagem borrada por uma gaussiana 2D conhecida.
> Tem que devolver a imagem nítida. O ranking é por **tempo de execução**
> (`time_ms`), com PSNR mínimo de validação. **Quem entrega rápido sem
> perder qualidade vence.**

## Contexto real

Toda imagem que sai de um sensor real passa por um **borrão**: lente fora de
foco, mão tremendo, atmosfera turbulenta (astrofotografia), profundidade de
campo limitada (microscopia). Matematicamente, o sensor registra:

```
borrado(x, y) = (nítido ⊛ PSF)(x, y) + ruído(x, y)
```

Onde `⊛` é convolução 2D e o **PSF** (*Point Spread Function*) é a "assinatura"
do borrão — a forma com que um único ponto de luz aparece na imagem final.

**Recuperar `nítido` a partir de `borrado`, sabendo o PSF, é deconvolução** —
um problema clássico de processamento de sinais com aplicações em telescópios,
microscópios, scanners, câmeras de celular (modo retrato), e visão computacional
embarcada. O algoritmo canônico, e o que vamos usar como mínimo de qualidade
aqui, é o **filtro de Wiener** no domínio da frequência:

```
F̂(u, v) = G(u, v) · conj(H(u, v)) / ( |H(u, v)|² + λ )
nítido_estimado = IFFT( F̂ )
```

Onde:

- `G = FFT(borrado)`
- `H = FFT(PSF)`
- `λ` é uma constante de regularização (proxy do ruído)

## O problema

**Forward model** usado para gerar os inputs (cada participante deve assumir o
mesmo na hora de inverter):

1. PSF = gaussiana 2D periódica com **σ = 2.0** (kernel implícito do tamanho da
   imagem inteira, normalizado pra somar 1 no domínio espacial — ver "Construir
   o PSF" abaixo).
2. Convolução circular (FFT-based, condição de contorno periódica): `F = G · H`.
3. Ruído aditivo gaussiano com **σ_n = 1.0** (em escala 0–255).
4. Clipping em `[0, 255]` e quantização para `uint8`.

Sua tarefa: dado `borrado`, devolver uma estimativa de `nítido` que minimize
o tempo de execução respeitando o threshold de PSNR.

## Contrato de I/O

- **Entrada (stdin)**: arquivo BMP 24-bit, **512×512**, sem compressão,
  grayscale armazenado como R = G = B em cada pixel. Header de 54 bytes
  (BITMAPFILEHEADER + BITMAPINFOHEADER), pixels começam no byte 54, linhas
  armazenadas de baixo pra cima, BGR por pixel. Width 512 → row stride 1536
  bytes, **sem padding**.
- **Saída (stdout)**: BMP no exato mesmo formato, mesmas dimensões, com a
  imagem deblur'd. Pixels fora de `[0, 255]` devem ser clipados antes de
  escrever em uint8.

Sua solução **não recebe argumentos**. Não tem rede, não pode escrever
fora de `/tmp`. Veja [`../SUBMISSION.md`](../SUBMISSION.md) pro contrato
completo do container.

## Spec

```json
{
  "primary_metric": "time_ms",
  "direction": "min",
  "psf": {"type": "gaussian", "sigma": 3.0},
  "noise": {"type": "gaussian", "sigma": 1.0},
  "validation": {"metric": "psnr", "min_db": 22.0},
  "caps": {"time_ms": 30000, "peak_rss_mb": 1024, "disk_write_mb": 50}
}
```

Detalhes em [`spec.json`](spec.json).

### Validação

- **PSNR ≥ 22 dB** contra `expected/<caso>.bmp` em **todos** os casos
  (públicos + ocultos). PSNR é calculado como
  `10 · log₁₀(255² / MSE)`, onde MSE é o erro quadrático médio sobre os
  262 144 pixels.
- Solução com PSNR abaixo do threshold em qualquer caso é **desclassificada**
  — não recebe score de tempo.

### Caps

- `time_ms ≤ 30 000` (30 segundos por caso)
- `peak_rss_mb ≤ 1024` (1 GB de RSS)
- `disk_write_mb ≤ 50` (escrita em `/tmp`)

Estourar qualquer cap também desclassifica.

### Ranking

`time_ms` mediano (5 runs medidos + 1 warmup, via `hyperfine`), agregado
sobre todos os casos pela **mediana das medianas**. Empates desempatados
pelo timestamp de submissão (mais cedo vence).

## Construir o PSF

A PSF gaussiana com σ = 2.0 é construída no domínio da frequência como:

```python
import numpy as np

def gaussian_psf_freq(shape, sigma):
    h, w = shape
    yy = np.fft.fftfreq(h) * h
    xx = np.fft.fftfreq(w) * w
    yy, xx = np.meshgrid(yy, xx, indexing="ij")
    psf = np.exp(-(xx**2 + yy**2) / (2 * sigma**2))
    psf /= psf.sum()
    return np.fft.fft2(psf)
```

(Equivalente: kernel gaussiano centrado em `(0, 0)` com periodicidade
implícita 512 e somado a 1.) Implementações em outras linguagens devem
reproduzir exatamente esse layout — sob pena de a deconvolução errar a
fase.

## Dataset público

9 imagens clássicas de processamento, todas normalizadas para 512×512 em
escala de cinza. Originais em `reference/originals/` (gerado on-demand
pelo script de geração; não commitado).

| Slug | Imagem | Origem |
|---|---|---|
| `cameraman` | The Cameraman | MIT (via skimage.data) |
| `mandrill` | Mandrill (Baboon) | USC-SIPI 4.2.03 |
| `peppers` | Peppers | USC-SIPI 4.2.07 |
| `airplane` | F-16 Airplane | USC-SIPI 4.2.05 |
| `lake` | Sailboat on Lake | USC-SIPI 4.2.06 |
| `boat` | Boat | USC-SIPI boat.512 |
| `house` | House | USC-SIPI 4.1.05 (upscaled) |
| `couple` | Couple | USC-SIPI 5.2.08 |
| `stream` | Stream and bridge | USC-SIPI 5.2.10 |

`inputs/<slug>.bmp` — versão borrada + ruidosa. **É o que sua solução lê.**
`expected/<slug>.bmp` — ground truth. **É contra o que o PSNR é computado.**

## Dataset oculto

Existem casos ocultos adicionais que só são revelados quando o desafio
encerra. Sua solução roda contra eles no benchmark final. Não dá pra
olhar antes — qualquer estratégia de "decorar a saída" cai aqui.

## Como testar localmente

Pré-requisitos: `uv` (Python 3.11+), `docker`.

```bash
# Gera o dataset (cache em reference/originals/, faz a parte de rede uma vez)
uv run python 2026-06-deblur/reference/generate.py

# Roda a referência num caso e confere o PSNR
uv run python 2026-06-deblur/reference/wiener.py \
    < 2026-06-deblur/inputs/cameraman.bmp \
    > /tmp/cameraman_out.bmp

uv run python 2026-06-deblur/reference/score.py \
    /tmp/cameraman_out.bmp \
    2026-06-deblur/expected/cameraman.bmp
# → algo tipo "29.4321"
```

Pra rodar o bench harness na referência (precisa de `docker` + `hyperfine` + `jq`):

```bash
docker build -t acelerado-ref:bench 2026-06-deblur/reference/
2026-06-deblur/bench/run.sh 2026-06-deblur/reference/
```

## Como submeter

Veja [`../SUBMISSION.md`](../SUBMISSION.md). TL;DR:

1. `solutions/<seu-usuario>/Dockerfile` constrói sua solução
2. Container lê BMP de stdin, escreve BMP em stdout
3. PR contra a branch `submissions/<seu-usuario>` ou `main` (público)

## Atribuição

As imagens do USC-SIPI são distribuídas pela University of Southern
California, Signal and Image Processing Institute, "for research and
educational use". O projeto é uma comunidade educacional — agradecemos
ao SIPI por manter o dataset disponível desde a década de 1970.
