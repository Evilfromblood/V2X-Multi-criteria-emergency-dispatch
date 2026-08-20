@echo off
set PATH=C:\msys64\ucrt64\bin;%PATH%
echo Compiling Multi-Criteria Emergency Dispatch...
g++ -std=c++17 -Iinclude src/main.cpp src/EmergencyVehicle.cpp src/Incident.cpp src/Ambulance.cpp src/FireEngine.cpp -o dispatch.exe

if %ERRORLEVEL% EQU 0 (
    echo.
    echo Compilation successful! Running dispatch.exe...
    echo ===================================================
    dispatch.exe
) else (
    echo.
    echo Compilation failed.
)
