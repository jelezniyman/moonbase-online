const socket = io();

const loginScreen = document.getElementById('loginScreen');
const gameContainer = document.getElementById('gameContainer');
const joinBtn = document.getElementById('joinBtn');
const usernameInput = document.getElementById('usernameInput');
const colorInput = document.getElementById('colorInput');
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const chatInput = document.getElementById('chatInput');
const chatMessages = document.getElementById('chatMessages');

const moonRadius = 450; 
let cx, cy; 

let currentScore = 0;
let defaultTop = [5000, 4500, 4000, 3500, 3000, 2500, 2000, 1500, 1000, 800, 500, 200, 99];

let selectedHelmet = 'dome';
document.querySelectorAll('#helmetSelector .h-opt').forEach(opt => {
    opt.addEventListener('click', () => {
        document.querySelectorAll('#helmetSelector .h-opt').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        selectedHelmet = opt.getAttribute('data-val');
    });
});

let selectedWeapon = 'tomato';
document.querySelectorAll('#weaponSelector .h-opt').forEach(opt => {
    opt.addEventListener('click', () => {
        document.querySelectorAll('#weaponSelector .h-opt').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        selectedWeapon = opt.getAttribute('data-val');
    });
});

const PLAYER_W = 45;  
const PLAYER_H = 75; 

const player = {
    name: 'Астронавт', angle: -Math.PI / 2, distance: moonRadius, 
    velocityAngle: 0, velocityRadial: 0, color: '#0055ff', headStyle: 'dome',
    animTime: 0, onGround: true, direction: 1, splats: []
};

const otherPlayers = {};

const GRAVITY = 0.15; const JUMP_FORCE = 6; const MOVE_SPEED = 0.0035; const FRICTION = 0.85;
const keys = { left: false, right: false, up: false };

let stars = [];
const surfaceCraters = [ { r: 40, dist: 150, angle: Math.PI / 4 }, { r: 25, dist: 280, angle: Math.PI / 1.2 }, { r: 70, dist: 120, angle: -Math.PI / 2.5 }, { r: 20, dist: 380, angle: Math.PI / 1.5 }, { r: 45, dist: 220, angle: -Math.PI / 6 }, { r: 30, dist: 350, angle: Math.PI / 3 } ];
const rovers = [ { angle: Math.PI/3, speed: 0.002, dir: 1 }, { angle: -Math.PI/6, speed: 0.0015, dir: -1 } ];

const giantRocket = { x: 0, y: 50, width: 1120, height: 168, speed: 1.2, splats: [] };
const projectiles = [];
const particles = [];

// СЕТЬ
socket.on('currentPlayers', (players) => { Object.keys(players).forEach(id => { if (id !== socket.id) otherPlayers[id] = players[id]; }); });
socket.on('newPlayer', (playerData) => { otherPlayers[playerData.id] = playerData; });
socket.on('playerMoved', (playerData) => { if (otherPlayers[playerData.id]) Object.assign(otherPlayers[playerData.id], playerData); });
socket.on('playerDisconnected', (id) => { delete otherPlayers[id]; });
socket.on('newProjectile', (p) => { projectiles.push(p); });
socket.on('chatMessage', (data) => {
    const msgEl = document.createElement('div'); msgEl.className = 'chat-msg';
    msgEl.innerHTML = `<strong style="color:${data.color}">${data.name}:</strong> ${data.text}`;
    chatMessages.appendChild(msgEl); chatMessages.scrollTop = chatMessages.scrollHeight;
});

setInterval(() => {
    if (loginScreen.style.display === 'none') {
        socket.emit('playerMovement', { angle: player.angle, distance: player.distance, animTime: player.animTime, direction: player.direction, onGround: player.onGround });
    }
}, 50);

