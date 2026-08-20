$env:PATH = "C:\msys64\ucrt64\bin;" + $env:PATH
Write-Host "Compiling Multi-Criteria Emergency Dispatch..." -ForegroundColor Cyan
g++ -std=c++17 -Iinclude src/main.cpp src/EmergencyVehicle.cpp src/Incident.cpp src/Ambulance.cpp src/FireEngine.cpp -o dispatch.exe

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nCompilation successful! Executing dispatch.exe...`n" -ForegroundColor Green
    .\dispatch.exe
} else {
    Write-Host "`nCompilation failed." -ForegroundColor Red
}
