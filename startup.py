#!/usr/bin/env python3
"""
Azure App Service startup file
This file is used as the entry point for Azure App Service
"""
from multi import app, socketio
import os

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8000))
    # Azure App Service requires specific configuration
    socketio.run(app, host="0.0.0.0", port=port, debug=False)
