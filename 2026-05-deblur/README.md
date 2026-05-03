# Maio 2026 - Drone amador: desfocando o autofoco ruim

## O cenário

Uma área que sempre puxou e guiou o desenvolvimento de software e de algoritmos é a fotografia.
Desde que as câmeras surgiram - e principalmente depois da digitalização - programas de edição, melhoria e processamento viraram ferramenta de trabalho dos amadores aos profissionais.
Se antes pra ter uma foto decente você precisava entender de exposição, iluminação e foco, hoje a câmera do seu celular toma várias dessas decisões editoriais por você pra deixar a foto mais instagramável.

Só que essa luxúria assume hardware e algoritmo caros.
Nem todo dispositivo tem acesso ao tipo de câmera que cabe num iPhone - drones amadores, por exemplo, precisam balancear o sistema de câmera com peso, controle, bateria e custo.
O resultado é uma câmera CMOS monocromática barata, lente plástica, e **autofoco contínuo de baixo custo, sem gimbal de qualidade**.

Consequência prática: em drone amador é comum que vários frames saiam borrados - e a causa de longe mais comum é o **autofoco**.
A cada frame o sensor recalcula onde focar, e como o algoritmo é ruim ele **erra de forma diferente cada vez**: em algumas tomadas pega quase certo, em outras fica bem fora de foco.
O efeito é um **borrão aproximadamente gaussiano** cuja intensidade depende de quanto o autofoco errou naquele frame específico.
Em cima disso, o sensor (sem resfriamento, ganho médio) ainda joga um chiado fino de ruído eletrônico que aparece como granulação nas áreas escuras.

| Frame que saiu do drone | Como a foto deveria ser |
|:---:|:---:|
| ![borrado](docs/house_inputs.png) | ![nítido](docs/house_expected.png) |

> **Quer o contexto antes da spec?** [comece-aqui.md](comece-aqui.md) tem uma introdução curta com a teoria por trás do desafio - deconvolução, FFT e o filtro de Wiener - explicada em linguagem direta.

## A tarefa

Você quer recuperar a melhor estimativa possível da imagem nítida pra cada frame ruim.
E não offline no laptop depois do voo - **a bordo, em tempo real**, pra liberar o próximo frame da pipeline imediatamente.
O alvo é processar a 5 fps no mínimo (uma imagem a cada 200 ms) rodando direto no SoC da própria câmera, que num drone dessa categoria tem na ordem de **64 MB de RAM disponível** pro processamento depois do resto do firmware.

Concretamente: **dado um BMP borrado de 512x512, escrever um BMP do mesmo tamanho com a versão nítida estimada**, dentro do orçamento de 200 ms e 64 MB.

