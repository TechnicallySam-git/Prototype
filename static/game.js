const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Socket connection
const socket = io();

// Arena settings
const ARENA_WIDTH = 1500;
const ARENA_HEIGHT = 800;
const TOP_MARGIN = 80;

canvas.width = ARENA_WIDTH;
canvas.height = ARENA_HEIGHT + TOP_MARGIN;

// Game state
let myTank = {
    x: Math.random() * (ARENA_WIDTH - 40),
    y: Math.random() * (ARENA_HEIGHT - 40) + TOP_MARGIN,
    size: 40,
    color: 'green',
    bodyAngle: 0,
    headAngle: 0,
    health: 50,
    maxHealth: 50
};
let otherTanks = {}; // {sid: tank}
let bullets = []; // server-authoritative
let explosions = [];

// Load explosion GIF
const explosionImg = new Image();
explosionImg.src = "static/ezgif.com-resize.gif";
let explosionImgLoaded = false;
explosionImg.onload = () => { 
    explosionImgLoaded = true; 
    console.log("Explosion GIF loaded");
};
explosionImg.onerror = () => {
    console.error("Failed to load explosion GIF");
};

const keys = {};
let mouse = { x: myTank.x, y: myTank.y };

// Join the game
socket.emit('join', { tank: myTank });

// Socket event handlers for multiplayer
socket.on('arena_state', (data) => {
    // Full state update (periodic)
    otherTanks = {};
    for (const [sid, tank] of Object.entries(data.tanks)) {
        if (sid !== socket.id) {
            otherTanks[sid] = tank;
        }
    }
    bullets = data.bullets;
});

socket.on('tank_joined', (data) => {
    if (data.sid !== socket.id) {
        otherTanks[data.sid] = data.tank;
        console.log('Player joined:', data.sid);
    }
});

socket.on('tank_update', (data) => {
    if (data.sid !== socket.id) {
        otherTanks[data.sid] = data.tank;
    }
});

socket.on('tank_left', (data) => {
    delete otherTanks[data.sid];
    console.log('Player left:', data.sid);
});

socket.on('bullets_update', (serverBullets) => {
    bullets = serverBullets; // server-authoritative bullets
});

socket.on('bullet_add', (bullet) => {
    // Optional: could add bullet immediately for responsiveness
});

socket.on('bullet_exploded', (data) => {
    spawnExplosion(data.x, data.y);
});

socket.on('tank_damaged', (data) => {
    if (data.sid === socket.id) {
        myTank.health = data.health;
    } else if (otherTanks[data.sid]) {
        otherTanks[data.sid].health = data.health;
        otherTanks[data.sid].maxHealth = data.maxHealth;
    }
});

socket.on('tank_respawned', (data) => {
    if (data.sid === socket.id) {
        myTank = {...myTank, ...data.tank};
    } else if (otherTanks[data.sid]) {
        otherTanks[data.sid] = data.tank;
    }
});

// Input handling
document.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
    if (e.code === 'Space' && !keys['__spaceFired']) {
        keys['__spaceFired'] = true;
        fireBullet();
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
    if (e.code === 'Space') keys['__spaceFired'] = false;
});

window.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
    const tankCenterX = myTank.x + myTank.size / 2;
    const tankCenterY = myTank.y + myTank.size / 2;
    myTank.headAngle = Math.atan2(mouse.y - tankCenterY, mouse.x - tankCenterX);
});

function fireBullet() {
    const barrelLength = myTank.size * 0.8;
    const barrelOffset = myTank.size * 0.1;
    const angle = myTank.headAngle;
    const startX = myTank.x + myTank.size / 2 + Math.cos(angle) * (barrelOffset + barrelLength);
    const startY = myTank.y + myTank.size / 2 + Math.sin(angle) * (barrelOffset + barrelLength);
    
    socket.emit('fire', {
        x: startX,
        y: startY,
        angle: angle,
        speed: 6,
        maxBounces: 1,
        radius: 8
    });
}

function spawnExplosion(x, y) {
    explosions.push({ 
        x, 
        y, 
        start: performance.now(),
        frame: 0 
    });
}

function updateExplosions() {
    const now = performance.now();
    explosions = explosions.filter(explosion => {
        const elapsed = now - explosion.start;
        return elapsed < 600; // 600ms duration
    });
}

