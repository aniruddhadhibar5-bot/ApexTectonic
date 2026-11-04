#include "filter.hpp"

#include <algorithm>
#include <cmath>
#include <numeric>
#include <stdexcept>

namespace sentinel {
namespace {

bool is_power_of_two(std::size_t value) {
  return value != 0 && (value & (value - 1)) == 0;
}

struct Biquad {
  double b0;
  double b1;
  double b2;
  double a1;
  double a2;
};

Biquad butterworth_section(double sample_rate_hz, double cutoff_hz,
                           bool highpass) {
  constexpr double q = 0.7071067811865475244;
  const double omega = 2.0 * std::acos(-1.0) * cutoff_hz / sample_rate_hz;
  const double cosine = std::cos(omega);
  const double alpha = std::sin(omega) / (2.0 * q);
  const double a0 = 1.0 + alpha;
  const double sign = highpass ? -1.0 : 1.0;
  return {
      (1.0 + sign * cosine) / (2.0 * a0),
      -(1.0 + sign * cosine) / a0,
      (1.0 + sign * cosine) / (2.0 * a0),
      -2.0 * cosine / a0,
      (1.0 - alpha) / a0,
  };
}

void apply_section(std::span<float> samples, const Biquad& filter) {
  double state_1 = 0.0;
  double state_2 = 0.0;
  for (float& sample : samples) {
    const double input = sample;
    const double output = filter.b0 * input + state_1;
    state_1 = filter.b1 * input - filter.a1 * output + state_2;
    state_2 = filter.b2 * input - filter.a2 * output;
    sample = static_cast<float>(output);
  }
}

}  // namespace

Spectrum fft(std::span<const std::complex<double>> samples) {
  if (!is_power_of_two(samples.size())) {
    throw std::invalid_argument("FFT size must be a non-zero power of two");
  }
  Spectrum result(samples.begin(), samples.end());
  for (const auto& value : result) {
    if (!std::isfinite(value.real()) || !std::isfinite(value.imag())) {
      throw std::invalid_argument("FFT input contains non-finite values");
    }
  }

  for (std::size_t i = 1, j = 0; i < result.size(); ++i) {
    std::size_t bit = result.size() >> 1;
    for (; j & bit; bit >>= 1) {
      j ^= bit;
    }
    j ^= bit;
    if (i < j) {
      std::swap(result[i], result[j]);
    }
  }

  const double tau = 2.0 * std::acos(-1.0);
  for (std::size_t length = 2; length <= result.size(); length <<= 1) {
    const auto angle = -tau / static_cast<double>(length);
    const std::complex<double> step(std::cos(angle), std::sin(angle));
    for (std::size_t base = 0; base < result.size(); base += length) {
      std::complex<double> phase(1.0, 0.0);
      for (std::size_t offset = 0; offset < length / 2; ++offset) {
        const auto even = result[base + offset];
        const auto odd = result[base + offset + length / 2] * phase;
        result[base + offset] = even + odd;
        result[base + offset + length / 2] = even - odd;
        phase *= step;
      }
    }
  }
  return result;
}

std::vector<float> butterworth_bandpass(std::span<const float> samples,
                                        double sample_rate_hz,
                                        double low_cut_hz,
                                        double high_cut_hz) {
  if (samples.empty() || !std::isfinite(sample_rate_hz) ||
      !std::isfinite(low_cut_hz) || !std::isfinite(high_cut_hz) ||
      sample_rate_hz <= 0.0 || low_cut_hz <= 0.0 ||
      high_cut_hz <= low_cut_hz || high_cut_hz >= sample_rate_hz / 2.0) {
    throw std::invalid_argument("invalid bandpass parameters or empty window");
  }
  if (!std::all_of(samples.begin(), samples.end(),
                   [](float value) { return std::isfinite(value); })) {
    throw std::invalid_argument("sample window contains non-finite values");
  }

  std::vector<float> filtered(samples.begin(), samples.end());
  apply_section(filtered, butterworth_section(sample_rate_hz, low_cut_hz, true));
  apply_section(filtered, butterworth_section(sample_rate_hz, high_cut_hz, false));
  return filtered;
}

std::vector<float> remove_mean(std::span<const float> samples) {
  if (samples.empty()) {
    throw std::invalid_argument("sample window must not be empty");
  }
  if (!std::all_of(samples.begin(), samples.end(),
                   [](float value) { return std::isfinite(value); })) {
    throw std::invalid_argument("sample window contains non-finite values");
  }

  const float mean =
      std::accumulate(samples.begin(), samples.end(), 0.0f) / samples.size();
  std::vector<float> centered;
  centered.reserve(samples.size());
  for (const float sample : samples) {
    centered.push_back(sample - mean);
  }
  return centered;
}

}  // namespace sentinel