// ФУНКЦИЯ ВЫСТРЕЛА
function shootAction(clientX, clientY) {
    if (document.activeElement === chatInput || loginScreen.style.display !== 'none') return;
    const rect = canvas.getBoundingClientRect();
    let px = cx + Math.cos(player.angle) * player.distance; 
    let py = cy + Math.sin(player.angle) * player.distance;
    let angle = Math.atan2((clientY - rect.top) - py, (clientX - rect.left) - px);
    
    let proj = { 
        x: px + Math.cos(angle)*30, y: py - 20 + Math.sin(angle)*30, 
        vx: Math.cos(angle) * 18, vy: Math.sin(angle) * 18,
        type: selectedWeapon, isLocal: true 
    };
    
    projectiles.push(proj);
    socket.emit('shoot', proj); 
}

// УПРАВЛЕНИЕ МЫШЬЮ / КЛАВИАТУРОЙ
canvas.addEventListener('mousedown', (e) => shootAction(e.clientX, e.clientY));

window.addEventListener('keydown', (e) => {
    if (document.activeElement === chatInput) { 
        if (e.key === 'Enter' && chatInput.value.trim() !== '') { 
            socket.emit('chatMessage', { name: player.name, color: player.color, text: chatInput.value });
            chatInput.value = ''; 
        } 
        return; 
    }
    if (e.key === 'Enter') { chatInput.focus(); e.preventDefault(); return; }
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') keys.left = true;
    if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.right = true;
    if (e.code === 'Space' || e.code === 'ArrowUp') keys.up = true;
});
window.addEventListener('keyup', (e) => { if (e.code === 'KeyA' || e.code === 'ArrowLeft') keys.left = false; if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.right = false; if (e.code === 'Space' || e.code === 'ArrowUp') keys.up = false; });

// МОБИЛЬНОЕ УПРАВЛЕНИЕ (ТАСКАНИЯ И ТАПЫ)
canvas.addEventListener('touchstart', (e) => {
    if(e.touches.length > 0 && e.target === canvas) {
        shootAction(e.touches[0].clientX, e.touches[0].clientY);
    }
}, {passive: false});

const addTouchBtn = (id, key) => {
    const btn = document.getElementById(id);
    if(!btn) return;
    btn.addEventListener('touchstart', (e) => { e.preventDefault(); keys[key] = true; });
    btn.addEventListener('touchend', (e) => { e.preventDefault(); keys[key] = false; });
};
addTouchBtn('btnLeft', 'left');
addTouchBtn('btnRight', 'right');
addTouchBtn('btnJump', 'up');

joinBtn.addEventListener('click', () => {
    player.name = usernameInput.value.trim() || 'Астронавт';
    player.color = colorInput.value;
    player.headStyle = selectedHelmet; 
    loginScreen.style.display = 'none'; gameContainer.style.display = 'block';
    
    socket.emit('joinGame', {
        name: player.name, color: player.color, headStyle: player.headStyle,
        angle: player.angle, distance: player.distance, animTime: player.animTime, direction: player.direction
    });

    socket.emit('chatMessage', { name: 'СИСТЕМА', color: '#fff', text: `${player.name} прибыл на базу.` });
    resizeCanvas();
    requestAnimationFrame(gameLoop);
});

