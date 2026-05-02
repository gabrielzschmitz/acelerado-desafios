#!/usr/bin/env python3
"""Exemplo mínimo: lê o BMP de stdin e devolve sem alterar nada.

Não passa do threshold de PSNR — serve só pra mostrar o contrato de I/O
e como empacotar uma submissão. Copie este diretório, troque a lógica de
`solution.py` pela sua, e mantenha o Dockerfile (ou substitua pela
linguagem/runtime que preferir)."""
import sys

sys.stdout.buffer.write(sys.stdin.buffer.read())
