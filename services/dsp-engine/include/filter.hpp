#pragma once

#include <complex>
#include <span>
#include <vector>

namespace sentinel {

using Spectrum = std::vector<std::complex<double>>;

Spectrum fft(std::span<const std::complex<double>> samples);
std::vector<float> butterworth_bandpass(std::span<const float> samples,
                                        double sample_rate_hz,
                                        double low_cut_hz,
                                        double high_cut_hz);
std::vector<float> remove_mean(std::span<const float> samples);

}  // namespace sentinel
