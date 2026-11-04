module StressModel

export diffuse_stress_step, energy_proxy

"""
Advance a dimensionless 2-D diffusion proxy by one explicit Euler step.
This is a numerical example, not a calibrated lithosphere or hazard model.
"""
function diffuse_stress_step(
    stress::AbstractMatrix{<:Real},
    diffusivity::Real,
    dt::Real;
    forcing::AbstractMatrix{<:Real}=zeros(size(stress)),
)
    rows, cols = size(stress)
    rows >= 3 && cols >= 3 || throw(ArgumentError("grid must be at least 3x3"))
    size(forcing) == size(stress) || throw(ArgumentError("forcing grid shape mismatch"))
    isfinite(diffusivity) && diffusivity >= 0 ||
        throw(ArgumentError("diffusivity must be finite and non-negative"))
    isfinite(dt) && dt > 0 || throw(ArgumentError("dt must be finite and positive"))
    diffusivity * dt <= 0.25 ||
        throw(ArgumentError("explicit step violates the conservative 2-D stability bound"))
    all(isfinite, stress) && all(isfinite, forcing) ||
        throw(ArgumentError("stress and forcing must be finite"))

    next = Matrix{Float64}(stress)
    for row in 2:rows-1, col in 2:cols-1
        laplacian = stress[row-1, col] + stress[row+1, col] +
                    stress[row, col-1] + stress[row, col+1] -
                    4 * stress[row, col]
        next[row, col] = stress[row, col] +
                         dt * (diffusivity * laplacian + forcing[row, col])
    end
    return next
end

"""Return a dimensionless squared-field proxy; not a physical energy estimate."""
function energy_proxy(stress::AbstractMatrix{<:Real})
    all(isfinite, stress) || throw(ArgumentError("stress grid must be finite"))
    return sum(abs2, stress) / 2
end

end