function updatePhysics() {
    stars.forEach(star => { star.x += 0.1; if (star.x > canvas.width) star.x = -10; });
    giantRocket.x += giantRocket.speed; if (giantRocket.x > canvas.width) giantRocket.x -= canvas.width;

    for (let i = giantRocket.splats.length - 1; i >= 0; i--) {
        giantRocket.splats[i].life -= 0.004; if (giantRocket.splats[i].life <= 0) giantRocket.splats.splice(i, 1);
    }

    for (let i = projectiles.length - 1; i >= 0; i--) {
        let p = projectiles[i]; p.x += p.vx; p.y += p.vy;
        let angleToCenter = Math.atan2(cy - p.y, cx - p.x);
        p.vx += Math.cos(angleToCenter) * 0.15; p.vy += Math.sin(angleToCenter) * 0.15;

        let hit = false; let targetSplats = null; let relX = 0; let relY = 0;

        if (Math.hypot(p.x - cx, p.y - cy) <= moonRadius) hit = true;
        if (!hit) {
            let loopedX = giantRocket.x > canvas.width / 2 ? giantRocket.x - canvas.width : giantRocket.x + canvas.width;
            let checkX = (p.x >= giantRocket.x && p.x <= giantRocket.x + giantRocket.width) ? giantRocket.x : loopedX;
            if (p.x >= checkX && p.x <= checkX + giantRocket.width && p.y >= giantRocket.y && p.y <= giantRocket.y + giantRocket.height) {
                hit = true; targetSplats = giantRocket.splats; relX = p.x - checkX; relY = p.y - giantRocket.y;
                if (p.isLocal) currentScore += 9; 
            }
        }

        if (hit) {
            let color1 = p.type === 'tomato' ? '#e60000' : p.type === 'banana' ? '#ffe135' : '#ffffff';
            let color2 = p.type === 'tomato' ? 'rgba(220, 20, 20, 0.85)' : p.type === 'banana' ? 'rgba(255, 225, 53, 0.85)' : 'rgba(255, 255, 200, 0.85)';
            if (targetSplats) targetSplats.push({ x: relX/1.4, y: relY/1.4, r: 5 + Math.random() * 15, life: 1.0, color: color2 });
            for(let k=0; k<12; k++){ particles.push({ x: p.x, y: p.y, vx: (Math.random()-0.5)*10, vy: (Math.random()-0.5)*10, life: 1.0, color: color1 }); }
            projectiles.splice(i, 1);
        } else if (p.x < -500 || p.x > canvas.width+500 || p.y < -500 || p.y > canvas.height+500) { projectiles.splice(i, 1); }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i]; p.x += p.vx; p.y += p.vy; p.vy += 0.2; p.life -= 0.03;
        if (p.life <= 0) particles.splice(i, 1);
    }

    if (document.activeElement !== chatInput) {
        if (keys.left) { player.velocityAngle -= MOVE_SPEED; player.direction = -1; }
        if (keys.right) { player.velocityAngle += MOVE_SPEED; player.direction = 1; }
        if (keys.up && player.onGround) { player.velocityRadial = JUMP_FORCE; player.onGround = false; }
    }

    let isMoving = keys.left || keys.right;
    player.animTime += (isMoving || !player.onGround) ? (player.onGround ? Math.abs(player.velocityAngle) * 8 : 0.01) : 0;
    if (!isMoving && player.onGround) player.animTime = 0;

    player.velocityAngle *= FRICTION; player.angle += player.velocityAngle;
    if (player.distance > moonRadius) player.velocityRadial -= GRAVITY;
    player.distance += player.velocityRadial;
    if (player.distance <= moonRadius) { player.distance = moonRadius; player.velocityRadial = 0; player.onGround = true; }
    rovers.forEach(r => { r.angle += r.speed * r.dir; if(Math.random() < 0.005) r.dir *= -1; });
}

function drawJointedLimbSegment(ctx, color, width, length, angleBase, angleOffset, isUpper = false) {
    ctx.save(); ctx.rotate(angleBase + angleOffset); ctx.fillStyle = color; ctx.beginPath();
    if (isUpper) { ctx.roundRect(-width * 0.5, 0, width, length + width * 0.4, width * 0.4); } else { ctx.roundRect(-width * 0.4, 0, width * 0.8, length, width * 0.3); }
    ctx.fill(); ctx.fillStyle = '#666'; ctx.beginPath(); ctx.arc(0, 0, width * 0.3, 0, Math.PI * 2); ctx.fill(); ctx.restore();
}