function drawExplosions() {
    if (!explosionImgLoaded) {
        // Fallback: draw orange circles if GIF not loaded
        ctx.save();
        ctx.fillStyle = "orange";
        for (let explosion of explosions) {
            ctx.beginPath();
            ctx.arc(explosion.x, explosion.y, 32, 0, 2 * Math.PI);
            ctx.fill();
        }
        ctx.restore();
        return;
    }

    // Draw actual explosion GIF
    ctx.save();
    for (let explosion of explosions) {
        const elapsed = performance.now() - explosion.start;
        const progress = elapsed / 600; // 600ms total duration
        
        if (progress < 1) {
            // Scale explosion size over time
            const size = 64 * (0.5 + progress * 0.5); // grows from 32px to 64px
            ctx.drawImage(
                explosionImg, 
                explosion.x - size/2, 
                explosion.y - size/2, 
                size, 
                size
            );
        }
    }
    ctx.restore();
}

function update() {
    const speed = 1.1;
    let dx = 0, dy = 0;
    if (keys['w']) dy -= 1;
    if (keys['s']) dy += 1;
    if (keys['a']) dx -= 1;
    if (keys['d']) dx += 1;
    
    if (dx !== 0 || dy !== 0) {
        const len = Math.hypot(dx, dy);
        dx /= len;
        dy /= len;
        let newX = myTank.x + dx * speed;
        let newY = myTank.y + dy * speed;
        const minX = 0;
        const minY = TOP_MARGIN;
        const maxX = ARENA_WIDTH - myTank.size;
        const maxY = TOP_MARGIN + ARENA_HEIGHT - myTank.size;
        myTank.x = Math.max(minX, Math.min(maxX, newX));
        myTank.y = Math.max(minY, Math.min(maxY, newY));
        myTank.bodyAngle = Math.atan2(dy, dx);
        
        // Send movement to server (throttled)
        if (!update.lastSent || Date.now() - update.lastSent > 50) {
            socket.emit('move', myTank);
            update.lastSent = Date.now();
        }
    }
    
    updateExplosions();
}

function drawTank(tank) {
    // Body
    ctx.save();
    ctx.translate(tank.x + tank.size / 2, tank.y + tank.size / 2);
    ctx.rotate(tank.bodyAngle);
    ctx.fillStyle = tank.color;
    ctx.fillRect(-tank.size / 2, -tank.size / 2, tank.size, tank.size);
    ctx.fillStyle = "#444";
    ctx.fillRect(-tank.size / 2 - 6, -tank.size / 2, 6, tank.size);
    ctx.fillRect(tank.size / 2, -tank.size / 2, 6, tank.size);
    ctx.restore();

    // Head & Barrel
    ctx.save();
    ctx.translate(tank.x + tank.size / 2, tank.y + tank.size / 2);
    ctx.rotate(tank.headAngle);
    ctx.beginPath();
    ctx.arc(0, 0, tank.size * 0.28, 0, 2 * Math.PI);
    ctx.fillStyle = "#124315ff";
    ctx.fill();
    ctx.fillStyle = 'black';
    ctx.fillRect(tank.size * 0.1, -6, tank.size * 0.8, 12);
    ctx.restore();

    // Health bar
    drawHealthBar(tank);
}

function drawHealthBar(tank) {
    const barWidth = 40;
    const barHeight = 6;
    const x = tank.x;
    const y = tank.y - 15;
    
    // Background (red)
    ctx.fillStyle = 'red';
    ctx.fillRect(x, y, barWidth, barHeight);
    
    // Health (green)
    const healthPercent = tank.health / tank.maxHealth;
    ctx.fillStyle = 'green';
    ctx.fillRect(x, y, barWidth * healthPercent, barHeight);
    
    // Border
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, barWidth, barHeight);
}

function drawBullets() {
    ctx.save();
    ctx.fillStyle = "#f44336";
    for (let bullet of bullets) {
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, bullet.radius, 0, 2 * Math.PI);
        ctx.fill();
    }
    ctx.restore();
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Title
    ctx.save();
    ctx.font = "bold 38px Arial";
    ctx.fillStyle = "#222";
    ctx.textAlign = "center";
    ctx.fillText("Multiplayer Tank Game", canvas.width / 2, 50);
    ctx.restore();
    
    // Arena background
    ctx.save();
    ctx.fillStyle = "#e0e0e0";
    ctx.fillRect(0, TOP_MARGIN, ARENA_WIDTH, ARENA_HEIGHT);
    ctx.restore();
    
    // Arena border
    ctx.save();
    ctx.strokeStyle = "#222";
    ctx.lineWidth = 6;
    ctx.strokeRect(0, TOP_MARGIN, ARENA_WIDTH, ARENA_HEIGHT);
    ctx.restore();
    
    // Draw my tank
    drawTank(myTank);
    
    // Draw other players
    for (const tank of Object.values(otherTanks)) {
        drawTank(tank);
    }
    
    drawBullets();
    drawExplosions(); // Make sure this is called
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// Start the game
window.addEventListener('DOMContentLoaded', () => { 
    gameLoop(); 
});