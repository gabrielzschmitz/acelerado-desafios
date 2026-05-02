# Exemplos passthrough

Cada subdiretório contém um Dockerfile + um `solution.<ext>` mínimo que **só
copia stdin pra stdout** — não desfoca nada, não passa do threshold de PSNR.
Existem pra mostrar o esqueleto de uma submissão funcional em várias
linguagens.

| Linguagem | Pasta | Imagem base | Compilação |
|---|---|---|---|
| Python  | [`python/`](python/) | `python:3.11-slim` | — (interpretado) |
| Node.js | [`js/`](js/)         | `node:20-slim`     | — (interpretado) |
| C       | [`c/`](c/)           | `gcc:13-slim` → `debian:bookworm-slim` | `gcc -O2` |
| C++     | [`cpp/`](cpp/)       | `gcc:13-slim` → `debian:bookworm-slim` | `g++ -O2` |
| Rust    | [`rust/`](rust/)     | `rust:1.83-slim` → `debian:bookworm-slim` | `rustc -O` |
| Go      | [`go/`](go/)         | `golang:1.23-bookworm` → `scratch` | `go build` (CGO=0) |
| Zig     | [`zig/`](zig/)       | `debian:bookworm-slim` (+ Zig 0.15.1) | `zig build -Doptimize=ReleaseSafe` (via `build.zig`) |

## Rodar qualquer um

```bash
docker build -t deblur-example example/python/
docker run --rm --read-only --network=none -i deblur-example \
    < inputs/house.bmp > /tmp/out.bmp

# checa que entrada e saída são iguais
cmp inputs/house.bmp /tmp/out.bmp && echo OK
```

Troque `python/` pela pasta da linguagem que você quiser usar.

## Usar como template

Copie a subpasta da linguagem desejada pra `solutions/<seu-usuario>/` e
substitua a lógica do `solution.<ext>` pela sua. O `Dockerfile` e o
contrato de stdin/stdout permanecem.
