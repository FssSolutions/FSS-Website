// ============================================================
//  main.js  —  Entry point, game loop, input, Audio
// ============================================================

// ── Audio ────────────────────────────────────────────────────
const Audio = (() => {
  let ctx = null;

  function getCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    return ctx;
  }

  function tone(freq, type, vol, dur, attack, decay) {
    try {
      const ac = getCtx();
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.type = type || 'square';
      osc.frequency.setValueAtTime(freq, ac.currentTime);
      gain.gain.setValueAtTime(0, ac.currentTime);
      gain.gain.linearRampToValueAtTime(vol || 0.15, ac.currentTime + (attack || 0.01));
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + (dur || 0.15));
      osc.start(ac.currentTime);
      osc.stop(ac.currentTime + (dur || 0.15) + 0.05);
    } catch(e) {}
  }

  function noise(vol, dur) {
    try {
      const ac = getCtx();
      const bufSize = ac.sampleRate * dur;
      const buf = ac.createBuffer(1, bufSize, ac.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
      const src = ac.createBufferSource();
      src.buffer = buf;
      const gain = ac.createGain();
      gain.gain.setValueAtTime(vol, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
      src.connect(gain);
      gain.connect(ac.destination);
      src.start();
    } catch(e) {}
  }

  const sounds = {
    hit() {
      tone(180, 'sawtooth', 0.18, 0.12);
      noise(0.06, 0.08);
    },
    hurt() {
      tone(120, 'square', 0.2, 0.2);
      tone(90, 'sawtooth', 0.1, 0.15, 0.02);
    },
    swing() {
      noise(0.04, 0.1);
      tone(300, 'sine', 0.06, 0.08);
    },
    dodge() {
      tone(440, 'sine', 0.08, 0.1);
      tone(520, 'sine', 0.05, 0.08, 0.01);
    },
    menu() {
      tone(660, 'sine', 0.07, 0.08);
    },
    levelup() {
      tone(440, 'sine', 0.12, 0.1);
      setTimeout(() => tone(554, 'sine', 0.12, 0.1), 100);
      setTimeout(() => tone(659, 'sine', 0.15, 0.2), 200);
    },
    death() {
      tone(220, 'sawtooth', 0.18, 0.4);
      tone(110, 'square', 0.12, 0.6, 0.05);
    },
    special() {
      tone(880, 'sine', 0.1, 0.05);
      tone(440, 'square', 0.08, 0.2, 0.01);
      noise(0.05, 0.15);
    },
    chest() {
      tone(523, 'sine', 0.1, 0.1);
      setTimeout(() => tone(659, 'sine', 0.1, 0.1), 80);
      setTimeout(() => tone(784, 'sine', 0.12, 0.18), 160);
    },
    bonfire() {
      noise(0.03, 0.3);
      tone(200, 'sine', 0.04, 0.3);
    }
  };

  function play(name) {
    if (sounds[name]) {
      try { sounds[name](); } catch(e) {}
    }
  }

  return { play };
})();

// ── Canvas setup ─────────────────────────────────────────────
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = CANVAS_W;
canvas.height = CANVAS_H;
ctx.imageSmoothingEnabled = false;

// ── Global state ─────────────────────────────────────────────
const G = {
  phase: 'title',          // title | classSelect | intro | playing | paused | win | dead
  player: null,
  enemies: [],
  npcs: [],
  projectiles: [],
  particles: [],
  damageNums: [],
  loot: [],
  questFlags: null,
  camera: { x: 0, y: 0 },
  targetCam: { x: 0, y: 0 },
  dayPhase: 0,             // 0=day, 0.5=night
  time: 0,
  keys: {},
  mouse: { x: 0, y: 0, wx: 0, wy: 0, down: false },
  ui: {
    notification: null,
    dialogue: null,
    inventoryOpen: false,
    mapOpen: false,
    questLogOpen: false,
    charSheetOpen: false,
    merchantOpen: null,
    merchantStock: null,
    selectedClass: 'ironclad',
    titleButtons: [],
    classCards: []
  },
  selectedClass: 'ironclad',
  deathTimer: 0,
  introPage: 0,
  introFade: 0
};

