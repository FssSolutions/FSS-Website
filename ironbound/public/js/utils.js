// ============================================================
//  utils.js  —  Constants, pure helpers, shared types
// ============================================================

const CANVAS_W = 1280;
const CANVAS_H = 720;
const TILE_SIZE = 48;
const MAP_W = 200;
const MAP_H = 200;

// Tile type IDs
const T = {
  GROUND: 0, WALL: 1, TREE: 2, WATER: 3,
  LAVA: 4, ICE: 5, BONFIRE: 6, DUNGEON: 7, CHEST: 8
};

// Region palettes
const PAL = {
  frostholm: {
    ground: [185, 210, 235], tree: [90, 115, 140], wall: [140, 165, 185],
    water: [60, 110, 165], ice: [200, 230, 250], sky: '#0e1c2e', fog: null
  },
  thornwood: {
    ground: [32, 58, 28], tree: [18, 36, 14], wall: [50, 44, 22],
    water: [18, 42, 28], ice: null, sky: '#080e08', fog: 'rgba(100,120,80,0.10)'
  },
  greyspire: {
    ground: [80, 80, 95], tree: [55, 55, 70], wall: [65, 65, 80],
    water: [40, 55, 75], ice: null, sky: '#0d0d18', fog: null
  },
  ashfeld: {
    ground: [62, 28, 14], tree: [30, 12, 4], wall: [52, 24, 10],
    water: [160, 44, 8], ice: null, sky: '#1a0406', fog: null
  }
};

function getRegionName(tx, ty) {
  if (tx < 100 && ty < 100) return 'frostholm';
  if (tx >= 100 && ty < 100) return 'thornwood';
  if (tx < 100 && ty >= 100) return 'greyspire';
  return 'ashfeld';
}

// Integer hash 0‥99
function tileHash(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >> 13)) * 1274126177 | 0;
  return ((h ^ (h >> 16)) >>> 0) % 100;
}

function rectOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function circleRect(cx, cy, r, rx, ry, rw, rh) {
  const nx = Math.max(rx, Math.min(cx, rx + rw));
  const ny = Math.max(ry, Math.min(cy, ry + rh));
  const dx = cx - nx, dy = cy - ny;
  return dx * dx + dy * dy <= r * r;
}

function dist(ax, ay, bx, by) {
  const dx = ax - bx, dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

function normalize(dx, dy) {
  const len = Math.sqrt(dx * dx + dy * dy) || 0.0001;
  return { x: dx / len, y: dy / len };
}

function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function rnd(min, max) { return min + Math.random() * (max - min); }
function rndInt(min, max) { return Math.floor(min + Math.random() * (max - min + 1)); }
function ang(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); }

function rgbStr(r, g, b, a) {
  if (a !== undefined) return `rgba(${r},${g},${b},${a})`;
  return `rgb(${r},${g},${b})`;
}

function adjustRGB(rgb, d) {
  return rgbStr(clamp(rgb[0] + d, 0, 255), clamp(rgb[1] + d, 0, 255), clamp(rgb[2] + d, 0, 255));
}

// Draw a rounded rect
function roundRect(ctx, x, y, w, h, r, fill, stroke) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
}

function drawBar(ctx, x, y, w, h, frac, fg, bg, label) {
  ctx.fillStyle = bg || '#333';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = fg;
  ctx.fillRect(x, y, Math.max(0, w * frac), h);
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);
  if (label) {
    ctx.fillStyle = '#fff';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(label, x + w / 2, y + h - 2);
  }
}
