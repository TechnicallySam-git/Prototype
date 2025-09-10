import os
import sys
import logging

# Configuration via environment
PORT = int(os.environ.get("PORT", os.environ.get("WEBSITES_PORT", 5000)))
HOST = os.environ.get("HOST", "0.0.0.0")
DEBUG = os.environ.get("DEBUG", "0").lower() in ("1", "true", "yes")
LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO").upper()

logging.basicConfig(stream=sys.stdout, level=LOG_LEVEL,
                    format='[startup] %(asctime)s %(levelname)s %(message)s')
log = logging.getLogger("startup")

# Attempt async acceleration (eventlet preferred on Azure Linux)
async_stack = None
try:
    import eventlet  # type: ignore
    eventlet.monkey_patch()
    async_stack = "eventlet"
except Exception as e:  # pragma: no cover
    log.warning("eventlet not available (%s) - falling back to default threading", e)

# Import application AFTER monkey patch
try:
    from multi import app, socketio, start_ticker  # type: ignore
except Exception as e:  # pragma: no cover
    log.exception("Failed importing multi.py: %s", e)
    raise

# Start background ticker before entering main loop
try:
    start_ticker()
    log.info("Background ticker started")
except Exception as e:  # pragma: no cover
    log.warning("Could not start ticker: %s", e)

# Display environment summary
log.info("Starting Socket.IO server on %s:%s (debug=%s, async=%s)", HOST, PORT, DEBUG, async_stack or "threading")

if __name__ == "__main__":
    # Run directly with socketio (uses eventlet if monkey patched)
    socketio.run(app, host=HOST, port=PORT, debug=DEBUG, allow_unsafe_werkzeug=False)