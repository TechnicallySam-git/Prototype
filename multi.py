from flask import Flask, render_template
from flask_socketio import SocketIO, emit
from flask import request
import math
import time
import os

app = Flask(__name__)
socketio = SocketIO(app)

arena_state = {
    "tanks": {},
    "bullets": []
}

ARENA_WIDTH = 1500
ARENA_HEIGHT = 800
TOP_MARGIN = 80
TICK_RATE = 20
SNAPSHOT_INTERVAL = 1.0
APP_VERSION = "1.0.0"

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/about')
def about_page():
    return render_template('about.html', version=APP_VERSION)

@socketio.on('join')
def on_join(data):
    tank_data = data["tank"].copy()
    tank_data["health"] = 50
    tank_data["maxHealth"] = 50
    arena_state["tanks"][request.sid] = tank_data
    emit('arena_state', arena_state, room=request.sid)
    emit('tank_joined', {'sid': request.sid, 'tank': tank_data}, broadcast=True, include_self=False)

@socketio.on('move')
def on_move(data):
    if request.sid in arena_state["tanks"]:
        arena_state["tanks"][request.sid].update(data)
        emit('tank_update', {'sid': request.sid, 'tank': arena_state["tanks"][request.sid]}, broadcast=True, include_self=False)

@socketio.on('fire')
def on_fire(data):
    bullet = {
        "x": data.get("x"),
        "y": data.get("y"),
        "angle": data.get("angle"),
        "speed": data.get("speed", 6),
        "bounces": 0,
        "maxBounces": data.get("maxBounces", 1),
        "radius": data.get("radius", 8),
        "owner": request.sid
    }
    arena_state["bullets"].append(bullet)
    emit('bullet_add', bullet, broadcast=True)

@socketio.on('disconnect')
def on_disconnect():
    arena_state["tanks"].pop(request.sid, None)
    emit('tank_left', {'sid': request.sid}, broadcast=True)

def server_tick_loop():
    last_snapshot = time.time()
    while True:
        new_bullets = []
        for b in arena_state["bullets"]:
            b["x"] += math.cos(b["angle"]) * b["speed"]
            b["y"] += math.sin(b["angle"]) * b["speed"]

            hit_tank = False
            for tank_sid, tank in arena_state["tanks"].items():
                if tank_sid == b["owner"]:
                    continue
                tank_center_x = tank["x"] + tank["size"] / 2
                tank_center_y = tank["y"] + tank["size"] / 2
                distance = math.sqrt((b["x"] - tank_center_x)**2 + (b["y"] - tank_center_y)**2)
                if distance < b["radius"] + tank["size"] / 2:
                    tank["health"] -= 1
                    hit_tank = True
                    socketio.emit('tank_damaged', {
                        'sid': tank_sid,
                        'health': tank["health"],
                        'maxHealth': tank["maxHealth"]
                    })
                    if tank["health"] <= 0:
                        tank["health"] = 50
                        tank["x"] = __import__('random').random() * (ARENA_WIDTH - tank["size"])
                        tank["y"] = __import__('random').random() * (ARENA_HEIGHT - tank["size"]) + TOP_MARGIN
                        socketio.emit('tank_respawned', {'sid': tank_sid, 'tank': tank})
                    socketio.emit('bullet_exploded', {"x": b["x"], "y": b["y"]})
                    break
            if hit_tank:
                continue

            bounced = False
            if b["x"] - b["radius"] < 0:
                b["x"] = b["radius"]
                b["angle"] = math.pi - b["angle"]
                bounced = True
            elif b["x"] + b["radius"] > ARENA_WIDTH:
                b["x"] = ARENA_WIDTH - b["radius"]
                b["angle"] = math.pi - b["angle"]
                bounced = True
            if b["y"] - b["radius"] < TOP_MARGIN:
                b["y"] = TOP_MARGIN + b["radius"]
                b["angle"] = -b["angle"]
                bounced = True
            elif b["y"] + b["radius"] > TOP_MARGIN + ARENA_HEIGHT:
                b["y"] = TOP_MARGIN + ARENA_HEIGHT - b["radius"]
                b["angle"] = -b["angle"]
                bounced = True
            if bounced:
                b["bounces"] += 1

            if b["bounces"] <= b.get("maxBounces", 1):
                new_bullets.append(b)
            else:
                socketio.emit('bullet_exploded', {"x": b["x"], "y": b["y"]})

        arena_state["bullets"] = new_bullets
        socketio.emit('bullets_update', arena_state["bullets"])

        now = time.time()
        if now - last_snapshot >= SNAPSHOT_INTERVAL:
            socketio.emit('arena_state', arena_state)
            last_snapshot = now

        socketio.sleep(1.0 / TICK_RATE)

def start_ticker():
    """Idempotent background loop starter."""
    if not getattr(start_ticker, "_started", False):
        socketio.start_background_task(server_tick_loop)
        start_ticker._started = True

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    start_ticker()
    socketio.run(app, host="0.0.0.0", port=port, debug=False)