/**
 * NEON AIR SYNTH — Core Engine
 * Integración de MediaPipe Hands + Tone.js + Canvas Neon Rendering + Shape Recognition
 */

// ==========================================
// 1. CONFIGURACIÓN Y ESTADO GLOBAL
// ==========================================
const state = {
  isRunning: false,
  isMuted: false,
  bpm: 100,
  activeColor: '#00ffcc',
  activeScale: 'pentatonicMinor',
  
  // Dibujo y Trazos
  strokes: [], // Array de arrays de puntos {x, y, color}
  currentStroke: null,
  
  // Playhead (Línea de escaneo temporal)
  playheadX: 0,
  lastFrameTime: performance.now(),
  
  // Hand tracking
  handDetected: false,
  isPinching: false,
  pinchPos: { x: 0, y: 0 },
  prevPinchPos: { x: 0, y: 0 },
  openHandTimer: 0, // Para limpiar pantalla
  lastTriggeredSegments: new Set(),
  
  // Efectos visuales
  particles: [],
  glowBeacons: [],
  
  // Easter Eggs Desbloqueados
  easterEggs: {
    triangle: false,
    square: false,
    star: false
  },
  activeSecretMelody: null
};

// Escalas Musicales Cuantizadas (Mapeo de eje Y)
const SCALES = {
  pentatonicMinor: ['C2', 'Eb2', 'F2', 'G2', 'Bb2', 'C3', 'Eb3', 'F3', 'G3', 'Bb3', 'C4', 'Eb4', 'F4', 'G4', 'Bb4', 'C5'],
  pentatonicMajor: ['C2', 'D2', 'E2', 'G2', 'A2', 'C3', 'D3', 'E3', 'G3', 'A3', 'C4', 'D4', 'E4', 'G4', 'A4', 'C5'],
  hirajoshi:       ['C2', 'Db2', 'F2', 'G2', 'Ab2', 'C3', 'Db3', 'F3', 'G3', 'Ab3', 'C4', 'Db4', 'F4', 'G4', 'Ab4', 'C5'],
  synthwave:       ['F2', 'Ab2', 'Bb2', 'C3', 'Eb3', 'F3', 'Ab3', 'Bb3', 'C4', 'Eb4', 'F4', 'Ab4', 'C5', 'Eb5', 'F5', 'G5']
};

// ==========================================
// 2. MOTOR DE AUDIO (TONE.JS)
// ==========================================
let synth, secretSynth, masterFilter, masterReverb, masterDelay;

async function initAudio() {
  await Tone.start();
  
  // Efectos Espaciales
  masterFilter = new Tone.Filter({
    frequency: 3200,
    type: 'lowpass',
    rolloff: -24
  });

  masterReverb = new Tone.Reverb({
    decay: 3.2,
    preDelay: 0.05,
    wet: 0.38
  });
  await masterReverb.generate();

  masterDelay = new Tone.FeedbackDelay({
    delayTime: '8n.',
    feedback: 0.28,
    wet: 0.22
  });

  // Sintetizador Principal (Sonido Neon PolySynth cálido)
  synth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'fatsawtooth', count: 3, spread: 25 },
    envelope: {
      attack: 0.02,
      decay: 0.25,
      sustain: 0.2,
      release: 0.8
    }
  }).chain(masterFilter, masterDelay, masterReverb, Tone.Destination);
  synth.volume.value = -6;

  // Sintetizador para Melodías Ocultas
  secretSynth = new Tone.PolySynth(Tone.AMSynth, {
    harmonicity: 2.5,
    oscillator: { type: 'sine' },
    envelope: { attack: 0.04, decay: 0.3, sustain: 0.3, release: 1.2 },
    modulation: { type: 'square' },
    modulationEnvelope: { attack: 0.1, decay: 0.2, sustain: 0.2, release: 0.5 }
  }).chain(masterDelay, masterReverb, Tone.Destination);
  secretSynth.volume.value = -3;
}

