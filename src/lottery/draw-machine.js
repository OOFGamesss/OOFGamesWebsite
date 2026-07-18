// Canvas lottery machine restyled after the Magnum draw machine: each pool
// sits in a clear upright drum rendered as a pseudo-3D container - balls
// drift front-to-back on a depth axis while a spinning three-bar rotor sits
// at mid-depth, so its thin bars only scoop and fling the balls that happen
// to be passing through the rotor's plane (gravity, wall, hub, bar and
// pairwise collisions are all depth-aware; back balls draw dimmer and
// behind the bars, and a weak pull toward the rotor plane keeps most of the
// pool in reach of the bars). The violet main drum holds balls 1-15, the
// smaller gold drum the 5 bonus balls. A drawn ball is first steered through
// the live tumble toward the gap at the bottom of its drum so the pick looks
// organic, then drops down a short chute and rolls leftward along a curved
// tray,
// queueing against the stop - the first draw rests lowest and later balls
// stack up the ramp. play() re-enacts a finished draw with suspense pacing,
// while reveal() extracts balls incrementally as the live in-game rolls
// stream in - each call queues only the balls not yet drawn, so the machine
// keeps agitating between rolls. The physics is pure theatre, the numbers
// are the in-game rolls; instant mode (reduced motion / old draws) parks
// everything immediately. Fresh pools start queued in glass feed pipes
// entering from the canvas edges above each drum and stream in through a
// top hatch when the draw begins.

const W = 900;
const H = 560;
const BALL_R = 19;
const GRAVITY = 640;
const JET_STRENGTH = 700;
const MAX_SPEED = 980;
const BAR_HALF = 5;
const HUB_R = 17;
const BAR_PLANE = 0.5;
const BAR_DEPTH_HALF = 0.36;
const DEPTH_MIN = 0.06;
const DEPTH_MAX = 0.94;
const PIPE_SPEED = 240;
const EXTRACT_SECONDS = 2.0;
const REVEAL_GAP_SECONDS = 2.1;
const SEGMENT_SHARES = [0.4, 0.18, 0.42];

const MAIN = {
  tint: 'violet',
  drum: { x: 260, y: 268, r: 138 },
  tray: { cx: 42, cy: 146, R: 380, xStop: 42, xEnd: 288 },
  pipe: { y: 40, side: 'left' },
  slotXs: [61, 101, 141, 181],
  label: 'MAIN DRAW',
  spin: { angle: 0.4, dir: 1 },
  intakeActive: false
};

const BONUS = {
  tint: 'gold',
  drum: { x: 730, y: 296, r: 86 },
  tray: { cx: 590, cy: 170, R: 330, xStop: 590, xEnd: 762 },
  pipe: { y: 150, side: 'right' },
  slotXs: [609],
  label: 'BONUS',
  spin: { angle: 1.7, dir: -1 },
  intakeActive: false
};

function tintColor(machine, alpha) {
  return machine.tint === 'gold'
    ? `rgba(255, 207, 77, ${alpha})`
    : `rgba(139, 92, 255, ${alpha})`;
}

function trayYAt(tray, x) {
  return tray.cy + Math.sqrt(tray.R ** 2 - (x - tray.cx) ** 2);
}

function gapHalfAngle(machine) {
  return Math.asin((BALL_R + 6) / machine.drum.r);
}

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
}

function easeOut(t) {
  return 1 - (1 - t) * (1 - t);
}

function containInWall(ball, drum, inner, bounce, damp) {
  const distance = Math.hypot(ball.x - drum.x, ball.y - drum.y);
  if (distance <= inner) return distance;
  const nx = (ball.x - drum.x) / distance;
  const ny = (ball.y - drum.y) / distance;
  ball.x = drum.x + nx * inner;
  ball.y = drum.y + ny * inner;
  const dot = ball.vx * nx + ball.vy * ny;
  if (dot > 0) {
    ball.vx -= bounce * dot * nx;
    ball.vy -= bounce * dot * ny;
    ball.vx *= damp;
    ball.vy *= damp;
  }
  return inner;
}