function drawScienceStation(cx, cy, radius, angle) {
    let px = cx + Math.cos(angle) * radius; let py = cy + Math.sin(angle) * radius; 
    ctx.save(); ctx.translate(px, py); ctx.rotate(angle + Math.PI / 2); ctx.scale(2, 2);
    ctx.fillStyle = '#555'; ctx.fillRect(-68, 0, 6, 25); ctx.fillRect(62, 0, 6, 25); 
    ctx.fillStyle = '#ddd'; ctx.beginPath(); ctx.arc(0, 0, 70, Math.PI, 0); ctx.fill(); ctx.fillStyle = 'rgba(100, 200, 255, 0.4)'; ctx.beginPath(); ctx.arc(0, 0, 60, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#114488'; ctx.fillRect(70, -40, 60, 15); ctx.fillRect(-130, -40, 60, 15); ctx.fillStyle = '#555'; ctx.fillRect(70, -30, 5, 30); ctx.fillRect(-75, -30, 5, 30);
    ctx.strokeStyle = '#aaa'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, -70); ctx.lineTo(0, -160); ctx.stroke(); ctx.beginPath(); ctx.arc(0, -160, 30, Math.PI*0.1, Math.PI*0.9, true); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, -160); ctx.lineTo(0, -180); ctx.stroke(); ctx.fillStyle = 'red'; ctx.beginPath(); ctx.arc(0, -180, 4, 0, Math.PI*2); ctx.fill();
    ctx.restore();
}

function drawStandaloneFlag(cx, cy, radius, angle) {
    let px = cx + Math.cos(angle) * radius; let py = cy + Math.sin(angle) * radius; 
    ctx.save(); ctx.translate(px, py); ctx.rotate(angle + Math.PI / 2); ctx.scale(2, 2); 
    ctx.fillStyle = '#999'; ctx.fillRect(-2, -120, 4, 120); ctx.fillStyle = 'white'; ctx.fillRect(2, -120, 75, 15); ctx.fillStyle = 'blue'; ctx.fillRect(2, -105, 75, 15); ctx.fillStyle = 'red'; ctx.fillRect(2, -90, 75, 15);
    ctx.restore();
}

function drawGiantRocket(xOffset) {
    ctx.save(); ctx.translate(giantRocket.x + xOffset, giantRocket.y); ctx.scale(1.4, 1.4); ctx.shadowBlur = 0; 
    for(let i=0; i<3; i++) {
        let ty = 30 + i * 30; ctx.fillStyle = 'orange'; ctx.beginPath(); ctx.moveTo(0, ty-12); ctx.lineTo(-120 - Math.random()*50, ty); ctx.lineTo(0, ty+12); ctx.fill(); ctx.fillStyle = 'yellow'; ctx.beginPath(); ctx.moveTo(0, ty-6); ctx.lineTo(-60 - Math.random()*20, ty); ctx.lineTo(0, ty+6); ctx.fill(); ctx.fillStyle = '#222'; ctx.fillRect(-15, ty-15, 35, 30);
    }
    ctx.fillStyle = '#f8f8f8'; ctx.beginPath(); ctx.moveTo(20, 10); ctx.lineTo(550, 10); ctx.quadraticCurveTo(800, 60, 800, 60); ctx.quadraticCurveTo(550, 110, 550, 110); ctx.lineTo(20, 110); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#ccc'; ctx.lineWidth = 2;
    for (let i = 80; i < 500; i += 100) { ctx.beginPath(); ctx.moveTo(i, 10); ctx.lineTo(i, 110); ctx.stroke(); ctx.fillStyle = '#bbb'; for (let r = 18; r < 110; r+= 18) { ctx.beginPath(); ctx.arc(i+6, r, 2, 0, Math.PI*2); ctx.fill(); } }
    ctx.fillStyle = '#cc0000'; ctx.beginPath(); ctx.moveTo(20, 10); ctx.lineTo(60, -30); ctx.lineTo(80, 10); ctx.fill(); ctx.beginPath(); ctx.moveTo(20, 110); ctx.lineTo(60, 150); ctx.lineTo(80, 110); ctx.fill(); ctx.fillStyle = '#111'; ctx.font = 'bold 70px "Arial Black", sans-serif'; ctx.fillText("U S A", 300, 85);
    const flagX = 120; const flagY = 35; const flagW = 120; const flagH = 60; ctx.fillStyle = 'white'; ctx.fillRect(flagX, flagY, flagW, flagH); ctx.fillStyle = '#B22234'; for(let i=0; i<7; i++) { if(i%2===0) ctx.fillRect(flagX, flagY + i*(flagH/7), flagW, flagH/7); } ctx.fillStyle = '#3C3B6E'; ctx.fillRect(flagX, flagY, flagW*0.4, flagH*0.5); ctx.fillStyle = 'cyan'; ctx.strokeStyle = '#444'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(550, 60, 20, 0, Math.PI*2); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.arc(640, 60, 30, 0, Math.PI*2); ctx.fill(); ctx.stroke(); 
    giantRocket.splats.forEach(s => { ctx.globalAlpha = s.life; ctx.fillStyle = s.color; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI*2); ctx.arc(s.x + s.r*0.8, s.y - s.r*0.5, s.r*0.6, 0, Math.PI*2); ctx.arc(s.x - s.r*0.5, s.y + s.r*0.9, s.r*0.7, 0, Math.PI*2); ctx.fill(); ctx.globalAlpha = 1.0; }); ctx.restore();
}