function playNoteAtY(yNormalized) {
  if (state.isMuted || !synth) return;
  const currentNotes = SCALES[state.activeScale];
  const index = Math.floor((1 - Math.max(0, Math.min(1, yNormalized))) * currentNotes.length);
  const clampedIndex = Math.max(0, Math.min(currentNotes.length - 1, index));
  const note = currentNotes[clampedIndex];

  try {
    synth.triggerAttackRelease(note, '8n');
  } catch (e) {
    // Protección contra trigger saturado
  }

  // Resaltar nota en la escalera del HUD
  highlightLadderNote(clampedIndex);
}

// 3 MELODÍAS SECRETAS / EASTER EGGS
function triggerEasterEggMelody(type) {
  if (!secretSynth) return;
  state.activeSecretMelody = type;

  const now = Tone.now();
  let pattern = [];
  let title = '';
  let desc = '';

  if (type === 'triangle') {
    title = '🔺 PRISMA CELESTIAL';
    desc = 'Arpegio etéreo ascendente en Modo Lidio activado';
    pattern = [
      { time: 0, note: 'F3' }, { time: 0.2, note: 'A3' }, { time: 0.4, note: 'C4' }, 
      { time: 0.6, note: 'E4' }, { time: 0.8, note: 'G4' }, { time: 1.0, note: 'C5' },
      { time: 1.2, note: 'G4' }, { time: 1.4, note: 'E4' }
    ];
  } else if (type === 'square') {
    title = '🟩 CYBER GROOVE 8-BIT';
    desc = 'Bajo rítmico funky con sintetizador analógico';
    pattern = [
      { time: 0, note: 'C2' }, { time: 0.18, note: 'C2' }, { time: 0.36, note: 'Eb2' },
      { time: 0.54, note: 'F2' }, { time: 0.72, note: 'G2' }, { time: 0.9, note: 'Bb2' },
      { time: 1.08, note: 'C3' }, { time: 1.26, note: 'G2' }, { time: 1.44, note: 'Eb2' }
    ];
  } else if (type === 'star') {
    title = '⭐ SINFONÍA ESTELAR';
    desc = 'Campanas cósmicas y glissando galáctico';
    pattern = [
      { time: 0, note: 'C4' }, { time: 0.15, note: 'G4' }, { time: 0.3, note: 'C5' },
      { time: 0.45, note: 'E5' }, { time: 0.6, note: 'B5' }, { time: 0.75, note: 'C6' },
      { time: 0.95, note: 'G5' }, { time: 1.15, note: 'E6' }, { time: 1.35, note: 'C6' }
    ];
  }

  // Programar las notas
  pattern.forEach(step => {
    secretSynth.triggerAttackRelease(step.note, '16n', now + step.time);
  });

  // Notificación en pantalla y actualización de insignia
  showEasterEggBanner(title, desc);
  unlockSecretBadge(type);

  setTimeout(() => {
    state.activeSecretMelody = null;
  }, 2000);
}

