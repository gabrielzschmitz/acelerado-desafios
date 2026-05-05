#include <fftw3.h>

#include <algorithm>
#include <cmath>
#include <complex>
#include <cstdint>
#include <cstring>
#include <iostream>
#include <numeric>
#include <vector>

const int HEIGHT = 512;
const int WIDTH = 512;
const int CHANNELS = 3;
const int HEADER_SIZE = 54;
const int PIXELS_COUNT = HEIGHT * WIDTH;
const int FFT_WIDTH = WIDTH / 2 + 1;

int main() {
  std::ios_base::sync_with_stdio(false);
  std::cin.tie(NULL);

  std::vector<char> bmp_header(HEADER_SIZE);
  if (!std::cin.read(bmp_header.data(), HEADER_SIZE)) return 0;

  std::vector<uint8_t> pixel_bytes(PIXELS_COUNT * CHANNELS);
  if (!std::cin.read(reinterpret_cast<char*>(pixel_bytes.data()),
                     pixel_bytes.size()))
    return 0;

  // Use fftwf_ para precisão simples
  float* image = (float*)fftwf_malloc(sizeof(float) * PIXELS_COUNT);
  float sum_img = 0.0f;
  for (int i = 0; i < PIXELS_COUNT; ++i) {
    image[i] = static_cast<float>(pixel_bytes[i * CHANNELS]);
    sum_img += image[i];
  }
  float mean_img = sum_img / PIXELS_COUNT;

  fftwf_complex* image_fft =
    (fftwf_complex*)fftwf_malloc(sizeof(fftwf_complex) * HEIGHT * FFT_WIDTH);
  fftwf_plan plan_forward =
    fftwf_plan_dft_r2c_2d(HEIGHT, WIDTH, image, image_fft, FFTW_ESTIMATE);
  fftwf_execute(plan_forward);

  // =========================================================
  // 4. Frequências e Blur (CORRIGIDO: Escala Normalizada)
  // =========================================================
  float sum_x = 0.0f, sum_y = 0.0f, sum_x2 = 0.0f, sum_xy = 0.0f;
  int n_valid = 0;

  std::vector<float> freq_sq(HEIGHT * FFT_WIDTH);
  std::vector<float> magnitude(HEIGHT * FFT_WIDTH);

  for (int y = 0; y < HEIGHT; ++y) {
    // Exatamente como np.fft.fftfreq: [0, 1/N, ..., 0.5, -0.5, ..., -1/N]
    float fy =
      (y <= HEIGHT / 2) ? (float)y / HEIGHT : (float)(y - HEIGHT) / HEIGHT;
    float fy2 = fy * fy;

    for (int x = 0; x < FFT_WIDTH; ++x) {
      // Exatamente como np.fft.rfftfreq: [0, 1/N, ..., 0.5]
      float fx = (float)x / WIDTH;

      int idx = y * FFT_WIDTH + x;
      float f_sq = (fx * fx) + fy2;
      freq_sq[idx] = f_sq;

      float real = image_fft[idx][0];
      float imag = image_fft[idx][1];
      float mag = std::sqrt(real * real + imag * imag) + 1e-8f;
      magnitude[idx] = mag;

      if (f_sq > 0.001f && f_sq < 0.05f) {
        float log_mag = std::log(mag);
        sum_x += f_sq;
        sum_y += log_mag;
        sum_x2 += f_sq * f_sq;
        sum_xy += f_sq * log_mag;
        n_valid++;
      }
    }
  }

  float slope = 0.0f;
  if (n_valid > 0) {
    float denom = n_valid * sum_x2 - sum_x * sum_x;
    if (std::abs(denom) > 1e-8f)
      slope = (n_valid * sum_xy - sum_x * sum_y) / denom;
  }
  float sigma = std::sqrt(std::max(0.0f, -2.0f * slope));
  sigma = std::clamp(sigma, 0.6f, 3.2f);

  // 5. Ruído (Laplaciano)
  float sum_lap = 0.0f;
  int count_lap = (HEIGHT - 2) * (WIDTH - 2);
  std::vector<float> laplacian(count_lap);
  int l_idx = 0;
  for (int y = 1; y < HEIGHT - 1; ++y) {
    for (int x = 1; x < WIDTH - 1; ++x) {
      float res =
        image[y * WIDTH + x] -
        0.25f * (image[(y - 1) * WIDTH + x] + image[(y + 1) * WIDTH + x] +
                 image[y * WIDTH + (x - 1)] + image[y * WIDTH + (x + 1)]);
      laplacian[l_idx++] = res;
      sum_lap += res;
    }
  }
  float mean_lap = sum_lap / count_lap;
  float sq_sum_lap = 0.0f;
  for (float v : laplacian) sq_sum_lap += (v - mean_lap) * (v - mean_lap);
  float noise_var = sq_sum_lap / count_lap;

  float sq_sum_img = 0.0f;
  for (int i = 0; i < PIXELS_COUNT; ++i)
    sq_sum_img += (image[i] - mean_img) * (image[i] - mean_img);
  float sig_var = sq_sum_img / PIXELS_COUNT;

  float reg_strength = std::clamp(noise_var / (sig_var + 1e-6f), 1e-4f, 0.01f);

  // 6. Wiener
  const float alpha = 6.0f;
  const float pi2_sigma2 = 2.0f * M_PI * M_PI * sigma * sigma;

  for (int i = 0; i < HEIGHT * FFT_WIDTH; ++i) {
    float f_sq = freq_sq[i];
    float psf_f = std::exp(-pi2_sigma2 * f_sq);
    float psf_power = psf_f * psf_f;
    float denominator =
      psf_power + reg_strength * (1.0f + alpha * (f_sq / (psf_power + 1e-6f)));

    image_fft[i][0] = (image_fft[i][0] * psf_f) / denominator;
    image_fft[i][1] = (image_fft[i][1] * psf_f) / denominator;
  }

  // 7. IFFT
  float* restored_raw = (float*)fftwf_malloc(sizeof(float) * PIXELS_COUNT);
  fftwf_plan plan_backward = fftwf_plan_dft_c2r_2d(HEIGHT, WIDTH, image_fft,
                                                   restored_raw, FFTW_ESTIMATE);
  fftwf_execute(plan_backward);

  // 8. Output
  std::vector<uint8_t> output_rgb(PIXELS_COUNT * CHANNELS);
  float scale = 1.0f / (PIXELS_COUNT);

  for (int i = 0; i < PIXELS_COUNT; ++i) {
    float res = (restored_raw[i] * scale) * 0.998f + image[i] * 0.002f;
    uint8_t val = static_cast<uint8_t>(std::clamp(res, 0.0f, 255.0f));
    output_rgb[i * 3] = output_rgb[i * 3 + 1] = output_rgb[i * 3 + 2] = val;
  }

  std::cout.write(bmp_header.data(), HEADER_SIZE);
  std::cout.write(reinterpret_cast<char*>(output_rgb.data()),
                  output_rgb.size());

  fftwf_destroy_plan(plan_forward);
  fftwf_destroy_plan(plan_backward);
  fftwf_free(image);
  fftwf_free(image_fft);
  fftwf_free(restored_raw);
  return 0;
}
