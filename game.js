const { Engine, Render, Runner, Bodies, Composite, Constraint, MouseConstraint, Mouse } = Matter;

const SUPABASE_URL = "https://xhtiquhbfvzvnntfptrh.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_s3fntuQStrIFj_fZrp6DNQ_Uu94hsYV"; // Debe empezar con eyJhbGci...
//const SUPABASE_ANON_KEY = "PEGÁ_AQUÍ_TU_LLAVE_ANON_REAL_DE_SUPABASE"; // Debe empezar con eyJhbGci...
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Creamos un canal para la comunicación en tiempo real (Broadcast)
const channel = supabaseClient.channel('game-room', {
    config: {
        broadcast: { self: false },
    },
});

channel.subscribe();

// Identificar quién es este jugador
const isPlayerA = confirm("¿Eres el Jugador Rojo (A)? (Cancelar para Azul/B)");
const role = isPlayerA ? 'playerA' : 'playerB';
console.log(`Jugando como: ${role}`);

// 1. Configuración del motor
const engine = Engine.create();
const world = engine.world;

// 2. Configuración del renderizado
const render = Render.create({
    element: document.body,
    engine: engine,
    options: {
        width: window.innerWidth,
        height: window.innerHeight,
        wireframes: false,
        background: '#1a1a1a'
    }
});

Render.run(render);
Runner.run(Runner.create(), engine);

// 3. Crear Personajes (Yarnys)
const playerA = Bodies.circle(300, 400, 20, { 
    friction: 0.5, 
    render: { fillStyle: '#ff4d4d' } 
});
const playerB = Bodies.circle(500, 400, 20, { 
    friction: 0.5, 
    render: { fillStyle: '#4d79ff' } 
});

// Variable para la cuerda
let rope = null;

function toggleRope(active, emit = true) {
    console.log(`Cuerda solicitada: ${active}. Estado actual: ${!!rope}`);
    
    // Primero eliminamos cualquier cuerda existente para evitar duplicados
    if (rope) {
        Composite.remove(world, rope);
        rope = null;
    }

    if (active) {
        rope = Constraint.create({
            bodyA: playerA,
            bodyB: playerB,
            length: 250,
            stiffness: 0.01,
            damping: 0.1,
            render: { strokeStyle: '#ffffff', lineWidth: 3, visible: true }
        });
        Composite.add(world, rope);
    }
    
    if (emit) {
        channel.send({
            type: 'broadcast',
            event: 'toggleRope',
            payload: { active }
        });
    }
}

// 5. Escenario (Suelo y plataformas)
const floor = Bodies.rectangle(window.innerWidth / 2, window.innerHeight - 20, window.innerWidth, 40, { isStatic: true });
const leftWall = Bodies.rectangle(10, window.innerHeight / 2, 20, window.innerHeight, { isStatic: true });
const rightWall = Bodies.rectangle(window.innerWidth - 10, window.innerHeight / 2, 20, window.innerHeight, { isStatic: true });
const platform = Bodies.rectangle(400, 450, 250, 20, { isStatic: true });

// 6. Objeto Cooperativo (Caja pesada)
const box = Bodies.rectangle(600, 500, 80, 80, { 
    mass: 5, 
    friction: 0.1,
    render: { fillStyle: '#f39c12' } // Color naranja para que coincida con tu descripción
});

Composite.add(world, [playerA, playerB, floor, leftWall, rightWall, platform, box]);

// 6. Controles básicos
const keys = {};
window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    // Activar/Desactivar cuerda con Espacio
    if (e.code === 'Space') {
        toggleRope(!rope);
    }
});
window.addEventListener('keyup', (e) => keys[e.code] = false);

// Recibir actualizaciones del otro jugador
channel.on('broadcast', { event: 'toggleRope' }, ({ payload }) => {
    toggleRope(payload.active, false);
});

channel.on('broadcast', { event: 'playerMove' }, ({ payload: data }) => {
    const target = (data.role === 'playerA') ? playerA : playerB;
    if (!target) return;

    Matter.Body.setPosition(target, data.position);
    Matter.Body.setVelocity(target, data.velocity);

    // Sincronización constante del estado de la cuerda
    // Si el otro jugador tiene la cuerda y yo no, la pongo. Si él no la tiene y yo sí, la quito.
    if (data.ropeActive === true && !rope) {
        toggleRope(true, false);
    } else if (data.ropeActive === false && rope) {
        toggleRope(false, false);
    }

    // Si recibimos datos de la caja (enviados por el Jugador A)
    if (data.box) {
        Matter.Body.setPosition(box, data.box.position);
        Matter.Body.setVelocity(box, data.box.velocity);
        Matter.Body.setAngle(box, data.box.angle);
        Matter.Body.setAngularVelocity(box, data.box.angularVelocity);
    }
});

Matter.Events.on(engine, 'beforeUpdate', () => {
    const speed = 0.005;
    let localPlayer = isPlayerA ? playerA : playerB;
    let moved = false;

    // Solo controlar el personaje asignado
    if (keys['ArrowLeft'] || keys['KeyA']) { Matter.Body.applyForce(localPlayer, localPlayer.position, { x: -speed, y: 0 }); moved = true; }
    if (keys['ArrowRight'] || keys['KeyD']) { Matter.Body.applyForce(localPlayer, localPlayer.position, { x: speed, y: 0 }); moved = true; }
    if (keys['ArrowUp'] || keys['KeyW']) { Matter.Body.applyForce(localPlayer, localPlayer.position, { x: 0, y: -speed * 2 }); moved = true; }

    // Detectar si el jugador local está tocando la caja
    const isTouchingBox = Matter.Collision.collides(localPlayer, box) !== null;

    // Enviar posición al servidor si nos movemos o periódicamente
    // Ahora AMBOS jugadores envían latidos constantes para que la soga no se desincronice
    if (moved || isTouchingBox || (engine.timing.timestamp % 100 < 20)) {
        const payload = {
            role: role,
            position: localPlayer.position,
            velocity: localPlayer.velocity,
            ropeActive: !!rope // Enviamos el estado actual para que el otro lo sepa siempre
        };

        // MEJORA DE AUTORIDAD:
        // 1. Si yo toco la caja, yo mando su posición (sea A o B).
        // 2. Si nadie la toca, el Jugador A (Master) solo manda la posición si la caja está quieta.
        const boxIsMoving = box.speed > 0.1;
        if (isTouchingBox || (isPlayerA && !boxIsMoving)) {
            payload.box = {
                position: box.position,
                velocity: box.velocity,
                angle: box.angle,
                angularVelocity: box.angularVelocity
            };
        }
        channel.send({
            type: 'broadcast',
            event: 'playerMove',
            payload: payload
        });
    }
});

// Ajustar al redimensionar ventana
window.addEventListener('resize', () => {
    render.canvas.width = window.innerWidth;
    render.canvas.height = window.innerHeight;
});