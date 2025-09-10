const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Arena settings
const ARENA_WIDTH = 1500;
const ARENA_HEIGHT = 800;
const TOP_MARGIN = 80;

canvas.width = ARENA_WIDTH;
canvas.height = ARENA_HEIGHT + TOP_MARGIN;

// Tank settings
const TANK_SIZE = 40;
const TANK_COLOR = 'green';

// Explosion settings
const EXPLOSION_GIF_PATH = "static/ezgif.com-resize.gif";
const EXPLOSION_DURATION = 600; // ms
const EXPLOSION_SIZE = 64;

let tank = {
    x: 400,
    y: 300 + TOP_MARGIN,
    size: TANK_SIZE,
    color: TANK_COLOR,
    bodyAngle: 0,
    headAngle: 0
};
const keys = {};
let mouse = { x: tank.x, y: tank.y };
let bullets = [];
let explosions = [];

// Load explosion GIF once
const explosionImg = new Image();
explosionImg.src = EXPLOSION_GIF_PATH;
let explosionImgLoaded = false;
explosionImg.onload = () => { explosionImgLoaded = true; };

// Start game loop after DOM is ready
window.addEventListener('DOMContentLoaded', () => { gameLoop(); });

// --- Input Handling ---
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
    const tankCenterX = tank.x + tank.size / 2;
    const tankCenterY = tank.y + tank.size / 2;
    tank.headAngle = Math.atan2(mouse.y - tankCenterY, mouse.x - tankCenterX);
});

// --- Game Logic ---
function fireBullet() {
    const barrelLength = tank.size * 0.8;
    const barrelOffset = tank.size * 0.1;
    const angle = tank.headAngle;
    const startX = tank.x + tank.size / 2 + Math.cos(angle) * (barrelOffset + barrelLength);
    const startY = tank.y + tank.size / 2 + Math.sin(angle) * (barrelOffset + barrelLength);
    bullets.push({
        x: startX,
        y: startY,
        angle: angle,
        speed: 6,
        bounces: 0,
        maxBounces: 1,
        radius: 8
    });
}

function spawnExplosion(x, y) {
    explosions.push({ x, y, start: performance.now() });
}

function updateBullets() {
    let remainingBullets = [];
    for (let bullet of bullets) {
        bullet.x += Math.cos(bullet.angle) * bullet.speed;
        bullet.y += Math.sin(bullet.angle) * bullet.speed;
        let bounced = false;
        if (bullet.x - bullet.radius < 0) {
            bullet.x = bullet.radius;
            bullet.angle = Math.PI - bullet.angle;
            bounced = true;
        } else if (bullet.x + bullet.radius > ARENA_WIDTH) {
            bullet.x = ARENA_WIDTH - bullet.radius;
            bullet.angle = Math.PI - bullet.angle;
            bounced = true;
        }
        if (bullet.y - bullet.radius < TOP_MARGIN) {
            bullet.y = TOP_MARGIN + bullet.radius;
            bullet.angle = -bullet.angle;
            bounced = true;
        } else if (bullet.y + bullet.radius > TOP_MARGIN + ARENA_HEIGHT) {
            bullet.y = TOP_MARGIN + ARENA_HEIGHT - bullet.radius;
            bullet.angle = -bullet.angle;
            bounced = true;
        }
        if (bounced) bullet.bounces += 1;
        if (bullet.bounces > bullet.maxBounces) {
            spawnExplosion(bullet.x, bullet.y);
        } else {
            remainingBullets.push(bullet);
        }
    }
    bullets = remainingBullets;
}

function updateExplosions() {
    const now = performance.now();
    explosions = explosions.filter(e => now - e.start < EXPLOSION_DURATION);
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
        let newX = tank.x + dx * speed;
        let newY = tank.y + dy * speed;
        const minX = 0;
        const minY = TOP_MARGIN;
        const maxX = ARENA_WIDTH - tank.size;
        const maxY = TOP_MARGIN + ARENA_HEIGHT - tank.size;
        tank.x = Math.max(minX, Math.min(maxX, newX));
        tank.y = Math.max(minY, Math.min(maxY, newY));
        tank.bodyAngle = Math.atan2(dy, dx);
    }
    updateBullets();
    updateExplosions();
}

// --- Drawing ---
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

function drawExplosions() {
    if (!explosionImgLoaded) return;
    for (let explosion of explosions) {
        ctx.drawImage(
            explosionImg,
            explosion.x - EXPLOSION_SIZE / 2,
            explosion.y - EXPLOSION_SIZE / 2,
            EXPLOSION_SIZE,
            EXPLOSION_SIZE
        );
    }
}

function drawTank() {
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
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Title
    ctx.save();
    ctx.font = "bold 38px Arial";
    ctx.fillStyle = "#222";
    ctx.textAlign = "center";
    ctx.fillText("Prototype of Tank Game", canvas.width / 2, 50);
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
    // Bullets, Explosions, Tank
    drawBullets();
    drawExplosions();
    drawTank();
}

// --- Main Loop ---
function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}