// ── Input ─────────────────────────────────────────────────────
window.addEventListener('keydown', e => {
  G.keys[e.code] = true;
  handleKeyDown(e.code, e);
});
window.addEventListener('keyup', e => {
  G.keys[e.code] = false;
});

canvas.addEventListener('mousemove', e => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = CANVAS_W / rect.width;
  const scaleY = CANVAS_H / rect.height;
  G.mouse.x = (e.clientX - rect.left) * scaleX;
  G.mouse.y = (e.clientY - rect.top) * scaleY;
  G.mouse.wx = G.mouse.x + G.camera.x;
  G.mouse.wy = G.mouse.y + G.camera.y;
});

canvas.addEventListener('mousedown', e => {
  G.mouse.down = true;
  const rect = canvas.getBoundingClientRect();
  const scaleX = CANVAS_W / rect.width;
  const scaleY = CANVAS_H / rect.height;
  const mx = (e.clientX - rect.left) * scaleX;
  const my = (e.clientY - rect.top) * scaleY;
  handleClick(mx, my, e.button);
});

canvas.addEventListener('mouseup', e => {
  G.mouse.down = false;
});

canvas.addEventListener('contextmenu', e => e.preventDefault());

// ── Key handler ───────────────────────────────────────────────
function handleKeyDown(code, e) {
  // Prevent browser shortcuts during gameplay
  if (['KeyI','KeyM','KeyL','KeyC','KeyF','Space'].includes(code)) {
    e.preventDefault();
  }

  if (G.phase === 'title') {
    if (code === 'Enter' || code === 'Space') startNewGame();
    return;
  }

  if (G.phase === 'intro') {
    if (code === 'Space' || code === 'Enter') advanceIntro();
    return;
  }

  if (G.phase === 'classSelect') {
    if (code === 'ArrowLeft' || code === 'KeyA') {
      const classes = ['ironclad','duskwalker','runebound'];
      const i = classes.indexOf(G.ui.selectedClass);
      G.ui.selectedClass = classes[(i + 2) % 3];
    }
    if (code === 'ArrowRight' || code === 'KeyD') {
      const classes = ['ironclad','duskwalker','runebound'];
      const i = classes.indexOf(G.ui.selectedClass);
      G.ui.selectedClass = classes[(i + 1) % 3];
    }
    if (code === 'Enter' || code === 'Space') {
      confirmClassSelect();
    }
    return;
  }

  if (G.phase === 'dead') {
    if (code === 'Enter' || code === 'Space') {
      G.phase = 'title';
    }
    return;
  }

  if (G.phase === 'win') {
    if (code === 'Enter' || code === 'Space') G.phase = 'title';
    return;
  }

  if (G.phase !== 'playing') return;

  // Dialogue advance
  if (G.ui.dialogue && !G.ui.dialogue.showMerchant) {
    if (code === 'KeyE' || code === 'Enter' || code === 'Space') {
      NPCs.advanceDialogue(G);
      return;
    }
    if (code === 'Escape') {
      NPCs.closeDialogue(G);
      return;
    }
    return;
  }
  if (G.ui.dialogue && G.ui.dialogue.showMerchant) {
    if (code === 'Escape' || code === 'KeyE') {
      NPCs.closeDialogue(G);
      return;
    }
    return;
  }

  // Overlay toggles
  if (code === 'KeyI') {
    G.ui.inventoryOpen = !G.ui.inventoryOpen;
    G.ui.mapOpen = false;
    G.ui.questLogOpen = false;
    G.ui.charSheetOpen = false;
    Audio.play('menu');
    return;
  }
  if (code === 'KeyM') {
    G.ui.mapOpen = !G.ui.mapOpen;
    G.ui.inventoryOpen = false;
    G.ui.questLogOpen = false;
    G.ui.charSheetOpen = false;
    Audio.play('menu');
    return;
  }
  if (code === 'KeyL') {
    G.ui.questLogOpen = !G.ui.questLogOpen;
    G.ui.inventoryOpen = false;
    G.ui.mapOpen = false;
    G.ui.charSheetOpen = false;
    Audio.play('menu');
    return;
  }
  if (code === 'KeyC') {
    G.ui.charSheetOpen = !G.ui.charSheetOpen;
    G.ui.inventoryOpen = false;
    G.ui.mapOpen = false;
    G.ui.questLogOpen = false;
    Audio.play('menu');
    return;
  }
  if (code === 'Escape') {
    G.ui.inventoryOpen = false;
    G.ui.mapOpen = false;
    G.ui.questLogOpen = false;
    G.ui.charSheetOpen = false;
    Audio.play('menu');
    return;
  }

  // Close any open overlay before action keys
  const overlayOpen = G.ui.inventoryOpen || G.ui.mapOpen || G.ui.questLogOpen || G.ui.charSheetOpen;

  if (!overlayOpen) {
    // NPC interact
    if (code === 'KeyE') {
      const npc = NPCs.getNearbyNPC(G.player.x, G.player.y, Player.PLAYER_W, Player.PLAYER_H);
      if (npc) {
        NPCs.startDialogue(npc, G);
        return;
      }
      // Chest interact
      tryOpenChest();
      return;
    }

    // Rest at bonfire
    if (code === 'KeyF') {
      tryRestBonfire();
      return;
    }

    // Use health potion (Q)
    if (code === 'KeyQ') {
      useHealthPotion();
      return;
    }

    // Dodge roll (Space)
    if (code === 'Space') {
      Player.tryDodge(G.player, G);
      return;
    }

    // Special ability (R or right-click handled in click)
    if (code === 'KeyR') {
      Player.useSpecial(G.player, G);
      return;
    }
  }
}

