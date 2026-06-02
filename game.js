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
const peer = new Peer(generateRoomCode());
let conn;
let isHost = false;
const myIdDisplay = document.getElementById('my-id');
const statusDisplay = document.getElementById('status');

peer.on('open', (id) => {
    myIdDisplay.innerText = id;
    statusDisplay.innerText = "📡 Esperando a un compañero...";
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
    const peerId = document.getElementById('peer-id').value;
    isHost = false;
    setupConnection(peer.connect(peerId));
};

function setupConnection(connection) {
    conn = connection;
    conn.on('open', () => {
        statusDisplay.innerText = isHost ? "Eres el HOST (Rojo)" : "Conectado como CLIENTE (Azul)";
        if (!isHost) {
            // En el cliente, desactivamos la gravedad y hacemos los cuerpos estáticos 
            // para que no peleen contra las posiciones que envía el Host.
            console.log("Conectado como cliente. Desactivando física local.");
            engine.gravity.y = 0;
            Matter.Body.setStatic(player1, true);
            Matter.Body.setStatic(player2, true);
        }
    });

    conn.on('data', (data) => {
        if (isHost) {
            remoteKeys = data; // Host recibe teclas del cliente
        }
        else updateClientWorld(data); // Cliente recibe posiciones del host
    });
}

let remoteKeys = {};
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

function updateClientWorld(data) {
    // El cliente mueve sus círculos según lo que dice el host
    Matter.Body.setPosition(player1, { x: data.p1.x, y: data.p1.y });
    Matter.Body.setAngle(player1, data.r1);
    Matter.Body.setPosition(player2, { x: data.p2.x, y: data.p2.y });
    Matter.Body.setAngle(player2, data.r2);
}

Matter.Events.on(engine, 'beforeUpdate', () => {
    const walkSpeed = 6; // Un poco más de velocidad para mayor agilidad
    const jumpPower = -13;

    if (isHost) {
        // --- CONTROL JUGADOR 1 (ROJO) ---
        let p1vx = 0;
        if (keys['KeyA'] || keys['ArrowLeft']) p1vx = -walkSpeed;
        if (keys['KeyD'] || keys['ArrowRight']) p1vx = walkSpeed;
        Matter.Body.setVelocity(player1, { x: p1vx, y: player1.velocity.y });
        
        if ((keys['KeyW'] || keys['ArrowUp']) && Math.abs(player1.velocity.y) < 0.1) {
            Matter.Body.setVelocity(player1, { x: player1.velocity.x, y: jumpPower });
        }

        // --- CONTROL JUGADOR 2 (AZUL) ---
        // El Host lo mueve con lo que mande el Cliente (teclas remotas)
        let p2vx = 0;
        const left = remoteKeys && remoteKeys.left;
        const right = remoteKeys && remoteKeys.right;
        const jump = remoteKeys && remoteKeys.jump;

        if (left) p2vx = -walkSpeed;
        if (right) p2vx = walkSpeed;
        Matter.Body.setVelocity(player2, { x: p2vx, y: player2.velocity.y });
        
        if (jump && Math.abs(player2.velocity.y) < 0.1) {
            Matter.Body.setVelocity(player2, { x: player2.velocity.x, y: jumpPower });
        }

        // El Host envía las posiciones actualizadas al Cliente
        if (conn && conn.open) {
            conn.send({
                p1: { x: player1.position.x, y: player1.position.y },
                r1: player1.angle,
                p2: { x: player2.position.x, y: player2.position.y },
                r2: player2.angle
            });
        }
    } else if (conn && conn.open) {
        // El Cliente envía el estado de sus teclas al Host
        conn.send({
            left: !!(keys['ArrowLeft'] || keys['KeyA']),
            right: !!(keys['ArrowRight'] || keys['KeyD']),
            jump: !!(keys['ArrowUp'] || keys['KeyW'] || keys['Space'])
        });
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