// ==========================================
// 3. RECONOCEDOR GEOMÉTRICO DE FORMAS
// (Detecta Triángulo, Cuadrado y Estrella)
// ==========================================
function analyzeShape(points) {
  if (!points || points.length < 15) return null;

  // 1. Centroide y Bounding Box
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  let sumX = 0, sumY = 0;
  
  points.forEach(p => {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
    sumX += p.x;
    sumY += p.y;
  });

  const width = maxX - minX;
  const height = maxY - minY;
  if (width < 50 || height < 50) return null; // Muy pequeño

  const cx = sumX / points.length;
  const cy = sumY / points.length;

  // Verificar si el trazo es cerrado (distancia inicial vs final)
  const startP = points[0];
  const endP = points[points.length - 1];
  const closingDist = Math.hypot(startP.x - endP.x, startP.y - endP.y);
  const diag = Math.hypot(width, height);
  const isClosed = (closingDist / diag) < 0.45;

  // 2. Muestreo radial de distancias desde el centroide (Firma Radial)
  // Permite detectar los picos (esquinas o puntas) independientemente de la rotación
  const samples = 36;
  const radialBins = new Array(samples).fill(0);
  const binCounts = new Array(samples).fill(0);

  points.forEach(p => {
    let angle = Math.atan2(p.y - cy, p.x - cx); // -PI a PI
    if (angle < 0) angle += Math.PI * 2;
    const bin = Math.floor((angle / (Math.PI * 2)) * samples) % samples;
    const dist = Math.hypot(p.x - cx, p.y - cy);
    if (dist > radialBins[bin]) radialBins[bin] = dist;
    binCounts[bin]++;
  });

  // Suavizar perfil radial para filtrar ruido de la mano
  const smoothed = [];
  for (let i = 0; i < samples; i++) {
    const prev = radialBins[(i - 1 + samples) % samples];
    const curr = radialBins[i];
    const next = radialBins[(i + 1) % samples];
    smoothed.push((prev + curr * 2 + next) / 4);
  }

  // Contar picos locales significativos
  let peaks = 0;
  const avgRadius = smoothed.reduce((a, b) => a + b, 0) / samples;
  
  for (let i = 0; i < samples; i++) {
    const prev = smoothed[(i - 1 + samples) % samples];
    const curr = smoothed[i];
    const next = smoothed[(i + 1) % samples];
    if (curr > prev && curr > next && curr > avgRadius * 1.15) {
      peaks++;
    }
  }

  // 3. Clasificación
  // Triángulo: ~3 picos prominentes
  if (peaks === 3 && isClosed) return 'triangle';

  // Cuadrado: ~4 picos y relación de aspecto cercana a 1:1
  const aspect = width / height;
  if (peaks === 4 && isClosed && aspect > 0.65 && aspect < 1.45) return 'square';

  // Estrella: 5 picos prominentes
  if (peaks === 5) return 'star';

  return null;
}

// ==========================================
// 4. CANVAS Y RENDERIZADO VISUAL
// ==========================================
const canvas = document.getElementById('synth-canvas');
const ctx = canvas.getContext('2d');
const videoElement = document.getElementById('webcam');

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  updateNotesLadder();
}
window.addEventListener('resize', resizeCanvas);