// ── Click handler ─────────────────────────────────────────────
function handleClick(mx, my, button) {
  if (G.phase === 'title') {
    // Check NEW GAME button (centered)
    const bw = 220, bh = 44;
    const bx = CANVAS_W/2 - bw/2;
    const by1 = CANVAS_H/2 + 60;
    const by2 = CANVAS_H/2 + 116;
    if (mx>=bx && mx<=bx+bw) {
      if (my>=by1 && my<=by1+bh) { startNewGame(); return; }
      if (my>=by2 && my<=by2+bh) { startNewGame(); return; } // CONTINUE same for now
    }
    return;
  }

  if (G.phase === 'intro') {
    advanceIntro();
    return;
  }

  if (G.phase === 'classSelect') {
    // Class cards: 3 columns at ~180, ~490, ~800 x-center, y ~200–500
    const classes = ['ironclad','duskwalker','runebound'];
    const cardW = 260, cardH = 320;
    const startX = (CANVAS_W - (cardW*3 + 40*2)) / 2;
    for (let i = 0; i < 3; i++) {
      const cx = startX + i*(cardW+40);
      const cy = 140;
      if (mx>=cx && mx<=cx+cardW && my>=cy && my<=cy+cardH) {
        G.ui.selectedClass = classes[i];
        Audio.play('menu');
      }
    }
    // Select button
    const selBW = 200, selBH = 44;
    const selBX = CANVAS_W/2 - selBW/2;
    const selBY = CANVAS_H - 100;
    if (mx>=selBX && mx<=selBX+selBW && my>=selBY && my<=selBY+selBH) {
      confirmClassSelect();
    }
    return;
  }

  if (G.phase !== 'playing') return;

  const p = G.player;
  if (!p || p.dead) return;

  // Dialogue click advance
  if (G.ui.dialogue && !G.ui.dialogue.showMerchant) {
    NPCs.advanceDialogue(G);
    return;
  }

  // Merchant buy click
  if (G.ui.dialogue && G.ui.dialogue.showMerchant) {
    if (button === 0) handleMerchantClick(mx, my);
    if (button === 2) NPCs.closeDialogue(G);
    return;
  }

  // Inventory item click
  if (G.ui.inventoryOpen) {
    if (button === 0) handleInventoryClick(mx, my);
    return;
  }

  // Character sheet stat allocation click
  if (G.ui.charSheetOpen) {
    if (button === 0) handleCharSheetClick(mx, my);
    return;
  }

  // Gameplay clicks
  if (!G.ui.inventoryOpen && !G.ui.mapOpen && !G.ui.questLogOpen && !G.ui.charSheetOpen) {
    if (button === 0) {
      // Left click: melee or ranged
      if (p.weapon && (p.weapon.type==='bow' || p.weapon.type==='throwaxe')) {
        Combat.playerRangedAttack(G);
      } else {
        Combat.playerAttack(G);
      }
    }
    if (button === 2) {
      // Right click: special
      Player.useSpecial(p, G);
    }
  }
}

