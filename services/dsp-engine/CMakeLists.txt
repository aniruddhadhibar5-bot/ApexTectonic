cmake_minimum_required(VERSION 3.20)
project(sentinel_dsp LANGUAGES CXX)

add_library(sentinel_dsp src/filter.cpp)
target_compile_features(sentinel_dsp PUBLIC cxx_std_20)
target_include_directories(sentinel_dsp PUBLIC include)

include(CTest)
if(BUILD_TESTING)
  add_executable(sentinel_dsp_tests tests/filter_test.cpp)
  target_link_libraries(sentinel_dsp_tests PRIVATE sentinel_dsp)
  add_test(NAME sentinel_dsp_tests COMMAND sentinel_dsp_tests)
endif()
