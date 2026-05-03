# Ferramentas de referência

Implementação de referência + utilitários para gerar o dataset e rodar o
benchmark. **Não é uma submissão** - só serve como baseline e ferramenta
do mantenedor.

## Conteúdo

- `bmp_io.py` - leitor/escritor estrito de BMP 24-bit grayscale (R=G=B)
- `wiener.py` - solver Wiener com **σ fixo = 2.5** (midpoint do range), lê
  stdin, escreve stdout. Baseline intencionalmente burro: não estima σ.
- `score.py` - calcula PSNR entre dois BMPs (usado pelo bench harness)
- `generate.py` - baixa as imagens originais, normaliza pra 512x512 cinza,
  borra com PSF gaussiana σ ~ U(1.5, 3.5) sorteado por imagem + ruído branco
  σ_n = 2.0, grava em `inputs/` e `expected/`. Os σ sorteados são impressos
  em stderr pra o mantenedor verificar performance da referência - **não são
  shippados** com o dataset (participantes recebem o problema cego).
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

# 3. (Opcional, só mantenedor) Regenerar o dataset
uv sync --project 2026-05-deblur/reference --extra generate
uv run --project 2026-05-deblur/reference \
    python 2026-05-deblur/reference/generate.py
```

## Modelo direto vs inverso

O gerador aplica convolução **circular** (FFT-based) com PSF gaussiana
de σ sorteado por imagem em [1.5, 3.5], depois soma ruído branco gaussiano
com σ_n = 2.0:

```
blurred = IFFT( FFT(sharp) * FFT(gaussian_psf(sigma_i)) ) + N(0, 2.0²)
```

O solver de referência aplica Wiener com σ_test = 2.5 (midpoint), λ = 0.005:

```
F_hat = G * conj(H(2.5)) / (|H(2.5)|² + λ)
sharp_hat = IFFT(F_hat)
```

Implementações de submissão **devem assumir o mesmo modelo direto** -
convolução periódica (não zero-padded), ruído branco aditivo σ_n = 2.0.
A escolha da estratégia de inversão (Wiener com σ estimado, Richardson-Lucy,
TV, etc.) é com você. Isso é parte do contrato do problema (ver `../README.md`).
