@echo off
chcp 65001 >nul
echo ============================================================================
echo   TRUSTLENS VN - HE THONG SOI REVIEW AO VA PHAT HIEN SEEDING TMDT VIET NAM
echo ============================================================================
echo [1/2] Dang khoi dong Backend FastAPI (http://localhost:8001)...
start "TrustLens VN - FastAPI Backend" cmd /k "cd /d "%~dp0backend" && python -m uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload"

echo [2/2] Dang khoi dong Frontend Next.js Dashboard (http://localhost:3000)...
start "TrustLens VN - Next.js Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo.
echo Hoan tat! Truy cap giao dien Web tai: http://localhost:3000
echo Tai lieu Swagger API tai:             http://localhost:8001/docs
pause
