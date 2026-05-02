# Ferramentas de referência

Implementação de referência + utilitários para gerar o dataset e rodar o
benchmark. **Não é uma submissão** — só serve como baseline e ferramenta
do mantenedor.

## Conteúdo

- `bmp_io.py` — leitor/escritor estrito de BMP 24-bit grayscale (R=G=B)
- `wiener.py` — solver Wiener "lerdo" em Python+numpy.fft (lê stdin, escreve stdout)
- `score.py` — calcula PSNR entre dois BMPs (usado pelo bench harness)
- `generate.py` — baixa as imagens originais, normaliza pra 512×512 cinza,
  borra com PSF gaussiana σ=2.0 + ruído σ=1.0, grava em `inputs/` e `expected/`
- `Dockerfile` — empacota `wiener.py` como container, mesmo contrato das
  submissões (stdin → stdout). Útil pra testar o `bench/run.sh` end-to-end
  antes de qualquer submissão real existir.

## Rodar

A partir da raiz do repo:

```bash
# 1. Gerar o dataset (um shot, fica em cache em reference/originals/)
uv run python 2026-05-deblur/reference/generate.py

# 2. Rodar o solver de referência num caso
uv run python 2026-05-deblur/reference/wiener.py \
    < 2026-05-deblur/inputs/cameraman.bmp \
    > /tmp/cameraman_out.bmp

# 3. Conferir o PSNR
uv run python 2026-05-deblur/reference/score.py \
    /tmp/cameraman_out.bmp \
    2026-05-deblur/expected/cameraman.bmp
```

## Modelo direto vs inverso

O gerador aplica convolução **circular** (FFT-based) com PSF gaussiana,
depois soma ruído gaussiano:

```
blurred = IFFT( FFT(sharp) * FFT(gaussian_psf) ) + noise
```

O solver inverte exatamente esse modelo via filtro de Wiener:

```
F_hat = G * conj(H) / (|H|^2 + λ)
sharp_hat = IFFT(F_hat)
```

Implementações de submissão **devem assumir o mesmo modelo direto** —
convolução periódica, não zero-padded. Isso é parte do contrato do
problema (ver `../README.md`).
