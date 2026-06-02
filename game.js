const { Engine, Render, Runner, Bodies, Composite, Constraint, MouseConstraint, Mouse } = Matter;

// 1. Configuración del Motor y mundo
const engine = Engine.create({ enableSleeping: false });
const world = engine.world;

// Dimensiones fijas para que ambos mundos sean idénticos
const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;

// 2. Creación de los personajes (Yarnys) - Movido arriba para evitar errores de referencia
const player1 = Bodies.circle(300, 400, 20, { 
    friction: 0.1, 
    frictionAir: 0.02,
    render: { fillStyle: '#ff4d4d' } 
});
const player2 = Bodies.circle(500, 400, 20, { 
    friction: 0.1, 
    frictionAir: 0.02,
    render: { fillStyle: '#4d79ff' } 
});

// 3. Suelo y Obstáculos
const ground = Bodies.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 30, GAME_WIDTH, 60, { isStatic: true });
const platform = Bodies.rectangle(GAME_WIDTH / 2, 450, 200, 40, { isStatic: true });

Composite.add(world, [player1, player2, ground, platform]);

// --- CONFIGURACIÓN DE RED (PeerJS) ---
function generateRoomCode() {
    // Genera un código corto de 5 caracteres (ej: 4F2G9)
    return Math.random().toString(36).substring(2, 7).toUpperCase();
}

// Configuración con servidores STUN públicos de Google para atravesar NAT/Firewalls
const peerConfig = {
    config: {
        'iceServers': [
            { 'urls': 'stun:stun.l.google.com:19302' },
            { 'urls': 'stun:stun1.l.google.com:19302' },
            { 'urls': 'stun:stun2.l.google.com:19302' }
        ]
    }
};

const peer = new Peer(generateRoomCode(), peerConfig);
let conn;
let isHost = false;
const myIdDisplay = document.getElementById('my-id');
const statusDisplay = document.getElementById('status');

peer.on('open', (id) => {
    myIdDisplay.innerText = id;
    statusDisplay.innerText = "📡 Esperando a un compañero...";
});

peer.on('error', (err) => {
    console.error('Error en PeerJS:', err.type);
    statusDisplay.innerText = "❌ Error: " + err.type;
    if (err.type === 'id-taken') {
        statusDisplay.innerText = "⚠️ ID ocupado, reintentando...";
        setTimeout(() => location.reload(), 2000);
    }
});

window.copyId = () => {
    const id = myIdDisplay.innerText;
    navigator.clipboard.writeText(id).then(() => {
        const originalText = statusDisplay.innerText;
        statusDisplay.innerText = "✅ ¡CÓDIGO COPIADO!";
        setTimeout(() => statusDisplay.innerText = originalText, 2000);
    });
};

// El Host recibe la conexión
peer.on('connection', (c) => {
    isHost = true;
    setupConnection(c);
});

// El Cliente inicia la conexión
window.connectToPeer = () => {
    const peerId = document.getElementById('peer-id').value.trim().toUpperCase();
    if (!peerId) {
        statusDisplay.innerText = "⚠️ Ingresa un código válido";
        return;
    }
    statusDisplay.innerText = "🔗 Conectando a " + peerId + "...";
    isHost = false;
    const connection = peer.connect(peerId, { reliable: true });
    setupConnection(connection);
};

function setupConnection(connection) {
    // Cerrar conexión previa si existe
    if (conn) conn.close();
    conn = connection;
    
    const onOpen = () => {
        statusDisplay.innerText = isHost ? "Eres el HOST (Rojo)" : "Conectado como CLIENTE (Azul)";
        if (!isHost) {
            console.log("Conectado como cliente. Desactivando física local.");
            engine.gravity.y = 0;
            Matter.Body.setStatic(player1, true);
            Matter.Body.setStatic(player2, true);
        }
    };

    connection.on('error', (err) => {
        console.error('Error de conexión:', err);
        statusDisplay.innerText = "❌ Fallo al conectar";
    });

    // Si la conexión ya está abierta, ejecutamos la lógica inmediatamente
    if (conn.open) onOpen();
    else conn.on('open', onOpen);

    conn.on('data', (data) => {
        if (isHost) {
            // Almacenar teclas remotas recibidas del cliente
            remoteKeys.left = !!data.l;
            remoteKeys.right = !!data.r;
            remoteKeys.jump = !!data.j;
        }
        else {
            updateClientWorld(data);
        }
    });
}

let remoteKeys = { left: false, right: false, jump: false };
// 2. Configuración del Renderizado
const render = Render.create({
    element: document.body,
    engine: engine,
    options: {
        width: GAME_WIDTH,
        height: GAME_HEIGHT,
        wireframes: false,
        background: '#222'
    }
});

Render.run(render);
const runner = Runner.create();
Runner.run(runner, engine);

// 6. Control de teclado
const keys = {};
document.addEventListener('keydown', e => keys[e.code] = true);
document.addEventListener('keyup', e => keys[e.code] = false);

