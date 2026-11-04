#include "filter.hpp"

#include <cassert>
#include <cmath>
#include <complex>
#include <stdexcept>
#include <vector>

int main() {
  const std::vector<std::complex<double>> impulse{
      {1.0, 0.0}, {0.0, 0.0}, {0.0, 0.0}, {0.0, 0.0}};
  const auto spectrum = sentinel::fft(impulse);
  for (const auto& value : spectrum) {
    assert(std::abs(value - std::complex<double>(1.0, 0.0)) < 1e-10);
  }

  const std::vector<float> wave{1.0f, 0.0f, -1.0f, 0.0f};
  const auto filtered = sentinel::butterworth_bandpass(wave, 100.0, 2.0, 20.0);
  assert(filtered.size() == wave.size());
  for (float value : filtered) {
    assert(std::isfinite(value));
  }

  bool rejected = false;
  try {
    sentinel::fft(std::span<const std::complex<double>>(impulse.data(), 3));
  } catch (const std::invalid_argument&) {
    rejected = true;
  }
  assert(rejected);
}
