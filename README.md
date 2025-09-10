# Multiplayer Tank Game

A real-time multiplayer tank game built with Flask-SocketIO and HTML5 Canvas.

## Features
- Real-time multiplayer gameplay
- Tank movement and shooting
- Bullet physics with bouncing
- Health system with respawning
- Explosion effects

## Local Development
1. Install Python 3.11
2. Install requirements: `pip install -r requirements.txt`
3. Run locally: `python multi.py`
4. Open browser to `http://localhost:5000`

## Azure App Service Deployment
This application is configured for deployment on Azure App Service.

### Required Files for Azure:
- `startup.py` - Entry point for Azure
- `requirements.txt` - Python dependencies
- `web.config` - IIS configuration
- `runtime.txt` - Python version specification
- `Procfile` - Process configuration

### Environment Variables:
- `PORT` - Set automatically by Azure
- `SECRET_KEY` - Set in Azure App Service Configuration

### Deployment Steps:
1. Create Azure App Service (Python 3.11)
2. Deploy code via Git, GitHub, or Azure DevOps
3. Azure will automatically install dependencies and start the application

## Game Controls
- **WASD** - Move tank
- **Mouse** - Aim turret
- **Space** - Fire bullets

## Technical Details
- Backend: Flask + Flask-SocketIO
- Frontend: HTML5 Canvas + JavaScript
- Real-time communication: WebSockets
- Physics: Server-authoritative bullet simulation
