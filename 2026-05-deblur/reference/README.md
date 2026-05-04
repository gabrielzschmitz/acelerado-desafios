# Ferramentas de referência

Implementação de referência + utilitários para gerar o dataset e rodar o
benchmark. **Não é uma submissão** - só serve como baseline e tooling
auxiliar.

## Conteúdo

- `bmp_io.py` - leitor/escritor estrito de BMP 24-bit grayscale (R=G=B)
- `wiener.py` - solver Wiener com **parâmetros fixos** (não adapta ao
  frame), lê stdin, escreve stdout. Baseline
  intencionalmente burro: não estima nada a partir do frame.
- `score.py` - calcula PSNR entre dois BMPs (usado pelo bench harness)
- `generate.py` - baixa as imagens originais, normaliza pra 512x512 cinza,
  borra com PSF gaussiana de largura `σ ~ U(0, 3.5)` sorteada por frame +
  ruído aditivo gaussiano de desvio padrão `σ_n ~ U(5, 15)` também sorteado
  por frame, grava em `inputs/` e `expected/`. Os σ sorteados são impressos
  em stderr ao gerar (útil pra debug/verificação) mas **não são shippados**
  com o dataset.
- `Dockerfile` - empacota `wiener.py` como container, mesmo contrato das
  submissões (stdin -> stdout, **sem disco gravável**). Útil pra testar o
  `bench/run.sh` end-to-end antes de qualquer submissão real existir.

## Rodar

As dependências ficam isoladas neste diretório (`pyproject.toml` próprio).
O default é só `numpy`; `pillow` + `requests` ficam no extra `[generate]`,
necessário só pra `generate.py` (download + render do dataset, one-shot).

A partir da raiz do repo:

```bash
# 0. Resolver as deps mínimas (só numpy)
uv sync --project 2026-05-deblur/reference

# 1. Rodar o solver de referência num caso
uv run --project 2026-05-deblur/reference \
    python 2026-05-deblur/reference/wiener.py \
    < 2026-05-deblur/inputs/house.bmp \
    > /tmp/house_out.bmp

# 2. Conferir o PSNR
uv run --project 2026-05-deblur/reference \
    python 2026-05-deblur/reference/score.py \
    /tmp/house_out.bmp \
    2026-05-deblur/expected/house.bmp

# 3. (Opcional) Regenerar o dataset
uv sync --project 2026-05-deblur/reference --extra generate
uv run --project 2026-05-deblur/reference \
    python 2026-05-deblur/reference/generate.py
```

## Modelo direto vs inverso

O gerador aplica convolução **circular** (FFT-based) com PSF gaussiana de
largura σ sorteada por frame, depois soma ruído aditivo de intensidade σ_n
também sorteada por frame:

```
blurred = IFFT( FFT(sharp) * FFT(gaussian_psf(sigma_i)) ) + N(0, sigma_n_i^2)
```

O solver de referência aplica Wiener com um σ_chute e um λ fixos
(sem adaptação ao frame):

```
F_hat = G * conj(H(σ_chute)) / (|H(σ_chute)|^2 + λ)
sharp_hat = IFFT(F_hat)
```

Implementações de submissão **devem assumir o mesmo modelo direto** -
convolução periódica (não zero-padded), ruído aditivo per-frame. As faixas
dos parâmetros (`σ ~ U(0, 3.5)`, `σ_n ~ U(5, 15)`) estão declaradas em
`../README.md` - sua estratégia de inversão precisa estimar o valor de
cada frame ou ser robusta sobre toda a faixa. A escolha da estratégia
(Wiener com σ estimado, Richardson-Lucy, TV, rede neural leve, etc.) é
com você.
