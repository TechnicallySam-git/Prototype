@echo off
echo Starting Tank Game Server for Azure App Service...
echo.
echo Setting environment variables...
set PORT=8000
set PYTHONUNBUFFERED=1

echo Installing requirements...
pip install -r requirements.txt

echo Starting application...
python startup.py

pause