// ── Inventory click ──────────────────────────────────────────
function handleInventoryClick(mx, my) {
  const p = G.player;
  // Grid starts at ~ PX+16, PY+48, cells 80×80, 5 cols 4 rows
  const PW=580, PH=480;
  const PX=(CANVAS_W-PW)/2, PY=(CANVAS_H-PH)/2;
  const cellSize = 72;
  const gridX = PX + 16;
  const gridY = PY + 48;
  const cols = 5;

  for (let idx=0; idx < (p.inventory||[]).length; idx++) {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const cx = gridX + col*cellSize;
    const cy = gridY + row*cellSize;
    if (mx>=cx && mx<=cx+cellSize-4 && my>=cy && my<=cy+cellSize-4) {
      const item = p.inventory[idx];
      if (item.type === 'consume') {
        useItem(item, idx);
      } else {
        Inventory.equipItem(p, item, G);
        Audio.play('menu');
      }
      return;
    }
  }
}

function useItem(item, idx) {
  const p = G.player;
  if (item.id==='hpotion' || item.id==='hpotion2') {
    const heal = item.id==='hpotion' ? 50 : 100;
    p.hp = Math.min(p.maxHp, p.hp + heal);
    G.damageNums.push({x:p.x+Player.PLAYER_W/2, y:p.y-10, val:'+'+heal, color:'#44ff88', vy:-40, life:1.2});
    p.inventory.splice(idx, 1);
    Audio.play('menu');
  } else if (item.id==='stonictonic') {
    p.stamina = Math.min(p.maxStamina, p.stamina + 60);
    p.inventory.splice(idx, 1);
    Audio.play('menu');
  } else if (item.id==='antidote') {
    p.poisoned = false;
    p.inventory.splice(idx, 1);
    Audio.play('menu');
  }
}

// ── Merchant click ────────────────────────────────────────────
function handleMerchantClick(mx, my) {
  const stock = G.ui.merchantStock;
  if (!stock) return;
  const p = G.player;

  // Merchant UI: items listed at PX+16+, PY+80+, each row ~44px
  const PW=520, PH=440;
  const PX=(CANVAS_W-PW)/2, PY=(CANVAS_H-PH)/2;
  let yOff = PY + 80;

  for (let i=0; i<stock.length; i++) {
    const item = stock[i];
    const iy = yOff + i*44;
    // Buy button ~right side
    const buyX = PX + PW - 100;
    const buyY = iy - 14;
    if (mx>=buyX && mx<=buyX+76 && my>=buyY && my<=buyY+28) {
      Inventory.buyItem(p, item, G);
      return;
    }
  }

  // Close button bottom
  const closeX = PX + PW/2 - 60;
  const closeY = PY + PH - 42;
  if (mx>=closeX && mx<=closeX+120 && my>=closeY && my<=closeY+28) {
    NPCs.closeDialogue(G);
  }
}