// Sistema de Partículas para colisiones de neón
class NeonParticle {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    this.color = color;
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 4 + 1.5;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.life = 1.0;
    this.decay = Math.random() * 0.03 + 0.02;
    this.size = Math.random() * 3 + 2;
  }
  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.life -= this.decay;
  }
  draw(ctx) {
    if (this.life <= 0) return;
    ctx.save();
    ctx.globalAlpha = this.life;
    ctx.shadowBlur = 10;
    ctx.shadowColor = this.color;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function spawnSparks(x, y, color) {
  for (let i = 0; i < 12; i++) {
    state.particles.push(new NeonParticle(x, y, color));
  }
}

// Dibuja la cuadrícula sutil estilo Cyberpunk / DAW
function drawCyberGrid() {
  ctx.save();
  ctx.strokeStyle = 'rgba(0, 255, 204, 0.05)';
  ctx.lineWidth = 1;

  // Líneas verticales (compases / beats)
  const steps = 16;
  for (let i = 1; i < steps; i++) {
    const x = (canvas.width / steps) * i;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }

  // Líneas horizontales (alturas de nota)
  const noteLines = SCALES[state.activeScale].length;
  for (let i = 1; i < noteLines; i++) {
    const y = (canvas.height / noteLines) * i;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
  ctx.restore();
}

// Dibuja los trazos con resplandor neón multicapa
function drawNeonStroke(points, color, isPulsing = false) {
  if (points.length < 2) return;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Capa 1: Resplandor Exterior Suave
  ctx.shadowBlur = isPulsing ? 35 : 22;
  ctx.shadowColor = color;
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.4;
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.stroke();

  // Capa 2: Resplandor Medio
  ctx.globalAlpha = 0.8;
  ctx.lineWidth = 6;
  ctx.stroke();

  // Capa 3: Núcleo Brillante (Blanco casi puro)
  ctx.shadowBlur = 8;
  ctx.shadowColor = '#ffffff';
  ctx.strokeStyle = '#ffffff';
  ctx.globalAlpha = 1.0;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.restore();
}

// Dibuja el Escáner Vertical (Playhead Láser)
function drawPlayhead(x) {
  ctx.save();
  
  // Resplandor del rayo láser
  const grad = ctx.createLinearGradient(x - 10, 0, x + 10, 0);
  grad.addColorStop(0, 'rgba(255, 0, 127, 0)');
  grad.addColorStop(0.5, 'rgba(255, 0, 127, 0.7)');
  grad.addColorStop(1, 'rgba(255, 0, 127, 0)');

  ctx.fillStyle = grad;
  ctx.fillRect(x - 8, 0, 16, canvas.height);

  // Línea central ultra brillante
  ctx.shadowBlur = 15;
  ctx.shadowColor = '#ff007f';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, canvas.height);
  ctx.stroke();

  ctx.restore();
}

// Cursor indicador en la punta de los dedos
function drawHandCursor(x, y, isPinching) {
  ctx.save();
  ctx.shadowBlur = isPinching ? 25 : 12;
  ctx.shadowColor = state.activeColor;
  
  // Círculo exterior
  ctx.strokeStyle = state.activeColor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, isPinching ? 14 : 20, 0, Math.PI * 2);
  ctx.stroke();

  // Centro
  ctx.fillStyle = isPinching ? '#ffffff' : state.activeColor;
  ctx.beginPath();
  ctx.arc(x, y, isPinching ? 6 : 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// Bucle principal de Render y Detección de Colisiones
function renderLoop(timestamp) {
  const dt = (timestamp - state.lastFrameTime) / 1000;
  state.lastFrameTime = timestamp;

  // 1. Limpiar canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 2. Dibujar feed de cámara espejado con tinte cinematográfico
  if (videoElement.readyState >= 2) {
    ctx.save();
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.filter = 'brightness(0.35) contrast(1.25) saturate(1.2)';
    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
    ctx.restore();
  }

  // 3. Cuadrícula Cyberpunk de fondo
  drawCyberGrid();

  // 4. Actualizar y dibujar el Escáner (Playhead)
  // Velocidad calculada según el BPM (1 loop = 4 compases de 4/4)
  const loopDurationSeconds = (60 / state.bpm) * 4;
  const pixelsPerSecond = canvas.width / loopDurationSeconds;
  const oldPlayheadX = state.playheadX;
  state.playheadX = (state.playheadX + pixelsPerSecond * dt) % canvas.width;

  drawPlayhead(state.playheadX);

  // 5. Detección de Colisiones (Playhead vs Trazos)
  const currentSegmentsTriggered = new Set();
  
  state.strokes.forEach((stroke, strokeIdx) => {
    drawNeonStroke(stroke.points, stroke.color, stroke.isSecret);

    // Revisar segmentos
    for (let i = 0; i < stroke.points.length - 1; i++) {
      const p1 = stroke.points[i];
      const p2 = stroke.points[i + 1];
      const segId = `${strokeIdx}_${i}`;

      const minX = Math.min(p1.x, p2.x);
      const maxX = Math.max(p1.x, p2.x);

      // Verificamos si el rayo acaba de cruzar este segmento en este fotograma
      const crossed = (oldPlayheadX <= minX && state.playheadX >= minX) ||
                      (p1.x <= state.playheadX && p2.x >= state.playheadX) ||
                      (p2.x <= state.playheadX && p1.x >= state.playheadX);

      if (crossed && Math.abs(p2.x - p1.x) > 0.001) {
        currentSegmentsTriggered.add(segId);

        if (!state.lastTriggeredSegments.has(segId)) {
          // Interpolar Y exacto en la posición del playhead
          const t = (state.playheadX - p1.x) / (p2.x - p1.x);
          const hitY = p1.y + t * (p2.y - p1.y);

          // Disparar nota sonora
          playNoteAtY(hitY / canvas.height);

          // Chispas de impacto visual
          spawnSparks(state.playheadX, hitY, stroke.color);
        }
      }
    }
  });

  state.lastTriggeredSegments = currentSegmentsTriggered;

  // 6. Dibujar trazo en curso
  if (state.currentStroke && state.currentStroke.points.length > 0) {
    drawNeonStroke(state.currentStroke.points, state.currentStroke.color);
  }

  // 7. Partículas activas
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.update();
    p.draw(ctx);
    if (p.life <= 0) state.particles.splice(i, 1);
  }

  // 8. Cursor de mano
  if (state.handDetected) {
    drawHandCursor(state.pinchPos.x, state.pinchPos.y, state.isPinching);
  }

  requestAnimationFrame(renderLoop);
}

// ==========================================
// 5. MEDIAPIPE HANDS TRACKING
// ==========================================
let hands, camera;

function onHandResults(results) {
  if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
    state.handDetected = false;
    updateGestureStatus('Buscando mano...', 'Muestra tu mano frente a la cámara');
    state.openHandTimer = 0;
    hideWipeProgress();
    return;
  }

  state.handDetected = true;
  const landmarks = results.multiHandLandmarks[0];

  // MediaPipe entrega coordenadas normalizadas [0, 1]
  // La cámara está espejada horizontalmente (1 - x)
  const indexTip = {
    x: (1 - landmarks[8].x) * canvas.width,
    y: landmarks[8].y * canvas.height
  };
  const thumbTip = {
    x: (1 - landmarks[4].x) * canvas.width,
    y: landmarks[4].y * canvas.height
  };
  const wrist = {
    x: (1 - landmarks[0].x) * canvas.width,
    y: landmarks[0].y * canvas.height
  };

  // Posición del cursor en el punto medio entre índice y pulgar
  state.pinchPos = {
    x: (indexTip.x + thumbTip.x) / 2,
    y: (indexTip.y + thumbTip.y) / 2
  };

  // 1. Detección de Gesto PINCH (Pellizco = Dibujar)
  const pinchDist = Math.hypot(indexTip.x - thumbTip.x, indexTip.y - thumbTip.y);
  const isPinchActive = pinchDist < 48;

  if (isPinchActive) {
    updateGestureStatus('PINTANDO CON NEÓN', 'Dibuja trazos o figuras en el aire', 'pencil');
    if (!state.isPinching) {
      // Inicia nuevo trazo
      state.isPinching = true;
      state.currentStroke = {
        color: state.activeColor,
        points: [{ x: state.pinchPos.x, y: state.pinchPos.y }],
        isSecret: false
      };
    } else {
      // Continuar agregando puntos con filtrado mínimo de distancia
      const lastP = state.currentStroke.points[state.currentStroke.points.length - 1];
      const distFromLast = Math.hypot(state.pinchPos.x - lastP.x, state.pinchPos.y - lastP.y);
      if (distFromLast > 4) {
        state.currentStroke.points.push({ x: state.pinchPos.x, y: state.pinchPos.y });
      }
    }
  } else {
    // Soltó el pellizco
    if (state.isPinching && state.currentStroke) {
      state.isPinching = false;
      if (state.currentStroke.points.length > 5) {
        // Verificar si completó un Easter Egg (Forma geométrica)
        const recognizedShape = analyzeShape(state.currentStroke.points);
        if (recognizedShape) {
          state.currentStroke.isSecret = true;
          state.currentStroke.color = '#ffe600'; // Dorado estelar
          triggerEasterEggMelody(recognizedShape);
        }
        state.strokes.push(state.currentStroke);
      }
      state.currentStroke = null;
    }
  }

  // 2. Detección de Gesto PALMA ABIERTA (Limpiar pantalla)
  // Comprobar si los 4 dedos superiores están estirados lejos de la muñeca
  const middleDist = Math.hypot((1 - landmarks[12].x) * canvas.width - wrist.x, landmarks[12].y * canvas.height - wrist.y);
  const ringDist = Math.hypot((1 - landmarks[16].x) * canvas.width - wrist.x, landmarks[16].y * canvas.height - wrist.y);
  const pinkyDist = Math.hypot((1 - landmarks[20].x) * canvas.width - wrist.x, landmarks[20].y * canvas.height - wrist.y);
  const handSpan = Math.hypot(indexTip.x - wrist.x, indexTip.y - wrist.y);

  const isOpenHand = !isPinchActive && (middleDist > 140) && (ringDist > 130) && (pinkyDist > 110) && (handSpan > 130);

  if (isOpenHand && state.strokes.length > 0) {
    state.openHandTimer += 0.035;
    updateGestureStatus('PALMA ABIERTA', 'Mantén 1 seg para borrar', 'trash-2');
    showWipeProgress(Math.min(1, state.openHandTimer));

    if (state.openHandTimer >= 1.0) {
      // Disolver pantalla con explosión
      state.strokes.forEach(s => {
        s.points.forEach(p => spawnSparks(p.x, p.y, s.color));
      });
      state.strokes = [];
      state.openHandTimer = 0;
      hideWipeProgress();
    }
  } else {
    state.openHandTimer = 0;
    hideWipeProgress();
    if (!isPinchActive) {
      updateGestureStatus('MANO DETECTADA', 'Pellizca índice y pulgar para pintar', 'hand');
    }
  }

  // 3. Si hay una segunda mano: modular Filtro con su altura Y (Expresión avanzada)
  if (results.multiHandLandmarks.length > 1 && masterFilter) {
    const hand2 = results.multiHandLandmarks[1];
    const hand2Y = hand2[8].y; // Altura del índice de la mano 2
    const cutoff = 400 + (1 - hand2Y) * 6000;
    masterFilter.frequency.rampTo(cutoff, 0.05);
  }
}