O desafio é por **qualidade**: quem recupera mais detalhe (mais fiel à imagem original) ganha.
A fidelidade é medida via **PSNR** - explicada em detalhe na seção [Ranking](#ranking) abaixo.
Os caps de tempo e memória são duros - estourou, desclassifica - mas abaixo deles tempo e memória extras não rendem nada, o que conta é a fidelidade.
Detalhes na [Spec](#spec) abaixo.

## Spec

### Formato de I/O

- **Entrada (stdin)**: BMP 24-bit, **512x512**, sem compressão, grayscale armazenado como R = G = B em cada pixel.
  - 14 bytes `BITMAPFILEHEADER` + 40 bytes `BITMAPINFOHEADER` = 54 bytes de cabeçalho, pixels começam no byte 54
  - Linhas de baixo pra cima, BGR por pixel, sem padding (row stride 1536 B)
- **Saída (stdout)**: BMP no exato mesmo formato e dimensões.
  Pixels fora de `[0, 255]` devem ser clipados antes de escrever em `uint8`.

Se você só quer ver o esqueleto da submissão rodando, em [`example/`](example/) moram Dockerfiles mínimos passthrough em **Python, JS, C, C++, Rust, Go e Zig** - escolhe a linguagem, copia, troca a lógica.

### Como o harness roda sua solução

```bash
docker run --rm \
  --cpuset-cpus=2,3 --cpus=2 \
  --memory=64m \
  --network=none --read-only \
  -i <sua-imagem> < inputs/<caso>.bmp > out.bmp
```

Sua solução **não pode escrever em nenhum arquivo**.
Apenas stdin de leitura, stdout/stderr de escrita, e RAM.
Tentar escrever em qualquer lugar (incluindo `/tmp`, `~/.cache`, `/var/log`) falha com `EROFS`.

Dicas pra não bater nessa parede:

- **Python**: rode com `python -B` (ou `PYTHONDONTWRITEBYTECODE=1`) pra não tentar escrever `.pyc`.
  Bibliotecas que cacheiam em `~/.cache` (matplotlib, numba JIT, etc.) podem falhar - pré-construa os caches no `Dockerfile`, não em runtime, ou use só `numpy` puro.
- **C/C++ com FFTW**: `fftw_wisdom` por default escreve em arquivo.
  Use apenas o wisdom embutido no binário ou desligue persistência.
- **GPU**: indisponível no bench (não tem GPU no host).

### Caps duros (tempo e memória)

Estourar qualquer um destes desclassifica a submissão:

- **Tempo de execução ≤ 200 ms por imagem** (mediana de 5 runs medidos por `hyperfine`, +1 warmup), correspondente aos 5 fps mínimos do alvo embarcado.
- **Memória de pico ≤ 64 MB** (`peak_rss_mb`, equivalente à RAM disponível no SoC de câmera do drone alvo).

Não há cap de qualidade - mesmo uma solução que recupera pouquíssimo detalhe é aceita; ela só vai ranquear baixo no PSNR (ver [Ranking](#ranking)).
Os dois caps de execução são apertados de propósito - eles refletem o orçamento real do hardware embarcado, não folga arbitrária do harness.
Implicações práticas:

- Solução baseada em rede neural treinada precisa caber no runtime: PyTorch e TensorFlow não cabem nem como runtime (ambos passam de 200 MB).
  Inferência tem que ser via runtime leve (ggml, ncnn, ONNX Runtime mínimo) ou implementação manual.
- Python + numpy puro cabe nos dois caps, mas sem folga: o interpretador + numpy ficam em ~50 MB depois do `import`, e o overhead do Python pesa contra os 200 ms.
- Compilados (C, C++, Rust, Zig, Go) têm overhead de runtime na casa de 1-5 MB e dão folga grande nos dois eixos.

### Ranking

A métrica de qualidade é o **PSNR** (peak signal-to-noise ratio - "razão sinal-ruído de pico").
Em termos simples: ela compara sua imagem reconstruída pixel-a-pixel contra a imagem original nítida e mede quão próximo você chegou.
**Quanto maior, mais fiel** sua reconstrução está do original.

A unidade é o **dB** (decibel), uma escala logarítmica - cada **+6 dB equivale aproximadamente a metade do erro médio** por pixel.
Pra dar uma ideia da escala neste desafio especificamente:

- **~21 dB**: a imagem borrada bruta, sem nenhum processamento, comparada com o original.
- **~26 dB**: o que a referência ingênua (Wiener sem adaptação ao frame) consegue na média.
- **~30 dB**: território de uma solução decente, que estima o σ do frame corretamente.
- **~33 dB ou mais**: solução muito boa, combinando boa estimativa de σ com refinamento iterativo ou rede neural.

Quem **maximiza o PSNR médio** sobre todos os casos (públicos + ocultos) ganha.
Abaixo dos caps de tempo e memória, tempo e memória extras não rendem nada - gaste os 200 ms inteiros se isso te der mais fidelidade.

Desempate (em ordem):
1. Mediana de PSNR (caso o médio empate, vence quem é mais consistente)
2. Tempo mediano por imagem (mais rápido vence)
3. Timestamp de submissão (mais cedo vence)

## Como o frame foi gerado

Cada frame que sua solução recebe foi produzido a partir de uma imagem nítida pelo modelo abaixo.
A **estrutura** do modelo é conhecida (e sua solução pode e deve explorá-la), mas os **parâmetros numéricos** - a largura do borrão, a intensidade do ruído, e como variam entre frames - **não são divulgados**.
Sua solução precisa ser robusta a essa variação, idealmente estimando os parâmetros a partir do próprio frame que recebe, como uma câmera real faria.

Componentes do modelo, na ordem em que se aplicam:

1. Parte de uma imagem nítida `nitida` (uint8, 512x512 grayscale).
2. **Borrão gaussiano periódico** aplicado via FFT: `borrada = IFFT( FFT(nitida) · FFT(kernel_σ) )`.
   A convolução é **circular** - a borda da imagem se enrola, o frame é tratado como um toro 512x512.
   A largura σ do kernel pode variar entre frames.
3. **Ruído aditivo do sensor** somado em cada pixel.
   A intensidade e o caráter do ruído podem variar entre frames.
4. Clipa em `[0, 255]` e quantiza para `uint8` -> arquivo BMP.

O kernel gaussiano usado no passo 2 é construído como abaixo (numpy de referência; em outras linguagens, reproduzir o mesmo layout sob pena de errar a fase da deconvolução):

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

Equivalente: kernel gaussiano centrado em `(0, 0)`, periodicidade implícita 512, normalizado pra somar 1 no domínio espacial.

## A referência

Em [`reference/wiener.py`](reference/wiener.py) mora um solver **intencionalmente burro**: aplica o filtro de Wiener com parâmetros pré-escolhidos pelo mantenedor, sem nenhuma adaptação ao frame que recebe.
É a forma mais ingênua de atacar o problema cego - quando os parâmetros reais do frame ficam perto dos chutes, o resultado sai razoável; quando se distanciam, sofre.

A referência **não estima** nada a partir do frame.
Sua solução deve fazer melhor.
Algumas direções:

- **Estimar σ a partir do espectro de potência** (técnica clássica: `log P(f) ≈ -2π²σ²f² - α log(f) + c`, ajusta linear)
- **Sweep paralelo** sobre alguns σ candidatos + escolha por métrica de foco (variância do laplaciano, total variation, gradient sparsity)
- **Métodos iterativos** (Richardson-Lucy, TV-regularizado)

## Dataset público

5 imagens de paisagem/aérea normalizadas para 512x512 grayscale.
Originais em `reference/originals/` (gerado on-demand pelo script de geração, não commitado).

| Slug | Imagem | Origem |
|---|---|---|
| `airplane` | F-16 Airplane (top-down) | USC-SIPI 4.2.05 |
| `lake` | Sailboat on Lake | USC-SIPI 4.2.06 |
| `boat` | Boat | USC-SIPI boat.512 |
| `house` | House | USC-SIPI 4.1.05 (upscaled) |
| `stream` | Stream and bridge | USC-SIPI 5.2.10 |

`inputs/<slug>.bmp` é o frame "saído do drone" (borrado + ruidoso).
`expected/<slug>.bmp` é o ground truth (a imagem nítida - você não tem isso na prática, é só pra validar localmente).

> **Stream** tende a ser o caso mais difícil: a textura fina da água e da folhagem gera alta frequência onde o defocus comeu o sinal mais útil.
> Se seu PSNR em `stream` for visivelmente pior que nos outros casos, é por aí que começa a debugar.

## Dataset oculto

Os casos do benchmark final são **outras imagens de paisagem aérea do mesmo gênero**, no mesmo formato 512x512 grayscale, processadas pelo mesmo modelo descrito acima (com parâmetros tirados da mesma fonte que o público).
Estatística similar ao público - o set oculto não é uma pegadinha, é só *mais do mesmo*.
Se sua solução vai bem nos 5 públicos, deve ir bem nos ocultos também.

## Como testar localmente

Pré-requisitos: `uv` (Python 3.11+), `docker`, `hyperfine`, `jq`.

```bash
# 0. Resolver as deps da referência (numpy só; +pillow/requests com --extra generate)
uv sync --project 2026-05-deblur/reference

# 1. Rodar a referência num caso e conferir o PSNR
uv run --project 2026-05-deblur/reference \
    python 2026-05-deblur/reference/wiener.py \
    < 2026-05-deblur/inputs/house.bmp \
    > /tmp/house_out.bmp

uv run --project 2026-05-deblur/reference \
    python 2026-05-deblur/reference/score.py \
    /tmp/house_out.bmp \
    2026-05-deblur/expected/house.bmp
# → algo tipo "26.2221"

# 2. (Opcional) Regenerar o dataset (precisa do extra generate)
uv sync --project 2026-05-deblur/reference --extra generate
uv run --project 2026-05-deblur/reference \
    python 2026-05-deblur/reference/generate.py
```

Pra rodar o bench harness contra a referência (precisa de `docker`):

```bash
docker build -t acelerado-ref:bench 2026-05-deblur/reference/
2026-05-deblur/bench/run.sh 2026-05-deblur/reference/
```

## Como submeter

Estrutura, `meta.json` e fluxo de PR ficam no [`../SUBMISSION.md`](../SUBMISSION.md) genérico.
Pra esse desafio especificamente:

1. `2026-05-deblur/solutions/<seu-usuario>/Dockerfile` constrói sua solução
2. Container lê BMP de stdin, escreve BMP em stdout (contrato acima)
3. PR contra a branch `submissions/<seu-usuario>` ou `main` (público)

Se quiser um ponto de partida que já compila e roda sem fazer nada útil, copie a subpasta da linguagem desejada de [`example/`](example/) e substitua o conteúdo pela sua lógica.

## Atribuição

Imagens do dataset público do **USC-SIPI** (University of Southern California, Signal and Image Processing Institute, "for research and educational use").
