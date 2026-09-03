cmake_minimum_required(VERSION 3.15)
project(EmergencyDispatchPlatform VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

if(MSVC)
    add_compile_options(/W4 /EHsc)
else()
    add_compile_options(-Wall -Wextra -O2)
endif()

include_directories(${CMAKE_CURRENT_SOURCE_DIR}/include)

set(CORE_SOURCES
    src/RoadNetwork.cpp
    src/RouteOptimizer.cpp
    src/Incident.cpp
    src/EmergencyVehicle.cpp
    src/Ambulance.cpp
    src/FireEngine.cpp
    src/V2XHub.cpp
    src/AnalyticsEngine.cpp
    src/DispatchCenter.cpp
    src/WebBridge.cpp
)

add_library(dispatch_core STATIC ${CORE_SOURCES})

if(WIN32)
    target_link_libraries(dispatch_core PUBLIC ws2_32)
endif()

# Main backend server executable
add_executable(emergency_dispatch_server src/main.cpp)
target_link_libraries(emergency_dispatch_server PRIVATE dispatch_core)

# Unit test suite executable
add_executable(test_core tests/test_core.cpp)
target_link_libraries(test_core PRIVATE dispatch_core)

enable_testing()
add_test(NAME CoreAlgorithmTests COMMAND test_core)
