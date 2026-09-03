$env:PATH = "C:\msys64\ucrt64\bin;" + $env:PATH
Write-Host "Configuring and Building Multi-Criteria Emergency Dispatch..." -ForegroundColor Cyan

cmake -B build -G "MinGW Makefiles"
if ($LASTEXITCODE -ne 0) {
    cmake -B build
}

cmake --build build

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nCompilation Successful! Running Unit Tests...`n" -ForegroundColor Green
    .\build\run_tests.exe
    
    Write-Host "`nRunning Main Simulation (dispatch_simulation.exe)...`n" -ForegroundColor Green
    .\build\dispatch_simulation.exe
} else {
    Write-Host "`nBuild Failed." -ForegroundColor Red
}
