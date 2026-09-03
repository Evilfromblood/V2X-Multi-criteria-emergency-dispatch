cmake_minimum_required(VERSION 3.15)
project(MultiCriteriaEmergencyDispatch VERSION 1.0.0 LANGUAGES CXX)

# Target C++17 Standard
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# Strict Compiler Warnings (-Wall -Wextra -Wpedantic on GCC/Clang, /W4 on MSVC)
if(MSVC)
    add_compile_options(/W4)
else()
    add_compile_options(-Wall -Wextra -Wpedantic)
endif()

# Include directory
include_directories(${CMAKE_CURRENT_SOURCE_DIR}/include)

# Shared Core Simulation Engine Sources
set(CORE_ENGINE_SOURCES
    src/Ambulance.cpp
    src/AnalyticsEngine.cpp
    src/CLIDashboard.cpp
    src/DispatchCenter.cpp
    src/EmergencyVehicle.cpp
    src/FireEngine.cpp
    src/Incident.cpp
    src/RoadNetwork.cpp
    src/RouteOptimizer.cpp
    src/V2XHub.cpp
)

# Primary Executable Target
add_executable(dispatch_simulation
    src/main.cpp
    ${CORE_ENGINE_SOURCES}
)

# Automated Unit Test Target
add_executable(run_tests
    tests/test_routing.cpp
    ${CORE_ENGINE_SOURCES}
)

# CTest Configuration
enable_testing()
add_test(NAME RoutingAndDispatchUnitTests COMMAND run_tests)