async function startMediaPipe() {
  hands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
  });

  hands.setOptions({
    maxNumHands: 2,
    modelComplexity: 1,
    minDetectionConfidence: 0.6,
    minTrackingConfidence: 0.6
  });

  hands.onResults(onHandResults);

  camera = new Camera(videoElement, {
    onFrame: async () => {
      await hands.send({ image: videoElement });
    },
    width: 1280,
    height: 720
  });

  await camera.start();
}

// Soporte táctil / Mouse de respaldo (para probar también sin webcam)
function setupMouseFallbacks() {
  let isMouseDown = false;

  canvas.addEventListener('mousedown', (e) => {
    isMouseDown = true;
    state.currentStroke = {
      color: state.activeColor,
      points: [{ x: e.clientX, y: e.clientY }],
      isSecret: false
    };
  });

  canvas.addEventListener('mousemove', (e) => {
    if (!isMouseDown || !state.currentStroke) return;
    state.currentStroke.points.push({ x: e.clientX, y: e.clientY });
  });

  window.addEventListener('mouseup', () => {
    if (!isMouseDown) return;
    isMouseDown = false;
    if (state.currentStroke && state.currentStroke.points.length > 5) {
      const shape = analyzeShape(state.currentStroke.points);
      if (shape) {
        state.currentStroke.isSecret = true;
        state.currentStroke.color = '#ffe600';
        triggerEasterEggMelody(shape);
      }
      state.strokes.push(state.currentStroke);
    }
    state.currentStroke = null;
  });
}