function makeBalls(count, machine, bonus) {
  const balls = [];
  const lead = machine.pipe.side === 'left' ? machine.drum.x - 30 : machine.drum.x + 30;
  const dir = machine.pipe.side === 'left' ? -1 : 1;
  for (let i = 1; i <= count; i += 1) {
    balls.push({
      n: i,
      bonus,
      x: lead + dir * (i - 1) * BALL_R * 2,
      y: machine.pipe.y,
      vx: 0,
      vy: 0,
      z: DEPTH_MIN + Math.random() * (DEPTH_MAX - DEPTH_MIN),
      vz: (Math.random() - 0.5) * 0.6,
      state: 'staged',
      pathT: 0,
      sx: 0,
      sy: 0,
      slotX: 0,
      slot: -1,
      pop: 0,
      rot: 0
    });
  }
  return balls;
}

function scatterInDrum(balls, machine) {
  const { drum } = machine;
  for (const ball of balls) {
    if (ball.state === 'parked') continue;
    const angle = Math.random() * Math.PI * 2;
    const distance = HUB_R + BALL_R + Math.random() * (drum.r - HUB_R - BALL_R * 2 - 8);
    ball.state = 'free';
    ball.x = drum.x + Math.cos(angle) * distance;
    ball.y = drum.y + Math.sin(angle) * distance;
    ball.vx = (Math.random() - 0.5) * 260;
    ball.vy = (Math.random() - 0.5) * 260;
  }
}

function updateIntake(machine, balls, dt) {
  if (!machine.intakeActive) return;
  const { drum, pipe } = machine;
  const inner = drum.r - BALL_R;
  const dir = pipe.side === 'left' ? 1 : -1;
  let remaining = false;
  for (const ball of balls) {
    if (ball.state === 'staged') {
      remaining = true;
      const step = dir * PIPE_SPEED * dt;
      ball.x += step;
      ball.rot += step / BALL_R;
      if ((dir > 0 && ball.x >= drum.x) || (dir < 0 && ball.x <= drum.x)) {
        ball.x = drum.x;
        ball.state = 'dropping';
        ball.vx = 0;
        ball.vy = 40;
      }
    } else if (ball.state === 'dropping') {
      remaining = true;
      ball.vy += GRAVITY * dt;
      ball.y += ball.vy * dt;
      if (Math.hypot(ball.x - drum.x, ball.y - drum.y) < inner - 2) {
        ball.state = 'free';
        ball.vx = (Math.random() - 0.5) * 220;
        ball.z = BAR_PLANE + (Math.random() - 0.5) * 0.6;
      }
    }
  }
  if (!remaining) machine.intakeActive = false;
}

