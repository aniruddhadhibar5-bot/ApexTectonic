using Test
include("../stress_model.jl")
using .StressModel

@testset "bounded stress proxy" begin
    grid = zeros(5, 5)
    grid[3, 3] = 1.0
    next = diffuse_stress_step(grid, 0.1, 0.1)
    @test next[3, 3] < 1.0
    @test next[2, 3] > 0.0
    @test energy_proxy(grid) == 0.5
    @test_throws ArgumentError diffuse_stress_step(grid, 2.0, 1.0)
end
