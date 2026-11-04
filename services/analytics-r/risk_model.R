estimate_exceedance <- function(threshold, shape, scale) {
  if (length(threshold) != 1L || !is.finite(threshold) || threshold < 0) {
    stop("threshold must be one finite, non-negative value")
  }
  if (length(shape) != 1L || !is.finite(shape) ||
      length(scale) != 1L || !is.finite(scale) || scale <= 0) {
    stop("shape must be finite and scale must be finite and positive")
  }

  support <- 1 + shape * threshold / scale
  if (support <= 0) {
    return(0)
  }
  if (abs(shape) < .Machine$double.eps^0.5) {
    return(exp(-threshold / scale))
  }
  support^(-1 / shape)
}
