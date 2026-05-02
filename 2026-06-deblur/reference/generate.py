#!/usr/bin/env python3
"""
Generate the deblur dataset: download originals, normalize to 512x512 grayscale,
apply a periodic Gaussian PSF (sigma=3.0) + additive Gaussian noise, and write
``inputs/<name>.bmp`` (blurred + noisy) and ``expected/<name>.bmp`` (ground truth).

The forward model matches what the reference Wiener solver inverts:

    blurred = IFFT( FFT(sharp) * FFT(gaussian_psf) ) + noise

This is FFT-based *circular* convolution (periodic boundary). It's important
that participants assume the same forward model in their solvers — the README
spells this out.

Sources cached locally in ``reference/originals/``. Re-running the script with
the cache populated skips the network entirely.
"""
from __future__ import annotations

import io
import sys
from pathlib import Path

import numpy as np
import requests
from PIL import Image
from skimage import data as sk_data

sys.path.insert(0, str(Path(__file__).parent))
import bmp_io  # noqa: E402

SIGMA = 2.0
NOISE_SIGMA = 1.0
TARGET_SIZE = 512
RNG_SEED = 42

ROOT = Path(__file__).resolve().parents[1]  # 2026-06-deblur/
ORIGINALS_DIR = Path(__file__).parent / "originals"
EXPECTED_DIR = ROOT / "expected"
INPUTS_DIR = ROOT / "inputs"

# (slug, source descriptor)
# Source descriptor:
#   ("skimage", "<attr>")        -> skimage.data.<attr>()
#   ("url", "<URL>")             -> HTTP GET; fallback URLs supported as a list
SOURCES: list[tuple[str, tuple[str, object]]] = [
    ("cameraman", ("skimage", "camera")),
    ("mandrill",  ("url", "https://sipi.usc.edu/database/misc/4.2.03.tiff")),
    ("peppers",   ("url", "https://sipi.usc.edu/database/misc/4.2.07.tiff")),
    ("airplane",  ("url", "https://sipi.usc.edu/database/misc/4.2.05.tiff")),
    ("lake",      ("url", "https://sipi.usc.edu/database/misc/4.2.06.tiff")),
    ("boat",      ("url", "https://sipi.usc.edu/database/misc/boat.512.tiff")),
    ("house",     ("url", "https://sipi.usc.edu/database/misc/4.1.05.tiff")),
    ("couple",    ("url", "https://sipi.usc.edu/database/misc/5.2.08.tiff")),
    ("stream",    ("url", "https://sipi.usc.edu/database/misc/5.2.10.tiff")),
]


def fetch_skimage(attr: str) -> np.ndarray:
    fn = getattr(sk_data, attr)
    return np.asarray(fn())


def fetch_url(url_or_list, slug: str) -> np.ndarray:
    urls = url_or_list if isinstance(url_or_list, list) else [url_or_list]
    last_err = None
    for url in urls:
        try:
            r = requests.get(url, timeout=30)
            r.raise_for_status()
            return np.asarray(Image.open(io.BytesIO(r.content)))
        except Exception as e:
            last_err = e
            print(f"  ! {slug}: {url} failed ({e.__class__.__name__})", file=sys.stderr)
    raise RuntimeError(f"all sources failed for {slug}: {last_err}")


def fetch(slug: str, src: tuple[str, object]) -> np.ndarray:
    """Return the original image as a numpy array (any dtype, any channel count)."""
    cache = ORIGINALS_DIR / f"{slug}.npy"
    if cache.exists():
        return np.load(cache)

    kind, val = src
    if kind == "skimage":
        arr = fetch_skimage(val)  # type: ignore[arg-type]
    elif kind == "url":
        arr = fetch_url(val, slug)
    else:
        raise ValueError(f"unknown source kind: {kind}")

    ORIGINALS_DIR.mkdir(parents=True, exist_ok=True)
    np.save(cache, arr)
    return arr


def normalize(arr: np.ndarray) -> np.ndarray:
    """Convert to 512x512 grayscale uint8."""
    img = Image.fromarray(arr)
    if img.mode != "L":
        img = img.convert("L")
    if img.size != (TARGET_SIZE, TARGET_SIZE):
        img = img.resize((TARGET_SIZE, TARGET_SIZE), Image.LANCZOS)
    return np.asarray(img, dtype=np.uint8)


def gaussian_psf_freq(shape: tuple[int, int], sigma: float) -> np.ndarray:
    h, w = shape
    yy = np.fft.fftfreq(h) * h
    xx = np.fft.fftfreq(w) * w
    yy, xx = np.meshgrid(yy, xx, indexing="ij")
    psf = np.exp(-(xx ** 2 + yy ** 2) / (2.0 * sigma ** 2))
    psf /= psf.sum()
    return np.fft.fft2(psf)


def blur_and_noise(sharp: np.ndarray, sigma: float, noise_sigma: float,
                   seed: int) -> np.ndarray:
    H = gaussian_psf_freq(sharp.shape, sigma)
    F = np.fft.fft2(sharp.astype(np.float64))
    blurred = np.real(np.fft.ifft2(F * H))
    rng = np.random.default_rng(seed)
    blurred = blurred + rng.normal(0.0, noise_sigma, blurred.shape)
    return np.clip(blurred, 0, 255).astype(np.uint8)


def main() -> int:
    EXPECTED_DIR.mkdir(parents=True, exist_ok=True)
    INPUTS_DIR.mkdir(parents=True, exist_ok=True)

    written = []
    failed = []
    for i, (slug, src) in enumerate(SOURCES):
        try:
            print(f"[{i+1}/{len(SOURCES)}] {slug} ...", flush=True)
            raw = fetch(slug, src)
            sharp = normalize(raw)
            blurred = blur_and_noise(sharp, SIGMA, NOISE_SIGMA, RNG_SEED + i)
            bmp_io.write_path(EXPECTED_DIR / f"{slug}.bmp", sharp)
            bmp_io.write_path(INPUTS_DIR / f"{slug}.bmp", blurred)
            written.append(slug)
        except Exception as e:
            print(f"  ! {slug}: skipped ({e})", file=sys.stderr)
            failed.append((slug, str(e)))

    print()
    print(f"wrote {len(written)} cases: {', '.join(written)}")
    if failed:
        print(f"failed {len(failed)}:")
        for slug, msg in failed:
            print(f"  - {slug}: {msg}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
