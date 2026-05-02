#!/usr/bin/env python3
"""
Compute PSNR (dB) between a candidate output and the ground truth.

Usage:
    python score.py <candidate.bmp> <expected.bmp>

Prints a single float (PSNR in dB) on stdout. Exits non-zero on shape
mismatch or invalid BMPs.
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
import bmp_io  # noqa: E402


def psnr(a: np.ndarray, b: np.ndarray, peak: float = 255.0) -> float:
    if a.shape != b.shape:
        raise ValueError(f"shape mismatch: {a.shape} vs {b.shape}")
    mse = np.mean((a.astype(np.float64) - b.astype(np.float64)) ** 2)
    if mse == 0:
        return float("inf")
    return float(10.0 * np.log10(peak ** 2 / mse))


def main(argv: list[str]) -> int:
    if len(argv) != 3:
        print(f"usage: {argv[0]} <candidate.bmp> <expected.bmp>", file=sys.stderr)
        return 2
    cand = bmp_io.read_path(argv[1])
    exp = bmp_io.read_path(argv[2])
    print(f"{psnr(cand, exp):.4f}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