// ==========================================
// 6. ACTUALIZACIONES DE UI Y HUD
// ==========================================
function updateNotesLadder() {
  const ladder = document.getElementById('notes-ladder');
  ladder.innerHTML = '';
  const notes = SCALES[state.activeScale];
  // De más agudo arriba a más grave abajo
  for (let i = notes.length - 1; i >= 0; i--) {
    const el = document.createElement('div');
    el.className = 'ladder-note';
    el.id = `ladder-note-${i}`;
    el.textContent = notes[i];
    ladder.appendChild(el);
  }
}

function highlightLadderNote(index) {
  const el = document.getElementById(`ladder-note-${index}`);
  if (el) {
    el.classList.add('active');
    setTimeout(() => el.classList.remove('active'), 250);
  }
}

function updateGestureStatus(title, sub, icon = 'hand') {
  const t = document.getElementById('gesture-title');
  const s = document.getElementById('gesture-sub');
  if (t) t.textContent = title;
  if (s) s.textContent = sub;
}

function showWipeProgress(progress) {
  const container = document.getElementById('wipe-progress-container');
  const bar = document.getElementById('wipe-bar-fill');
  if (container && bar) {
    container.classList.remove('hidden');
    bar.style.width = `${progress * 100}%`;
  }
}

function hideWipeProgress() {
  const container = document.getElementById('wipe-progress-container');
  if (container) container.classList.add('hidden');
}