// ── Character sheet click ─────────────────────────────────────
function handleCharSheetClick(mx, my) {
  const p = G.player;
  if (!p || p.statPoints <= 0) return;

  const PW=480, PH=460;
  const PX=(CANVAS_W-PW)/2, PY=(CANVAS_H-PH)/2;
  const stats = ['str','agi','end','pre'];
  const labels = ['STR','AGI','END','PRE'];

  for (let i=0; i<stats.length; i++) {
    const sy = PY + 120 + i*42;
    const btnX = PX + PW - 60;
    const btnY = sy - 10;
    if (mx>=btnX && mx<=btnX+36 && my>=btnY && my<=btnY+24) {
      p[stats[i]] = (p[stats[i]]||0) + 1;
      p.statPoints--;
      // Apply bonuses
      if (stats[i]==='end') {
        p.maxHp += 8;
        p.hp = Math.min(p.hp + 8, p.maxHp);
        p.maxStamina += 5;
      }
      if (stats[i]==='str') p.attackDamage = (p.attackDamage||10) + 2;
      if (stats[i]==='agi') {
        p.speed += 4;
        p.attackSpeed = Math.max(0.25, p.attackSpeed - 0.01);
      }
      if (stats[i]==='pre') p.critChance = Math.min(0.5, (p.critChance||0.05) + 0.02);
      Audio.play('menu');
      if (p.statPoints <= 0) break;
    }
  }
}

// ── Game actions ──────────────────────────────────────────────
function tryOpenChest() {
  const p = G.player;
  if (!p) return;
  const ptx = Math.floor((p.x + Player.PLAYER_W/2) / TILE_SIZE);
  const pty = Math.floor((p.y + Player.PLAYER_H/2) / TILE_SIZE);

  // Check 3×3 around player for chest tiles
  for (let dx=-1; dx<=1; dx++) {
    for (let dy=-1; dy<=1; dy++) {
      const tx=ptx+dx, ty=pty+dy;
      const idx = ty*MAP_W+tx;
      if (World.getTile(tx, ty) === T.CHEST) {
        World.setTile(tx, ty, T.GROUND); // open it
        Audio.play('chest');
        Quests.onChestOpened(tx, ty, G);
        // Drop some loot
        const drop = Inventory.randomDrop(p.level || 1);
        if (drop) {
          G.loot.push({
            x: tx*TILE_SIZE, y: ty*TILE_SIZE,
            w: 16, h: 16,
            item: drop,
            life: 30
          });
          G.ui.notification = {text: 'Found: '+drop.name, color:'#FFD700', timer:4};
        }
        const goldAmt = rndInt(10, 30);
        p.gold = (p.gold||0) + goldAmt;
        G.damageNums.push({x:tx*TILE_SIZE+24, y:ty*TILE_SIZE, val:'+'+goldAmt+'g', color:'#FFD700', vy:-40, life:1.5});
        return;
      }
    }
  }
}

function tryRestBonfire() {
  const p = G.player;
  if (!p) return;
  const bonfires = World.bonfires;
  for (const bf of bonfires) {
    const bx=bf.tx*TILE_SIZE+TILE_SIZE/2, by=bf.ty*TILE_SIZE+TILE_SIZE/2;
    const d = dist(p.x+Player.PLAYER_W/2, p.y+Player.PLAYER_H/2, bx, by);
    if (d < 72) {
      // Rest: restore HP and stamina
      p.hp = p.maxHp;
      p.stamina = p.maxStamina;
      p.dead = false;
      Audio.play('bonfire');
      Quests.onBonfireRested(bf.id, G);
      G.ui.notification = {text:'Rested at bonfire. HP and Stamina restored.', color:'#ffcc88', timer:4};
      // Respawn a subset of enemies (not bosses)
      const newEnemies = Enemies.spawnAll().filter(e => !e.isBoss);
      const bosses = G.enemies.filter(e => e.isBoss && e.alive);
      G.enemies = [...bosses, ...newEnemies.slice(0, 30)];
      return;
    }
  }
  G.ui.notification = {text:'No bonfire nearby. (F to rest)', color:'#887766', timer:2};
}

