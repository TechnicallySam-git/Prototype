import os

try:
    import eventlet  # Optional: allows async WebSocket scaling
    eventlet.monkey_patch()
except Exception:
    pass

from multi import app, socketio, start_ticker  # assumes multi.py defines these

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    start_ticker()  # ensure background loop starts
    socketio.run(app, host="0.0.0.0", port=port, debug=False)