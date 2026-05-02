# Exemplo: submissão passthrough

Solução mínima que **só copia stdin pra stdout** — não desfoca nada, não
passa do threshold de PSNR. Existe pra mostrar o esqueleto de uma
submissão funcional.

## Rodar

```bash
docker build -t deblur-example example/
docker run --rm --read-only --network=none -i deblur-example \
    < inputs/cameraman.bmp > /tmp/out.bmp

# checa que entrada e saída são iguais
cmp inputs/cameraman.bmp /tmp/out.bmp && echo OK
```

## Usar como template

Copie pra `solutions/<seu-usuario>/` e substitua a lógica de `solution.py`
pela sua. Se for trocar de linguagem (C, Rust, Go, ...), troque também o
`FROM` e o `CMD` do `Dockerfile` — o contrato de stdin/stdout permanece.