function useHealthPotion() {
  const p = G.player;
  if (!p) return;
  const idx = (p.inventory||[]).findIndex(i => i.id==='hpotion' || i.id==='hpotion2');
  if (idx >= 0) {
    const item = p.inventory[idx];
    useItem(item, idx);
  } else {
    G.ui.notification = {text:'No health potions.', color:'#887766', timer:2};
  }
}

// ── Init / New game ───────────────────────────────────────────
function startNewGame() {
  G.phase = 'classSelect';
  G.ui.selectedClass = 'ironclad';
  Audio.play('menu');
}

function advanceIntro() {
  Audio.play('menu');
  if (G.introPage < UI.INTRO_PAGES.length - 1) {
    G.introPage++;
    G.introFade = 0;
  } else {
    G.phase = 'playing';
    G.ui.notification = {text: 'Find Elder Edda. She is marked on the minimap.', color: '#aabbcc', timer: 6};
  }
}

function confirmClassSelect() {
  const cls = G.ui.selectedClass;
  Audio.play('levelup');
  initGame(cls);
  G.phase = 'intro';
  G.introPage = 0;
  G.introFade = 0;
}

function initGame(playerClass) {
  World.generate();

  G.player = Player.create(playerClass);
  Inventory.initPlayerInventory(G.player, playerClass);
  G.questFlags = Quests.initFlags();
  G.enemies = Enemies.spawnAll();
  G.npcs = NPCs.spawnAll();
  G.projectiles = [];
  G.particles = [];
  G.damageNums = [];
  G.loot = [];
  G.dayPhase = 0;
  G.time = 0;
  G.deathTimer = 0;
  G.ui.notification = null;
  G.ui.dialogue = null;
  G.ui.inventoryOpen = false;
  G.ui.mapOpen = false;
  G.ui.questLogOpen = false;
  G.ui.charSheetOpen = false;
  G.ui.merchantOpen = null;

  // Start camera at player
  const startX = G.player.x - CANVAS_W/2;
  const startY = G.player.y - CANVAS_H/2;
  G.camera.x = clamp(startX, 0, MAP_W*TILE_SIZE - CANVAS_W);
  G.camera.y = clamp(startY, 0, MAP_H*TILE_SIZE - CANVAS_H);
  G.targetCam.x = G.camera.x;
  G.targetCam.y = G.camera.y;

  // Show intro notification
  G.ui.notification = {
    text: 'You awaken in the ruins of Frostholm. Seek Elder Edda.',
    color: '#aabbcc',
    timer: 6
  };
}

// ── Camera ────────────────────────────────────────────────────
function updateCamera(dt) {
  const p = G.player;
  if (!p) return;
  const tx = p.x + Player.PLAYER_W/2 - CANVAS_W/2;
  const ty = p.y + Player.PLAYER_H/2 - CANVAS_H/2;
  G.targetCam.x = clamp(tx, 0, MAP_W*TILE_SIZE - CANVAS_W);
  G.targetCam.y = clamp(ty, 0, MAP_H*TILE_SIZE - CANVAS_H);
  G.camera.x += (G.targetCam.x - G.camera.x) * Math.min(1, dt * 8);
  G.camera.y += (G.targetCam.y - G.camera.y) * Math.min(1, dt * 8);
}