function physicsStep(balls, machine, dt, agitation, omega) {
  const { drum } = machine;
  const inner = drum.r - BALL_R;
  const barTip = drum.r - 8;
  for (const ball of balls) {
    if (ball.state !== 'free' && ball.state !== 'capturing') continue;
    ball.vy += GRAVITY * dt;
    if (ball.state === 'capturing') {
      ball.vx += (drum.x - ball.x) * 9 * dt;
      ball.vy += (drum.y + inner - ball.y) * 9 * dt;
      ball.vx *= 1 - 2.2 * dt;
      ball.vy *= 1 - 2.2 * dt;
      ball.vz += (BAR_PLANE - ball.z) * 3 * dt;
    }
    const dy = ball.y - drum.y;
    if (ball.state === 'free' && agitation > 0 && dy > inner * 0.5 && Math.random() < agitation * dt * 0.25) {
      ball.vy -= JET_STRENGTH * (0.5 + Math.random() * 0.6);
      ball.vx += (Math.random() - 0.5) * 360;
    }
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    ball.rot += (ball.vx / BALL_R) * dt * 0.4;

    ball.vz += (Math.random() - 0.5) * 1.4 * dt;
    ball.vz += (BAR_PLANE - ball.z) * 1.0 * dt;
    ball.vz *= 1 - 0.6 * dt;
    ball.z += ball.vz * dt;
    if (ball.z < DEPTH_MIN) {
      ball.z = DEPTH_MIN;
      ball.vz = Math.abs(ball.vz) * 0.5;
    } else if (ball.z > DEPTH_MAX) {
      ball.z = DEPTH_MAX;
      ball.vz = -Math.abs(ball.vz) * 0.5;
    }

    const distance = containInWall(ball, drum, inner, 1.75, 0.92);

    if (distance < HUB_R + BALL_R && distance > 0.001) {
      const nx = (ball.x - drum.x) / distance;
      const ny = (ball.y - drum.y) / distance;
      const overlap = HUB_R + BALL_R - distance;
      ball.x += nx * overlap * 0.5;
      ball.y += ny * overlap * 0.5;
      const dot = ball.vx * nx + ball.vy * ny;
      if (dot < 0) {
        ball.vx -= 1.4 * dot * nx;
        ball.vy -= 1.4 * dot * ny;
      }
    }

    const onBarPlane = ball.state === 'free' && Math.abs(ball.z - BAR_PLANE) < BAR_DEPTH_HALF;
    for (let k = 0; onBarPlane && k < 3; k += 1) {
      const a = machine.spin.angle + (k * Math.PI * 2) / 3;
      const ux = Math.cos(a);
      const uy = Math.sin(a);
      const px = ball.x - drum.x;
      const py = ball.y - drum.y;
      const proj = Math.min(barTip, Math.max(HUB_R, px * ux + py * uy));
      const cx = drum.x + ux * proj;
      const cy = drum.y + uy * proj;
      const dx = ball.x - cx;
      const dyb = ball.y - cy;
      const d = Math.hypot(dx, dyb) || 0.001;
      if (d < BALL_R + BAR_HALF) {
        const nx = dx / d;
        const ny = dyb / d;
        const overlap = BALL_R + BAR_HALF - d;
        const push = Math.min(overlap * 0.5, 4);
        ball.x += nx * push;
        ball.y += ny * push;
        const bvx = -Math.sin(a) * omega * proj;
        const bvy = Math.cos(a) * omega * proj;
        const rel = (ball.vx - bvx) * nx + (ball.vy - bvy) * ny;
        if (rel < 0) {
          const e = rel < -240 ? 0.3 : 0;
          const impulse = Math.max(rel, -460);
          ball.vx -= (1 + e) * impulse * nx;
          ball.vy -= (1 + e) * impulse * ny;
          ball.vz += (Math.random() - 0.5) * 0.6;
        }
        ball.vx += (bvx - ball.vx) * 0.06;
        ball.vy += (bvy - ball.vy) * 0.06;
      }
    }
    if (onBarPlane) containInWall(ball, drum, inner, 1.2, 1);

    const speed = Math.hypot(ball.vx, ball.vy);
    if (speed > MAX_SPEED) {
      ball.vx *= MAX_SPEED / speed;
      ball.vy *= MAX_SPEED / speed;
    }
  }

  const free = balls.filter((ball) => ball.state === 'free' || ball.state === 'capturing');
  for (let i = 0; i < free.length; i += 1) {
    for (let j = i + 1; j < free.length; j += 1) {
      const a = free[i];
      const b = free[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dz = b.z - a.z;
      const distance = Math.hypot(dx, dy) || 0.001;
      if (distance < BALL_R * 2 && Math.abs(dz) < 0.45) {
        const nx = dx / distance;
        const ny = dy / distance;
        const overlap = BALL_R * 2 - distance;
        a.x -= nx * overlap * 0.5;
        a.y -= ny * overlap * 0.5;
        b.x += nx * overlap * 0.5;
        b.y += ny * overlap * 0.5;
        a.vz -= dz * 0.02;
        b.vz += dz * 0.02;
        const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (rel < 0) {
          a.vx += rel * nx * 0.9;
          a.vy += rel * ny * 0.9;
          b.vx -= rel * nx * 0.9;
          b.vy -= rel * ny * 0.9;
        }
      }
    }
  }
}

function extractionPoint(machine, ball, t) {
  const { drum, tray } = machine;
  const exitY = drum.y + drum.r - BALL_R;
  const entryY = trayYAt(tray, drum.x) - BALL_R;
  const [s0, s1, s2] = SEGMENT_SHARES;
  if (t <= s0) {
    const e = easeInOut(t / s0);
    return { x: ball.sx + (drum.x - ball.sx) * e, y: ball.sy + (exitY - ball.sy) * e, seg: 0 };
  }
  if (t <= s0 + s1) {
    const local = (t - s0) / s1;
    return { x: drum.x, y: exitY + (entryY - exitY) * local * local, seg: 1 };
  }
  const local = Math.min(1, (t - s0 - s1) / s2);
  const x = drum.x + (ball.slotX - drum.x) * easeOut(local);
  return { x, y: trayYAt(tray, x) - BALL_R, seg: 2 };
}

function drawMachineBody(ctx, machine, parkedCount) {
  const { drum, tray } = machine;
  ctx.save();

  const glow = ctx.createRadialGradient(drum.x, drum.y, drum.r * 0.2, drum.x, drum.y, drum.r);
  glow.addColorStop(0, tintColor(machine, machine.tint === 'gold' ? 0.10 : 0.12));
  glow.addColorStop(1, 'rgba(10, 6, 18, 0.05)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(drum.x, drum.y, drum.r, 0, Math.PI * 2);
  ctx.fill();

  const aEnd = Math.PI / 2;
  const aStart = Math.atan2(trayYAt(tray, tray.xEnd) - tray.cy, tray.xEnd - tray.cx);
  ctx.strokeStyle = tintColor(machine, 0.55);
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(tray.cx, tray.cy, tray.R + 4, aStart, aEnd);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(tray.cx, tray.cy, tray.R, aStart, aEnd);
  ctx.stroke();

  const stopY = trayYAt(tray, tray.xStop);
  ctx.strokeStyle = tintColor(machine, 0.7);
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(tray.xStop, stopY + 4);
  ctx.lineTo(tray.xStop, stopY - 30);
  ctx.stroke();

  const gapHalf = gapHalfAngle(machine);
  const gapW = BALL_R + 6;
  const chuteTop = drum.y + Math.cos(gapHalf) * drum.r;
  ctx.strokeStyle = tintColor(machine, 0.35);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(drum.x - gapW, chuteTop);
  ctx.lineTo(drum.x - gapW, trayYAt(tray, drum.x - gapW) - 8);
  ctx.moveTo(drum.x + gapW, chuteTop);
  ctx.lineTo(drum.x + gapW, trayYAt(tray, drum.x + gapW) - 8);
  ctx.stroke();

  const { pipe } = machine;
  const rimTop = drum.y - Math.cos(gapHalf) * drum.r;
  const edgeX = pipe.side === 'left' ? 0 : W;
  const nearX = pipe.side === 'left' ? drum.x - gapW : drum.x + gapW;
  const farX = pipe.side === 'left' ? drum.x + gapW : drum.x - gapW;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.fillRect(Math.min(edgeX, farX), pipe.y - gapW, Math.abs(edgeX - farX), gapW * 2);
  ctx.strokeStyle = tintColor(machine, 0.35);
  ctx.beginPath();
  ctx.moveTo(edgeX, pipe.y - gapW);
  ctx.lineTo(farX, pipe.y - gapW);
  ctx.lineTo(farX, rimTop - 2);
  ctx.moveTo(edgeX, pipe.y + gapW);
  ctx.lineTo(nearX, pipe.y + gapW);
  ctx.lineTo(nearX, rimTop - 2);
  ctx.stroke();

  ctx.font = '700 11px "Trebuchet MS", "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  for (let i = 0; i < machine.slotXs.length; i += 1) {
    if (i < parkedCount) continue;
    const sx = machine.slotXs[i];
    ctx.strokeStyle = tintColor(machine, machine.tint === 'gold' ? 0.55 : 0.5);
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(sx, trayYAt(tray, sx) - BALL_R, BALL_R + 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.font = '800 13px "Trebuchet MS", "Segoe UI", sans-serif';
  ctx.letterSpacing = '3px';
  ctx.shadowColor = tintColor(machine, 0.5);
  ctx.shadowBlur = 10;
  ctx.fillStyle = machine.tint === 'gold' ? '#ffcf4d' : '#c9b6ff';
  ctx.fillText(machine.label, (tray.xStop + tray.xEnd) / 2, H - 8);
  ctx.letterSpacing = '0px';

  ctx.restore();
}

function drawSpinner(ctx, machine) {
  const { drum, spin } = machine;
  const barTip = drum.r - 8;
  ctx.save();
  ctx.translate(drum.x, drum.y);
  for (let k = 0; k < 3; k += 1) {
    ctx.save();
    ctx.rotate(spin.angle + (k * Math.PI * 2) / 3);
    const bar = ctx.createLinearGradient(HUB_R, 0, barTip, 0);
    if (machine.tint === 'gold') {
      bar.addColorStop(0, 'rgba(255, 238, 187, 0.9)');
      bar.addColorStop(1, 'rgba(217, 169, 63, 0.75)');
    } else {
      bar.addColorStop(0, 'rgba(232, 228, 255, 0.9)');
      bar.addColorStop(1, 'rgba(159, 143, 224, 0.75)');
    }
    ctx.strokeStyle = bar;
    ctx.lineWidth = BAR_HALF * 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(HUB_R, 0);
    ctx.lineTo(barTip, 0);
    ctx.stroke();
    ctx.restore();
  }
  const hub = ctx.createRadialGradient(-4, -4, 2, 0, 0, HUB_R);
  hub.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
  hub.addColorStop(0.6, 'rgba(180, 180, 205, 0.7)');
  hub.addColorStop(1, 'rgba(90, 90, 120, 0.7)');
  ctx.fillStyle = hub;
  ctx.beginPath();
  ctx.arc(0, 0, HUB_R * 0.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(40, 40, 60, 0.8)';
  ctx.beginPath();
  ctx.arc(0, 0, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawRim(ctx, machine) {
  const { drum } = machine;
  const gapHalf = gapHalfAngle(machine);
  const gapCentre = Math.PI / 2;
  ctx.save();
  const hatchCentre = Math.PI * 1.5;
  ctx.strokeStyle = tintColor(machine, machine.tint === 'gold' ? 0.55 : 0.6);
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(drum.x, drum.y, drum.r, gapCentre + gapHalf, hatchCentre - gapHalf);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(drum.x, drum.y, drum.r, hatchCentre + gapHalf, gapCentre - gapHalf + Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
  for (let i = 0; i < 12; i += 1) {
    const a = (i / 12) * Math.PI * 2 + Math.PI / 12;
    if (Math.abs(a - gapCentre) < gapHalf + 0.18) continue;
    if (Math.abs(a - hatchCentre) < gapHalf + 0.18) continue;
    ctx.beginPath();
    ctx.arc(drum.x + Math.cos(a) * drum.r, drum.y + Math.sin(a) * drum.r, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.09)';
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.arc(drum.x, drum.y, drum.r - 12, -2.5, -1.3);
  ctx.stroke();
  ctx.restore();
}

function drawBall(ctx, ball) {
  const r = BALL_R * (1 + ball.pop * 0.28);
  ctx.save();
  if (ball.state === 'free' || ball.state === 'capturing') {
    ctx.globalAlpha = 0.86 + ball.z * 0.14;
  }
  ctx.translate(ball.x, ball.y);

  const body = ctx.createRadialGradient(-r * 0.4, -r * 0.45, r * 0.08, 0, 0, r * 1.08);
  if (ball.bonus) {
    body.addColorStop(0, '#ffe9a0');
    body.addColorStop(0.45, '#ffc832');
    body.addColorStop(0.85, '#b57d06');
    body.addColorStop(1, '#7d5502');
  } else {
    body.addColorStop(0, '#b9c8ff');
    body.addColorStop(0.45, '#7d8ef5');
    body.addColorStop(0.85, '#4a55b8');
    body.addColorStop(1, '#2e3585');
  }
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.rotate(ball.rot);
  const windowR = r * 0.62;
  const win = ctx.createRadialGradient(-windowR * 0.25, -windowR * 0.3, windowR * 0.1, 0, 0, windowR);
  win.addColorStop(0, '#ffffff');
  win.addColorStop(0.75, '#f2f2f8');
  win.addColorStop(1, '#c9c9dd');
  ctx.fillStyle = win;
  ctx.beginPath();
  ctx.arc(0, 0, windowR, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = ball.bonus ? '#7a5200' : '#252a6e';
  ctx.font = `900 ${Math.round(windowR * 1.1)}px "Trebuchet MS", "Segoe UI", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(ball.n), 0, 1);
  if (ball.n === 6 || ball.n === 9) {
    ctx.fillRect(-windowR * 0.34, windowR * 0.48, windowR * 0.68, Math.max(1.5, windowR * 0.12));
  }
  ctx.restore();

  const spec = ctx.createRadialGradient(-r * 0.42, -r * 0.5, 0, -r * 0.42, -r * 0.5, r * 0.55);
  spec.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
  spec.addColorStop(0.35, 'rgba(255, 255, 255, 0.2)');
  spec.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = spec;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  if (ball.pop > 0) {
    ctx.strokeStyle = `rgba(255, 207, 77, ${ball.pop})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawMachine(ctx, machine, balls, parked) {
  drawMachineBody(ctx, machine, parked);
  const sorted = balls.slice().sort((a, b) => a.z - b.z);
  const behindBars = (ball) =>
    (ball.state === 'free' || ball.state === 'capturing') && ball.z < BAR_PLANE;
  for (const ball of sorted) {
    if (behindBars(ball)) drawBall(ctx, ball);
  }
  drawSpinner(ctx, machine);
  for (const ball of sorted) {
    if (!behindBars(ball)) drawBall(ctx, ball);
  }
  drawRim(ctx, machine);
}

export function createDrawMachine(canvas) {
  const ctx = canvas.getContext('2d');
  let mains = makeBalls(15, MAIN, false);
  let bonuses = makeBalls(5, BONUS, true);
  let agitation = 0.9;
  let sequence = null;
  let assignedMains = new Set();
  let assignedBonus = false;
  let lastTime = performance.now();
  let running = true;
  let onRevealCallback = null;

  function reset() {
    mains = makeBalls(15, MAIN, false);
    bonuses = makeBalls(5, BONUS, true);
    MAIN.intakeActive = false;
    BONUS.intakeActive = false;
    sequence = null;
    assignedMains = new Set();
    assignedBonus = false;
    agitation = 0.9;
  }

  function parkedCount(pool) {
    return pool.filter((ball) => ball.state === 'parked').length;
  }

  function fullyRevealed() {
    return assignedMains.size === 4 && assignedBonus;
  }

  function park(ball, machine, localSlot) {
    ball.state = 'parked';
    ball.slot = localSlot;
    ball.slotX = machine.slotXs[localSlot];
    ball.x = ball.slotX;
    ball.y = trayYAt(machine.tray, ball.slotX) - BALL_R;
    ball.rot = 0;
  }

  function play(mainNumbers, bonusNumber, { instant = false, onDone = null } = {}) {
    reset();
    if (instant) {
      mainNumbers.forEach((number, index) => {
        park(mains.find((candidate) => candidate.n === number), MAIN, index);
        assignedMains.add(number);
      });
      park(bonuses.find((candidate) => candidate.n === bonusNumber), BONUS, 0);
      assignedBonus = true;
      scatterInDrum(mains, MAIN);
      scatterInDrum(bonuses, BONUS);
      agitation = 0.35;
      if (onDone) onDone();
      return;
    }
    reveal(mainNumbers, bonusNumber, { onDone });
  }

  function reveal(mainNumbers, bonusNumber, { onDone = null } = {}) {
    const steps = [];
    for (const number of mainNumbers) {
      if (assignedMains.has(number) || assignedMains.size >= 4) continue;
      steps.push({ number, slot: assignedMains.size, bonus: false });
      assignedMains.add(number);
    }
    if (bonusNumber !== null && bonusNumber !== undefined && !assignedBonus) {
      assignedBonus = true;
      steps.push({ number: bonusNumber, slot: 0, bonus: true });
    }
    if (steps.length === 0) return;
    agitation = 2.6;
    const inPipe = (ball) => ball.state === 'staged' || ball.state === 'dropping';
    const needsIntake = mains.some(inPipe) || bonuses.some(inPipe);
    if (needsIntake) {
      MAIN.intakeActive = true;
      BONUS.intakeActive = true;
    }
    if (sequence) {
      sequence.steps.push(...steps);
      if (onDone) sequence.onDone = onDone;
    } else {
      sequence = {
        steps, index: 0, wait: needsIntake ? 3.6 : 1.0,
        active: null, activeMachine: null, captureTime: 0, onDone
      };
    }
  }

  function updateSequence(dt) {
    if (!sequence) return;
    if (sequence.active) {
      const ball = sequence.active;
      const machine = sequence.activeMachine;
      if (ball.state === 'capturing') {
        sequence.captureTime += dt;
        const ex = machine.drum.x;
        const ey = machine.drum.y + machine.drum.r - BALL_R;
        const arrived = Math.hypot(ball.x - ex, ball.y - ey) < 9;
        if (arrived || sequence.captureTime > 4) {
          ball.state = 'extracting';
          ball.sx = ball.x;
          ball.sy = ball.y;
          ball.pathT = arrived ? SEGMENT_SHARES[0] : 0;
        }
        return;
      }
      ball.pathT = Math.min(1, ball.pathT + dt / EXTRACT_SECONDS);
      const point = extractionPoint(machine, ball, ball.pathT);
      if (point.seg === 2) {
        ball.rot += (point.x - ball.x) / BALL_R;
      }
      ball.x = point.x;
      ball.y = point.y;
      if (ball.pathT >= 1) {
        ball.state = 'parked';
        ball.pop = 1;
        if (onRevealCallback) onRevealCallback();
        sequence.active = null;
        sequence.activeMachine = null;
        sequence.wait = REVEAL_GAP_SECONDS;
        if (sequence.index >= sequence.steps.length) {
          const done = sequence.onDone;
          sequence = null;
          agitation = fullyRevealed() ? 0.35 : 1.8;
          if (done) done();
        }
      }
      return;
    }
    sequence.wait -= dt;
    if (sequence.wait > 0) return;
    const step = sequence.steps[sequence.index];
    sequence.index += 1;
    const machine = step.bonus ? BONUS : MAIN;
    const pool = step.bonus ? bonuses : mains;
    const ball = pool.find((candidate) => candidate.n === step.number);
    if (ball.state !== 'free') {
      sequence.index -= 1;
      sequence.wait = 0.4;
      return;
    }
    ball.state = 'capturing';
    ball.slot = step.slot;
    ball.slotX = machine.slotXs[step.slot];
    ball.pathT = 0;
    sequence.active = ball;
    sequence.activeMachine = machine;
    sequence.captureTime = 0;
  }

  function frame(now) {
    if (!running) return;
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    const mainOmega = MAIN.spin.dir * (1.1 + agitation * 1.7);
    const bonusOmega = BONUS.spin.dir * (1.1 + agitation * 0.8 * 1.7);
    MAIN.spin.angle += mainOmega * dt;
    BONUS.spin.angle += bonusOmega * dt;
    updateIntake(MAIN, mains, dt);
    updateIntake(BONUS, bonuses, dt);
    physicsStep(mains, MAIN, dt, agitation, mainOmega);
    physicsStep(bonuses, BONUS, dt, agitation * 0.8, bonusOmega);
    updateSequence(dt);
    for (const ball of mains.concat(bonuses)) {
      if (ball.pop > 0) ball.pop = Math.max(0, ball.pop - dt * 1.4);
    }
    ctx.clearRect(0, 0, W, H);
    drawMachine(ctx, MAIN, mains, parkedCount(mains));
    drawMachine(ctx, BONUS, bonuses, parkedCount(bonuses));
    requestAnimationFrame(frame);
  }

  requestAnimationFrame((now) => {
    lastTime = now;
    frame(now);
  });

  function load() {
    MAIN.intakeActive = true;
    BONUS.intakeActive = true;
    if (agitation < 1.6) agitation = 1.6;
  }

  function revealedNumbers() {
    return {
      mains: mains
        .filter((ball) => ball.state === 'parked')
        .sort((a, b) => a.slot - b.slot)
        .map((ball) => ball.n),
      bonus: bonuses.find((ball) => ball.state === 'parked')?.n ?? null
    };
  }

  return {
    play,
    reveal,
    reset,
    load,
    revealedNumbers,
    onReveal: (fn) => {
      onRevealCallback = fn;
    },
    isPlaying: () => sequence !== null,
    fullyRevealed,
    stop: () => {
      running = false;
    }
  };
}