function drawCharacter(charObj) {
    if (!charObj) return;
    let px = cx + Math.cos(charObj.angle) * charObj.distance; let py = cy + Math.sin(charObj.angle) * charObj.distance;
    ctx.save(); ctx.translate(px, py); ctx.rotate(charObj.angle + Math.PI / 2); ctx.save(); ctx.scale(charObj.direction, 1); 
    const torsoH = PLAYER_H * 0.35; const hipW = PLAYER_W * 0.5; const limbW = PLAYER_W * 0.3; const thighL = PLAYER_H * 0.25; const calfL = PLAYER_H * 0.2; const armL = PLAYER_H * 0.2; const armSwing = Math.cos(charObj.animTime) * 0.5; const legSwing = Math.sin(charObj.animTime) * 0.6; const isJumping = !charObj.onGround; 
    ctx.fillStyle = charObj.color; ctx.beginPath(); ctx.roundRect(-PLAYER_W/2 - 5, -PLAYER_H * 0.75, 12, PLAYER_H * 0.5, 5); ctx.fill();
    const legY = -PLAYER_H * 0.25; ctx.save(); ctx.translate(-hipW / 2, legY); let baseLegAngle = isJumping ? Math.PI / 2 - 0.4 : Math.PI / 2; drawJointedLimbSegment(ctx, charObj.color, limbW, thighL, baseLegAngle, -legSwing, true); ctx.translate(0, thighL); drawJointedLimbSegment(ctx, charObj.color, limbW, calfL, baseLegAngle, legSwing > 0 ? legSwing*1.2 : legSwing*0.2, false); ctx.restore();
    ctx.fillStyle = charObj.color; ctx.beginPath(); ctx.roundRect(-PLAYER_W/2, -PLAYER_H * 0.65, PLAYER_W, torsoH + PLAYER_H * 0.15, hipW/2); ctx.fill(); ctx.save(); ctx.translate(hipW / 2, legY); drawJointedLimbSegment(ctx, charObj.color, limbW, thighL, baseLegAngle, legSwing, true); ctx.translate(0, thighL); drawJointedLimbSegment(ctx, charObj.color, limbW, calfL, baseLegAngle, legSwing < 0 ? legSwing*0.2 : legSwing*1.2, false); ctx.restore();
    const armY = -PLAYER_H * 0.6; const armBaseAngle = isJumping ? Math.PI / 2 + 0.6 : Math.PI / 2; ctx.save(); ctx.translate(-PLAYER_W * 0.4, armY); drawJointedLimbSegment(ctx, charObj.color, limbW * 0.8, armL, armBaseAngle, -armSwing, true); ctx.translate(0, armL); drawJointedLimbSegment(ctx, charObj.color, limbW * 0.8, armL, armBaseAngle, -armSwing * 0.5, false); ctx.restore(); ctx.save(); ctx.translate(PLAYER_W * 0.4, armY); drawJointedLimbSegment(ctx, charObj.color, limbW * 0.8, armL, armBaseAngle, armSwing, true); ctx.translate(0, armL); drawJointedLimbSegment(ctx, charObj.color, limbW * 0.8, armL, armBaseAngle, armSwing * 0.5, false); ctx.restore();
    const headRadius = PLAYER_W / 2 + 5; const headY = -PLAYER_H * 0.65; ctx.save(); ctx.translate(0, headY); ctx.fillStyle = '#aaa'; ctx.beginPath(); ctx.roundRect(-headRadius*0.9, -5, headRadius*1.8, 10, 3); ctx.fill();
    switch (charObj.headStyle) {
        case 'dome': ctx.fillStyle = '#ffccaa'; ctx.beginPath(); ctx.arc(0, 0, headRadius*0.6, 0, Math.PI*2); ctx.fill(); ctx.fillStyle = 'rgba(160, 220, 255, 0.45)'; ctx.beginPath(); ctx.arc(0, 0, headRadius + 2, 0, Math.PI*2); ctx.fill(); ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(0, 0, headRadius - 2, Math.PI*1.1, Math.PI*1.4); ctx.stroke(); break;
        case 'retro': ctx.fillStyle = '#b87333'; ctx.beginPath(); ctx.arc(0, -8, headRadius + 4, 0, Math.PI*2); ctx.fill(); ctx.fillStyle = '#333'; ctx.beginPath(); ctx.arc(5, -10, headRadius * 0.55, 0, Math.PI*2); ctx.fill(); ctx.fillStyle = 'cyan'; ctx.beginPath(); ctx.arc(5, -10, headRadius * 0.45, 0, Math.PI*2); ctx.fill(); ctx.fillStyle = charObj.color; for(let a=0; a<Math.PI*2; a+=Math.PI/4) { ctx.beginPath(); ctx.arc(0 + Math.cos(a)*headRadius, -8 + Math.sin(a)*headRadius, 2, 0, Math.PI*2); ctx.fill(); } break;
        case 'moto': ctx.fillStyle = '#222'; ctx.beginPath(); ctx.ellipse(0, -2, headRadius+1, headRadius * 0.9, 0, Math.PI * 0.8, Math.PI * 2.2); ctx.lineTo(12, 10); ctx.lineTo(-12, 10); ctx.closePath(); ctx.fill(); ctx.fillStyle = charObj.color; ctx.fillRect(-2, -headRadius-2, 4, headRadius); ctx.fillStyle = '#111'; ctx.beginPath(); ctx.roundRect(0, -12, headRadius+1, 18, 5); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(5, -10); ctx.lineTo(headRadius-2, -10); ctx.stroke(); break;
        case 'crown': ctx.fillStyle = charObj.color; ctx.beginPath(); ctx.arc(0, 5, headRadius*0.8, Math.PI, 0); ctx.fill(); ctx.fillStyle = 'gold'; ctx.strokeStyle = '#daa520'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-headRadius, 5); ctx.lineTo(-headRadius, -15); ctx.lineTo(-headRadius*0.6, -5); ctx.lineTo(-headRadius*0.3, -20); ctx.lineTo(0, -5); ctx.lineTo(headRadius*0.3, -20); ctx.lineTo(headRadius*0.6, -5); ctx.lineTo(headRadius, -15); ctx.lineTo(headRadius, 5); ctx.closePath(); ctx.fill(); ctx.stroke(); break;
        case 'glow': ctx.fillStyle = 'white'; ctx.save(); ctx.shadowBlur = 40; ctx.shadowColor = charObj.color; ctx.beginPath(); ctx.arc(0, -8, headRadius, 0, Math.PI*2); ctx.fill(); ctx.restore(); break;
    }
    ctx.restore(); ctx.restore(); ctx.fillStyle = 'white'; ctx.font = 'bold 24px Arial'; ctx.textAlign = 'center'; ctx.fillText(charObj.name, 0, -PLAYER_H - headRadius - 15); ctx.restore();
}

