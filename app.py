#!/usr/bin/env python3
"""
Alternative entry point for Azure App Service
Some Azure configurations look for app.py by default
"""
from multi import app, socketio

if __name__ == '__main__':
    import os
    port = int(os.environ.get('PORT', 8000))
    socketio.run(app, host="0.0.0.0", port=port, debug=False)
