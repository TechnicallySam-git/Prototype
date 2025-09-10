from flask import Flask, render_template
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask import request
import math
import time

app = Flask(__name__)
socketio = SocketIO(app)

# Store all tanks and bullets in memory (for demo)
arena_state = {
    "tanks": {},   # {sid: {"x":..., "y":..., ...}}
    "bullets": []  # [{"x":..., "y":..., "angle":..., "speed":..., "bounces":..., "maxBounces":..., "radius":..., "owner": sid}]
}

# server constants
ARENA_WIDTH = 1500
ARENA_HEIGHT = 800
TOP_MARGIN = 80
TICK_RATE = 20             # physics ticks per second (bullet updates)
SNAPSHOT_INTERVAL = 1.0    # seconds for full arena snapshot
APP_VERSION = "1.0.0"

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/about')
def about_page():
    return render_template('about.html', version=APP_VERSION)

@socketio.on('join')
def on_join(data):
    # Add new tank for this user with health
    tank_data = data["tank"].copy()
    tank_data["health"] = 50  # Add health to server-side tank
    tank_data["maxHealth"] = 50
    arena_state["tanks"][request.sid] = tank_data
    # send initial full state to the joining client
    emit('arena_state', arena_state, room=request.sid)
    # notify others of the new tank (delta)
    emit('tank_joined', {'sid': request.sid, 'tank': tank_data}, broadcast=True, include_self=False)

@socketio.on('move')
def on_move(data):
    # Update this user's tank
    if request.sid in arena_state["tanks"]:
        arena_state["tanks"][request.sid].update(data)
        # emit only this tank's updated position (delta)
        emit('tank_update', {'sid': request.sid, 'tank': arena_state["tanks"][request.sid]}, broadcast=True, include_self=False)

@socketio.on('fire')
def on_fire(data):
    # Add bullet to arena (canonicalize fields on server)
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
    # emit only the new bullet (delta)
    emit('bullet_add', bullet, broadcast=True)

@socketio.on('disconnect')
def on_disconnect():
    # Remove tank on disconnect
    arena_state["tanks"].pop(request.sid, None)
    emit('tank_left', {'sid': request.sid}, broadcast=True)

# Background server tick: update bullets and broadcast lightweight bullet updates every tick.
def server_tick_loop():
    last_snapshot = time.time()
    while True:
        # physics step
        new_bullets = []
        for b in arena_state["bullets"]:
            # simple fixed-step movement
            b["x"] += math.cos(b["angle"]) * b["speed"]
            b["y"] += math.sin(b["angle"]) * b["speed"]

            # Check bullet-tank collisions BEFORE wall bouncing
            hit_tank = False
            for tank_sid, tank in arena_state["tanks"].items():
                if tank_sid == b["owner"]:  # Don't hit own tank
                    continue
                
                # Simple circle-rectangle collision
                tank_center_x = tank["x"] + tank["size"] / 2
                tank_center_y = tank["y"] + tank["size"] / 2
                distance = math.sqrt((b["x"] - tank_center_x)**2 + (b["y"] - tank_center_y)**2)
                
                if distance < b["radius"] + tank["size"] / 2:
                    # Bullet hit tank
                    tank["health"] -= 1
                    hit_tank = True
                    
                    # Emit tank damage event
                    socketio.emit('tank_damaged', {
                        'sid': tank_sid, 
                        'health': tank["health"],
                        'maxHealth': tank["maxHealth"]
                    })
                    
                    # Check if tank is destroyed
                    if tank["health"] <= 0:
                        # Respawn tank
                        tank["health"] = 50
                        tank["x"] = __import__('random').random() * (ARENA_WIDTH - tank["size"])
                        tank["y"] = __import__('random').random() * (ARENA_HEIGHT - tank["size"]) + TOP_MARGIN
                        socketio.emit('tank_respawned', {
                            'sid': tank_sid,
                            'tank': tank
                        })
                    
                    # Create explosion at bullet location
                    socketio.emit('bullet_exploded', {"x": b["x"], "y": b["y"]})
                    break
            
            if hit_tank:
                continue  # Don't add bullet to new_bullets (it's destroyed)

            bounced = False
            # left/right walls
            if b["x"] - b["radius"] < 0:
                b["x"] = b["radius"]
                b["angle"] = math.pi - b["angle"]
                bounced = True
            elif b["x"] + b["radius"] > ARENA_WIDTH:
                b["x"] = ARENA_WIDTH - b["radius"]
                b["angle"] = math.pi - b["angle"]
                bounced = True
            # top/bottom
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
                # bullet expired; emit explosion event
                socketio.emit('bullet_exploded', {"x": b["x"], "y": b["y"]})

        arena_state["bullets"] = new_bullets

        # lightweight broadcast for bullets every tick
        socketio.emit('bullets_update', arena_state["bullets"])

        # periodic full snapshot for correction
        now = time.time()
        if now - last_snapshot >= SNAPSHOT_INTERVAL:
            socketio.emit('arena_state', arena_state)
            last_snapshot = now

        socketio.sleep(1.0 / TICK_RATE)

if __name__ == '__main__':
    import os
    port = int(os.environ.get('PORT', 5000))
    socketio.start_background_task(server_tick_loop)
    socketio.run(app, host="0.0.0.0", port=port, debug=False)