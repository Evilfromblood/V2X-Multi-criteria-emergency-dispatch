@echo off
set PATH=C:\msys64\ucrt64\bin;%PATH%
echo Configuring and Building Multi-Criteria Emergency Dispatch...

cmake -B build -G "MinGW Makefiles"
if %ERRORLEVEL% NEQ 0 (
    cmake -B build
)

cmake --build build

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ===================================================
    echo Running Automated Unit Tests...
    echo ===================================================
    build\run_tests.exe
    
    echo.
    echo ===================================================
    echo Running Main Simulation...
    echo ===================================================
    build\dispatch_simulation.exe
) else (
    echo.
    echo Build failed.
)