// АДАПТИВНЫЙ РЕЙТИНГ
function drawLeaderboard() {
    ctx.save(); 
    
    // Подстройка размеров таблицы для телефона и ПК
    let isMobile = window.innerWidth < 768;
    let lbW = isMobile ? 160 : 220;
    let lbH = isMobile ? 240 : 300;
    let fontSize = isMobile ? 12 : 16;
    let paddingRight = isMobile ? 15 : 25;
    let yOffset = isMobile ? window.innerHeight - 250 : window.innerHeight - 310;
    
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)"; ctx.beginPath(); 
    ctx.roundRect(canvas.width - lbW - 10, yOffset, lbW, lbH, 10); ctx.fill();
    ctx.fillStyle = "#aaaaaa"; ctx.font = `${fontSize}px 'Courier New', Courier, monospace`; ctx.textAlign = "right"; 
    
    let startX = canvas.width - paddingRight; 
    let startY = yOffset + 30; 
    ctx.fillText("РЕЙТИНГ (ТОП-13):", startX, startY);
    
    let currentTop = [...defaultTop, currentScore].sort((a, b) => b - a).slice(0, 13);
    for (let i = 0; i < 13; i++) {
        let scoreText = currentTop[i];
        ctx.fillStyle = (scoreText === currentScore && currentScore > 0) ? "#00FF00" : "white";
        ctx.fillText(`${i + 1}. ${scoreText}`, startX, startY + (isMobile? 20 : 25) + (i * (isMobile? 12 : 15))); 
    }
    ctx.fillStyle = "#00FF00"; ctx.font = `bold ${fontSize + 2}px 'Courier New', Courier, monospace`; 
    ctx.fillText(`Ваш счет: ${currentScore}`, startX, startY + (isMobile? 15 : 40) + (13 * (isMobile? 12 : 15)));
    ctx.restore();
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'white'; stars.forEach(star => { star.size += star.blink; if(star.size > 2 || star.size < 0.5) star.blink *= -1; ctx.beginPath(); ctx.arc(star.x, star.y, Math.abs(star.size), 0, Math.PI*2); ctx.fill(); });
    
    // Адаптивное расположение планеты Земля на фоне
    const earthX = window.innerWidth < 768 ? canvas.width - 50 : canvas.width * 0.75; 
    const earthY = window.innerWidth < 768 ? 150 : 250; 
    const earthRadius = window.innerWidth < 768 ? 60 : 100; 
    ctx.save(); ctx.shadowBlur = 40; ctx.shadowColor = 'rgba(100, 150, 255, 0.7)'; ctx.fillStyle = '#1144cc'; ctx.beginPath(); ctx.arc(earthX, earthY, earthRadius, 0, Math.PI*2); ctx.fill(); ctx.restore(); ctx.save(); ctx.beginPath(); ctx.arc(earthX, earthY, earthRadius, 0, Math.PI*2); ctx.clip(); ctx.fillStyle = '#22aa22'; ctx.beginPath(); ctx.moveTo(earthX - 70, earthY - 80); ctx.lineTo(earthX - 20, earthY - 50); ctx.lineTo(earthX - 40, earthY - 10); ctx.lineTo(earthX - 10, earthY + 40); ctx.lineTo(earthX - 30, earthY + 80); ctx.lineTo(earthX - 60, earthY + 20); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(earthX + 20, earthY - 90); ctx.lineTo(earthX + 90, earthY - 70); ctx.lineTo(earthX + 80, earthY + 10); ctx.lineTo(earthX + 40, earthY + 20); ctx.lineTo(earthX + 50, earthY + 70); ctx.lineTo(earthX + 10, earthY + 40); ctx.lineTo(earthX + 30, earthY - 20); ctx.closePath(); ctx.fill(); ctx.restore();
    
    drawGiantRocket(0); if (giantRocket.x > canvas.width - giantRocket.width) drawGiantRocket(-canvas.width); if (giantRocket.x < 0) drawGiantRocket(canvas.width);
    ctx.fillStyle = '#cccccc'; ctx.beginPath(); ctx.arc(cx, cy, moonRadius, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#b0b0b0'; ctx.strokeStyle = '#e0e0e0'; ctx.lineWidth = 4; surfaceCraters.forEach(c => { let px = cx + Math.cos(c.angle) * c.dist; let py = cy + Math.sin(c.angle) * c.dist; ctx.beginPath(); ctx.arc(px, py, c.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); });
    drawScienceStation(cx, cy, moonRadius, -Math.PI/4); drawStandaloneFlag(cx, cy, moonRadius, -Math.PI/4 - 0.15);
    rovers.forEach(r => { let px = cx + Math.cos(r.angle) * moonRadius; let py = cy + Math.sin(r.angle) * moonRadius; ctx.save(); ctx.translate(px, py); ctx.rotate(r.angle + Math.PI / 2); ctx.fillStyle = '#e0aa00'; ctx.fillRect(-20, -20, 40, 20); ctx.fillStyle = '#333'; ctx.beginPath(); ctx.arc(-10, 0, 8, 0, Math.PI*2); ctx.arc(10, 0, 8, 0, Math.PI*2); ctx.fill(); ctx.strokeStyle = '#888'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(15, -20); ctx.lineTo(15, -45); ctx.stroke(); ctx.fillStyle = 'red'; ctx.beginPath(); ctx.arc(15, -45, 3, 0, Math.PI*2); ctx.fill(); ctx.restore(); });
    projectiles.forEach(p => { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.atan2(p.vy, p.vx)); if (p.type === 'tomato') { ctx.fillStyle = '#e60000'; ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI*2); ctx.fill(); ctx.fillStyle = '#009900'; ctx.fillRect(-2, -10, 4, 5); } else if (p.type === 'banana') { ctx.fillStyle = '#ffe135'; ctx.beginPath(); ctx.arc(0, 0, 10, 0.2, Math.PI); ctx.fill(); } else if (p.type === 'egg') { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(0, 0, 8, 6, 0, 0, Math.PI*2); ctx.fill(); } ctx.restore(); });
    particles.forEach(p => { ctx.fillStyle = p.color; ctx.globalAlpha = p.life; ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI*2); ctx.fill(); ctx.globalAlpha = 1.0; });

    Object.values(otherPlayers).forEach(p => drawCharacter(p));
    drawCharacter(player); 
    drawLeaderboard();
}

// ДИНАМИЧЕСКИЙ РЕСАЙЗ ХОЛСТА (камера подстраивается под экран)
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    cx = canvas.width / 2;
    // На смартфонах Луна сдвигается так, чтобы игрок и база всегда были в кадре
    cy = Math.max(canvas.height * 0.8, moonRadius + 120); 
    
    // Инициализация звёзд при первой загрузке или ресайзе
    if (stars.length === 0) {
        stars = Array.from({length: 150}, () => ({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, size: Math.random() * 2, blink: Math.random() * 0.05 }));
    }
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas(); // Вызов при старте

function gameLoop() { updatePhysics(); draw(); requestAnimationFrame(gameLoop); }