#!/usr/bin/env python3
import sys
import numpy as np


# =========================================================
# I/O: read BMP-like raw input (54-byte header + RGB data)
# =========================================================
raw_data = sys.stdin.buffer.read()

bmp_header = raw_data[:54]
pixel_bytes = np.frombuffer(raw_data[54:], dtype=np.uint8)

# Convert to grayscale (use only R channel)
image = pixel_bytes.reshape((512, 512, 3))[:, :, 0].astype(np.float64)


# =========================================================
# Frequency-domain Gaussian PSF
# =========================================================
def gaussian_psf_frequency(shape, sigma):
    """
    Builds a Gaussian point spread function in the frequency domain.

    Args:
        shape (tuple): (height, width) of the image
        sigma (float): blur standard deviation in spatial domain

    Returns:
        np.ndarray: FFT of normalized Gaussian PSF
    """
    height, width = shape

    freq_y = np.fft.fftfreq(height) * height
    freq_x = np.fft.fftfreq(width) * width

    fy, fx = np.meshgrid(freq_y, freq_x, indexing="ij")

    psf = np.exp(-(fx**2 + fy**2) / (2.0 * sigma**2))
    psf /= np.sum(psf)

    return np.fft.fft2(psf)


# =========================================================
# Blur estimation (frequency decay fitting)
# =========================================================
def estimate_blur_sigma(image):
    """
    Estimates Gaussian blur sigma from frequency spectrum decay.

    Uses log-magnitude linear fit over mid-frequency band.
    """
    spectrum = np.fft.fft2(image)
    magnitude = np.abs(spectrum) + 1e-8

    height, width = image.shape

    freq_y = np.fft.fftfreq(height)[:, None]
    freq_x = np.fft.fftfreq(width)[None, :]
    freq_sq = freq_x**2 + freq_y**2

    valid_band = (freq_sq > 0.001) & (freq_sq < 0.05)

    x = freq_sq[valid_band].ravel()
    y = np.log(magnitude[valid_band].ravel())

    design_matrix = np.vstack([x, np.ones_like(x)]).T
    slope, _ = np.linalg.lstsq(design_matrix, y, rcond=None)[0]

    sigma = np.sqrt(max(0.0, -2.0 * slope))
    return float(np.clip(sigma, 0.6, 3.2))


# =========================================================
# FFT of input image
# =========================================================
image_fft = np.fft.fft2(image)

height, width = image.shape

freq_y = np.fft.fftfreq(height)[:, None]
freq_x = np.fft.fftfreq(width)[None, :]
freq_sq = freq_x**2 + freq_y**2


# =========================================================
# Blur model
# =========================================================
estimated_sigma = estimate_blur_sigma(image)
psf_fft = gaussian_psf_frequency(image.shape, estimated_sigma)
psf_power = np.abs(psf_fft) ** 2


# =========================================================
# Noise estimation (high-pass residual variance)
# =========================================================
laplacian_residual = image - (
    np.roll(image, 1, axis=0) +
    np.roll(image, -1, axis=0) +
    np.roll(image, 1, axis=1) +
    np.roll(image, -1, axis=1)
) / 4.0

noise_std = np.std(laplacian_residual)
signal_variance = np.var(image)

regularization_strength = noise_std**2 / (signal_variance + 1e-6)
regularization_strength = float(np.clip(regularization_strength, 1e-4, 0.01))


# =========================================================
# Frequency-weighted Wiener-like deconvolution
# =========================================================
epsilon = 1e-6
frequency_penalty = freq_sq / (psf_power + epsilon)

alpha = 6.0  # controls high-frequency suppression

denominator = psf_power + regularization_strength * (1.0 + alpha * frequency_penalty)

restored_fft = image_fft * np.conj(psf_fft) / denominator
restored_image = np.real(np.fft.ifft2(restored_fft))


# Small stabilization toward input image
restored_image = 0.998 * restored_image + 0.002 * image


# =========================================================
# Output reconstruction (grayscale -> RGB)
# =========================================================
output_image = np.clip(restored_image, 0, 255).astype(np.uint8)
output_rgb = np.stack([output_image] * 3, axis=-1).reshape(-1)

sys.stdout.buffer.write(bmp_header + output_rgb.tobytes())