function showEasterEggBanner(title, desc) {
  const banner = document.getElementById('easter-egg-banner');
  const t = document.getElementById('egg-title');
  const d = document.getElementById('egg-desc');
  t.textContent = title;
  d.textContent = desc;
  banner.classList.remove('hidden');

  setTimeout(() => {
    banner.classList.add('hidden');
  }, 3500);
}

function unlockSecretBadge(type) {
  state.easterEggs[type] = true;
  const badge = document.getElementById(`badge-${type}`);
  if (badge) {
    badge.classList.add('unlocked', 'playing');
    setTimeout(() => badge.classList.remove('playing'), 2500);
  }
}

// ==========================================
// 7. LISTENERS DE CONTROLES
// ==========================================
document.getElementById('btn-start').addEventListener('click', async () => {
  const statusEl = document.getElementById('camera-status');
  statusEl.textContent = 'Iniciando sintetizador y cámara...';

  try {
    await initAudio();
    await startMediaPipe();
    document.getElementById('start-overlay').classList.add('hidden');
    state.isRunning = true;
    requestAnimationFrame(renderLoop);
  } catch (err) {
    console.error(err);
    statusEl.textContent = 'Error al acceder a la cámara. Revisa los permisos.';
  }
});

// Escala
document.getElementById('scale-selector').addEventListener('change', (e) => {
  state.activeScale = e.target.value;
  updateNotesLadder();
});

// BPM
const bpmSlider = document.getElementById('bpm-slider');
const bpmVal = document.getElementById('bpm-val');
bpmSlider.addEventListener('input', (e) => {
  state.bpm = parseInt(e.target.value);
  bpmVal.textContent = state.bpm;
});

// Paleta de Color
document.querySelectorAll('.color-dot').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.color-dot').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.activeColor = btn.dataset.color;
  });
});

// Limpiar trazos
document.getElementById('btn-clear').addEventListener('click', () => {
  state.strokes.forEach(s => {
    s.points.forEach(p => spawnSparks(p.x, p.y, s.color));
  });
  state.strokes = [];
});

// Silenciar / Activar
const btnSound = document.getElementById('btn-toggle-sound');
btnSound.addEventListener('click', () => {
  state.isMuted = !state.isMuted;
  btnSound.innerHTML = state.isMuted ? '<i data-lucide="volume-x"></i>' : '<i data-lucide="volume-2"></i>';
  lucide.createIcons();
});

// Inicialización de arranque
window.addEventListener('DOMContentLoaded', () => {
  resizeCanvas();
  setupMouseFallbacks();
  if (window.lucide) lucide.createIcons();
});
