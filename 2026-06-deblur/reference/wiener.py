#!/usr/bin/env python3
"""
Reference Wiener-deconvolution solver.

Reads a 24-bit grayscale BMP from stdin (image blurred with a Gaussian PSF of
sigma = 3.0), writes the deblurred BMP to stdout.

Educational baseline: a single-threaded numpy.fft + scalar Wiener filter.
Slow on purpose — the whole point of the challenge is to do better.
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
import bmp_io  # noqa: E402

SIGMA = 2.0
LAMBDA = 0.001  # Wiener regularization (NSR proxy)


def gaussian_psf_freq(shape: tuple[int, int], sigma: float) -> np.ndarray:
    """Build the FFT of a centered, periodic Gaussian PSF normalized to sum=1."""
    h, w = shape
    yy = np.fft.fftfreq(h) * h
    xx = np.fft.fftfreq(w) * w
    yy, xx = np.meshgrid(yy, xx, indexing="ij")
    psf = np.exp(-(xx ** 2 + yy ** 2) / (2.0 * sigma ** 2))
    psf /= psf.sum()
    return np.fft.fft2(psf)


def wiener_deconvolve(blurred: np.ndarray, sigma: float, lam: float) -> np.ndarray:
    H = gaussian_psf_freq(blurred.shape, sigma)
    G = np.fft.fft2(blurred.astype(np.float64))
    F = G * np.conj(H) / (np.abs(H) ** 2 + lam)
    return np.real(np.fft.ifft2(F))


def main() -> None:
    blurred = bmp_io.read(sys.stdin.buffer)
    sharp = wiener_deconvolve(blurred, SIGMA, LAMBDA)
    sharp = np.clip(sharp, 0, 255).astype(np.uint8)
    bmp_io.write(sys.stdout.buffer, sharp)


if __name__ == "__main__":
    main()