let syncTick = 0; // Para optimizar el envío de datos
let lastSentKeys = ""; // Para evitar enviar datos duplicados por la red

// --- LÓGICA DE JOYSTICK PARA CELULAR ---
let touchInputs = { left: false, right: false, jump: false };
const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

if (isMobile) {
    document.getElementById('mobile-controls').style.display = 'flex';
    const base = document.getElementById('joystick-base');
    const knob = document.getElementById('joystick-knob');
    const jumpBtn = document.getElementById('jump-btn');

    const handleJoystick = (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        const rect = base.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        let dx = touch.clientX - centerX;
        let dy = touch.clientY - centerY;
        const dist = Math.sqrt(dx*dx + dy*dy);
        const maxDist = 40;

        if (dist > maxDist) {
            dx *= maxDist / dist;
            dy *= maxDist / dist;
        }

        knob.style.transform = `translate(${dx}px, ${dy}px)`;
        touchInputs.left = dx < -15;
        touchInputs.right = dx > 15;
    };

    base.addEventListener('touchstart', handleJoystick);
    base.addEventListener('touchmove', handleJoystick);
    base.addEventListener('touchend', () => { knob.style.transform = 'translate(0,0)'; touchInputs.left = false; touchInputs.right = false; });
    jumpBtn.addEventListener('touchstart', (e) => { e.preventDefault(); touchInputs.jump = true; });
    jumpBtn.addEventListener('touchend', (e) => { e.preventDefault(); touchInputs.jump = false; });
}

function updateClientWorld(data) {
    // El cliente mueve sus círculos según lo que dice el host
    Matter.Body.setPosition(player1, { x: data.p1.x, y: data.p1.y });
    Matter.Body.setAngle(player1, data.r1);
    Matter.Body.setPosition(player2, { x: data.p2.x, y: data.p2.y });
    Matter.Body.setAngle(player2, data.r2);
}

Matter.Events.on(engine, 'beforeUpdate', () => {
    const walkSpeed = 5.5; 
    const jumpPower = -13;

    if (isHost) {
        // --- CONTROL JUGADOR 1 (ROJO) ---
        // En el Host, Rojo se mueve con WASD
        let p1vx = 0;
        if (keys['KeyA']) p1vx = -walkSpeed;
        if (keys['KeyD']) p1vx = walkSpeed;
        Matter.Body.setVelocity(player1, { x: p1vx, y: player1.velocity.y });
        
        if (keys['KeyW'] && Math.abs(player1.velocity.y) < 0.1) {
            Matter.Body.setVelocity(player1, { x: player1.velocity.x, y: jumpPower });
        }

        // --- CONTROL JUGADOR 2 (AZUL) ---
        // El Host lo mueve con sus Flechas O con lo que mande el Cliente
        let p2vx = 0;
        // Combinamos entrada remota y local (flechas) para el azul
        const left = (remoteKeys.left === true) || (keys['ArrowLeft'] === true);
        const right = (remoteKeys.right === true) || (keys['ArrowRight'] === true);
        const jump = (remoteKeys.jump === true) || (keys['ArrowUp'] === true);

        if (left) p2vx = -walkSpeed;
        if (right) p2vx = walkSpeed;
        Matter.Body.setVelocity(player2, { x: p2vx, y: player2.velocity.y });
        
        if (jump && Math.abs(player2.velocity.y) < 0.1) {
            Matter.Body.setVelocity(player2, { x: player2.velocity.x, y: jumpPower });
        }

        // Enviamos posiciones al cliente cada 2 frames (30fps) para no saturar la red
        syncTick++;
        if (conn && conn.open && syncTick % 2 === 0) {
            conn.send({
                p1: { x: player1.position.x, y: player1.position.y },
                r1: player1.angle,
                p2: { x: player2.position.x, y: player2.position.y },
                r2: player2.angle
            });
        }
    } else if (conn && conn.open) {
        // El Cliente envía el estado de sus teclas al Host
        // Usamos nombres cortos (l, r, j) para que el paquete sea lo más pequeño posible
        const currentKeys = {
            l: !!(keys['ArrowLeft'] || keys['KeyA'] || touchInputs.left),
            r: !!(keys['ArrowRight'] || keys['KeyD'] || touchInputs.right),
            j: !!(keys['ArrowUp'] || keys['KeyW'] || keys['Space'] || touchInputs.jump)
        };
        
        const keysStr = JSON.stringify(currentKeys);
        if (keysStr !== lastSentKeys) {
            conn.send(currentKeys);
            lastSentKeys = keysStr;
        }
    }
});

// Mouse para interactuar con el mundo
const mouse = Mouse.create(render.canvas);
const mouseConstraint = MouseConstraint.create(engine, {
    mouse: mouse,
    constraint: { stiffness: 0.2, render: { visible: false } }
});
Composite.add(world, mouseConstraint);

// Ajustar al redimensionar ventana
window.addEventListener('resize', () => {
    // Mantenemos el tamaño fijo para garantizar sincronización visual perfecta
});