// ── Update ────────────────────────────────────────────────────
function update(dt) {
  G.time += dt;
  G.dayPhase = (G.dayPhase + dt * 0.01) % 1; // ~100s full day

  if (G.phase === 'intro') {
    G.introFade = Math.min(1, G.introFade + dt * 1.5);
    return;
  }

  const p = G.player;
  const overlayOpen = G.ui.inventoryOpen || G.ui.mapOpen || G.ui.questLogOpen || G.ui.charSheetOpen;
  const dialogueOpen = !!G.ui.dialogue;

  if (p && !p.dead && !overlayOpen && !dialogueOpen) {
    Player.update(p, dt, G);
    Combat.updateProjectiles(G, dt);
    Enemies.updateAll(G, dt);
    Enemies.updateLoot(G, dt);
    Quests.update(G);
  } else if (p && p.dead) {
    G.deathTimer += dt;
    if (G.deathTimer > 3) G.phase = 'dead';
  }

  Combat.updateParticles(G, dt);
  Combat.updateDamageNums(G, dt);
  updateCamera(dt);

  // Notification timer
  if (G.ui.notification) {
    G.ui.notification.timer -= dt;
    if (G.ui.notification.timer <= 0) G.ui.notification = null;
  }

  // Day/night fog-of-war update
  if (p) {
    const ptx = Math.floor((p.x+Player.PLAYER_W/2)/TILE_SIZE);
    const pty = Math.floor((p.y+Player.PLAYER_H/2)/TILE_SIZE);
    World.markExplored(ptx, pty, 8);
  }

  // Attack input (held left click during gameplay)
  if (G.mouse.down && !overlayOpen && !dialogueOpen && p && !p.dead) {
    if (p.weapon && (p.weapon.type==='bow'||p.weapon.type==='throwaxe')) {
      Combat.playerRangedAttack(G);
    } else {
      Combat.playerAttack(G);
    }
  }
}

// ── Render ────────────────────────────────────────────────────
function render() {
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  if (G.phase === 'title') {
    UI.drawTitle(ctx, G.time);
    return;
  }

  if (G.phase === 'classSelect') {
    UI.drawClassSelect(ctx, G.ui.selectedClass, G.time);
    return;
  }

  if (G.phase === 'intro') {
    UI.drawIntro(ctx, G.introPage, G.introFade, G.time);
    return;
  }

  if (G.phase === 'dead') {
    UI.drawDeath(ctx, G.deathTimer, G.time);
    return;
  }

  if (G.phase === 'win') {
    UI.drawWin(ctx, G, G.time);
    return;
  }

  if (G.phase !== 'playing') return;

  const cam = G.camera;

  // World
  World.draw(ctx, cam, G.time, G);
  World.drawWeather(ctx, G, G.time);

  // Loot on ground
  drawLoot(ctx, cam);

  // Entities
  NPCs.draw(ctx, G.npcs, cam, G.time);
  Enemies.draw(ctx, G.enemies, cam, G.time);
  Player.draw(ctx, G.player, cam, G.time);

  // Projectiles & particles
  Combat.drawProjectiles(ctx, G, cam);
  Combat.drawParticles(ctx, G, cam);
  Combat.drawDamageNums(ctx, G, cam);

  // Ambient light overlay
  Combat.drawAmbient(ctx, G);

  // Interact hints
  NPCs.drawInteractHint(ctx, G, cam, G.time);
  drawBonfireHint(ctx, cam);
  drawChestHint(ctx, cam);

  // HUD
  UI.drawHUD(ctx, G, G.time);

  // Minimap
  World.drawMinimap(ctx, G, G.time);

  // Overlays
  if (G.ui.inventoryOpen)  Inventory.draw(ctx, G);
  if (G.ui.mapOpen)        UI.drawFullMap(ctx, G);
  if (G.ui.questLogOpen)   Quests.draw(ctx, G);
  if (G.ui.charSheetOpen)  UI.drawCharSheet(ctx, G);
  if (G.ui.dialogue)       UI.drawDialogue(ctx, G, G.time);

  // Death overlay
  if (G.player && G.player.dead) {
    UI.drawDeath(ctx, G.deathTimer, G.time);
  }
}

