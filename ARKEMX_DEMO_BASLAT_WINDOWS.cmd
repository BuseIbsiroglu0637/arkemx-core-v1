@echo off
setlocal
cd /d "%~dp0"
title ARKEMX Yerel Demo
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 22.13 veya ustu kurulu olmali: https://nodejs.org/
  pause
  exit /b 1
)
if not exist "node_modules\vite\bin\vite.js" (
  echo Ilk kurulum gerekli. Bu klasorde terminal acip: npm ci
  echo Bir kez bagimlilik kurulduktan sonra GitHub Codespaces gerekmez.
  pause
  exit /b 1
)
call npm run demo:local
if errorlevel 1 (
  echo ARKEMX yerel demo baslatilamadi. Ayrintilar yukarida.
  pause
  exit /b 1
)
endlocal