function drawLoot(ctx, cam) {
  for (const l of G.loot) {
    const sx = l.x - cam.x, sy = l.y - cam.y;
    if (sx < -30 || sy < -30 || sx > CANVAS_W+30 || sy > CANVAS_H+30) continue;
    const pulse = 0.7 + Math.sin(G.time*4)*0.3;
    ctx.globalAlpha = pulse;
    ctx.fillStyle = l.item ? (l.item.rarity==='legendary'?'#FFD700':l.item.rarity==='rare'?'#8888ff':'#88ff88') : '#FFD700';
    ctx.beginPath();
    ctx.arc(sx+8, sy+8, 6, 0, Math.PI*2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function drawBonfireHint(ctx, cam) {
  if (!G.player || G.ui.dialogue) return;
  const p = G.player;
  for (const bf of World.bonfires) {
    const bx=bf.tx*TILE_SIZE+TILE_SIZE/2, by=bf.ty*TILE_SIZE+TILE_SIZE/2;
    const d = dist(p.x+Player.PLAYER_W/2, p.y+Player.PLAYER_H/2, bx, by);
    if (d < 72) {
      const sx = bx-cam.x, sy = by-cam.y-28;
      const pulse = 0.75+Math.sin(G.time*4)*0.25;
      ctx.globalAlpha = pulse;
      ctx.fillStyle = '#ffcc88';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('[F] Rest', sx, sy);
      ctx.globalAlpha = 1;
      return;
    }
  }
}

function drawChestHint(ctx, cam) {
  if (!G.player || G.ui.dialogue) return;
  const p = G.player;
  const ptx = Math.floor((p.x+Player.PLAYER_W/2)/TILE_SIZE);
  const pty = Math.floor((p.y+Player.PLAYER_H/2)/TILE_SIZE);
  for (let dx=-1;dx<=1;dx++) {
    for (let dy=-1;dy<=1;dy++) {
      const tx=ptx+dx, ty=pty+dy;
      if (tx<0||ty<0||tx>=MAP_W||ty>=MAP_H) continue;
      if (World.getTile(tx, ty)===T.CHEST) {
        const sx=tx*TILE_SIZE+TILE_SIZE/2-cam.x, sy=ty*TILE_SIZE-cam.y-10;
        const pulse=0.75+Math.sin(G.time*4)*0.25;
        ctx.globalAlpha=pulse;
        ctx.fillStyle='#FFD700';
        ctx.font='bold 11px monospace';
        ctx.textAlign='center';
        ctx.fillText('[E] Open',sx,sy);
        ctx.globalAlpha=1;
        return;
      }
    }
  }
}

// ── Game loop ─────────────────────────────────────────────────
let lastTime = 0;

function gameLoop(timestamp) {
  const rawDt = (timestamp - lastTime) / 1000;
  lastTime = timestamp;
  const dt = Math.min(rawDt, 0.05); // cap at 50ms

  if (G.phase === 'playing' || G.phase === 'dead' || G.phase === 'intro') {
    update(dt);
  }

  render();
  requestAnimationFrame(gameLoop);
}

// ── Boot ──────────────────────────────────────────────────────
window.addEventListener('load', async () => {
  // Resize canvas to fill window while preserving aspect ratio
  function resizeCanvas() {
    const scaleX = window.innerWidth / CANVAS_W;
    const scaleY = window.innerHeight / CANVAS_H;
    const scale = Math.min(scaleX, scaleY);
    canvas.style.width = Math.floor(CANVAS_W * scale) + 'px';
    canvas.style.height = Math.floor(CANVAS_H * scale) + 'px';
    canvas.style.position = 'absolute';
    canvas.style.left = ((window.innerWidth - CANVAS_W*scale)/2) + 'px';
    canvas.style.top = ((window.innerHeight - CANVAS_H*scale)/2) + 'px';
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.fillStyle = '#667788';
  ctx.font = '20px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('Loading sprites...', CANVAS_W / 2, CANVAS_H / 2);

  await Sprites.preload();

  requestAnimationFrame(ts => {
    lastTime = ts;
    requestAnimationFrame(gameLoop);
  });
});
