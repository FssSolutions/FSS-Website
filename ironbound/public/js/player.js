// ============================================================
//  player.js  —  Player creation, movement, stats, leveling
// ============================================================

const Player = (() => {

  const PLAYER_W = 28, PLAYER_H = 28;

  const CLASS_DEFS = {
    ironclad: {
      name:'Ironclad', color:'#4488cc',
      hp:120, stamina:80, speed:160,
      str:5, agi:2, end:4, pre:1,
      passiveDesc:'Takes 20% less damage',
      specialName:'Shield Bash',
      specialDesc:'Stuns enemy briefly',
      specialCooldown:6, startWeapon:'sword',
      damageMult: 0.8  // takes 20% less
    },
    duskwalker: {
      name:'Duskwalker', color:'#884488',
      hp:80, stamina:120, speed:210,
      str:2, agi:6, end:2, pre:4,
      passiveDesc:'25% movement speed bonus',
      specialName:'Shadow Step',
      specialDesc:'Dash through enemies',
      specialCooldown:4, startWeapon:'daggers',
      damageMult: 1.0
    },
    runebound: {
      name:'Runebound', color:'#44aa88',
      hp:95, stamina:100, speed:185,
      str:3, agi:3, end:3, pre:3,
      passiveDesc:'15% chance for bonus rune damage',
      specialName:'Rune Burst',
      specialDesc:'AoE melee explosion',
      specialCooldown:7, startWeapon:'runesword',
      damageMult: 1.0
    }
  };

  // XP table: xp needed to reach level N
  function xpForLevel(n) { return Math.floor(80 * Math.pow(n, 1.6)); }

  function create(playerClass) {
    const def = CLASS_DEFS[playerClass] || CLASS_DEFS.ironclad;
    return {
      x: 27 * TILE_SIZE, y: 27 * TILE_SIZE,
      w: PLAYER_W, h: PLAYER_H,
      playerClass,
      name: def.name,
      color: def.color,

      // Movement
      speed: def.speed,
      facing: 0,         // angle in radians
      moving: false,
      dodging: false,
      dodgeVx: 0, dodgeVy: 0,
      dodgeTimer: 0,
      dodgeCooldown: 0,
      invincible: 0,      // invincibility frames timer

      // Combat
      attackCooldown: 0,
      attackTimer: 0,     // visual attack flash timer
      attacking: false,
      specialCooldown: 0,
      specialMaxCooldown: def.specialCooldown,
      specialActive: false,
      specialTimer: 0,
      knockbackVx: 0, knockbackVy: 0,

      // Stats
      level: 1,
      xp: 0,
      xpNext: xpForLevel(2),
      hp: def.hp,
      maxHp: def.hp,
      stamina: def.stamina,
      maxStamina: def.stamina,
      str: def.str, agi: def.agi, end: def.end, pre: def.pre,
      statPoints: 0,
      damageMult: def.damageMult,

      // Derived
      get attackDamage() { return 8 + this.str * 3; },
      get attackSpeed()  { return 0.45 - this.agi * 0.02; }, // seconds per attack
      get critChance()   { return 0.05 + this.pre * 0.015; },
      get dodgeDist()    { return 120 + this.agi * 8; },

      // Class specific
      passiveDesc: def.passiveDesc,
      specialName: def.specialName,
      specialDesc: def.specialDesc,

      // Equipped
      weapon: null,    // set by Inventory after creation
      helm: null,
      chest: null,

      // Region effects
      onIce: false,
      nearLava: false,

      // Checkpoints
      lastBonfire: { tx:27, ty:27 },
      dead: false,
      deathTimer: 0
    };
  }

  function update(p, dt, G) {
    if (p.dead) {
      p.deathTimer -= dt;
      if (p.deathTimer <= 0) respawn(p, G);
      return;
    }

    // Timers
    if (p.attackCooldown  > 0) p.attackCooldown  -= dt;
    if (p.specialCooldown > 0) p.specialCooldown -= dt;
    if (p.invincible      > 0) p.invincible      -= dt;
    if (p.attackTimer     > 0) { p.attackTimer   -= dt; } else { p.attacking = false; }
    if (p.specialTimer    > 0) p.specialTimer    -= dt;

    // Stamina regen
    p.stamina = Math.min(p.maxStamina, p.stamina + 18 * dt);

    // Knockback decay
    p.knockbackVx *= 1 - Math.min(1, 12 * dt);
    p.knockbackVy *= 1 - Math.min(1, 12 * dt);

    // Dodge roll
    if (p.dodging) {
      p.dodgeTimer -= dt;
      if (p.dodgeTimer <= 0) { p.dodging = false; }
      else {
        const spd = p.dodgeDist / 0.28;
        const nx = p.x + p.dodgeVx * spd * dt;
        const ny = p.y + p.dodgeVy * spd * dt;
        if (World.isPassable(nx, p.y, p.w, p.h)) p.x = nx;
        if (World.isPassable(p.x, ny, p.w, p.h)) p.y = ny;
      }
    }

    // Normal movement
    if (!p.dodging) {
      const keys = G.keys;
      let dx=0, dy=0;
      if (keys['KeyW']||keys['ArrowUp'])    dy=-1;
      if (keys['KeyS']||keys['ArrowDown'])  dy= 1;
      if (keys['KeyA']||keys['ArrowLeft'])  dx=-1;
      if (keys['KeyD']||keys['ArrowRight']) dx= 1;

      // Check ice slow
      const ptx=Math.floor((p.x+p.w/2)/TILE_SIZE), pty=Math.floor((p.y+p.h/2)/TILE_SIZE);
      const onIce = World.getTile(ptx,pty)===T.ICE;
      p.onIce = onIce;
      const speedMod = onIce ? 0.55 : 1.0;
      const totalSpeed = p.speed * speedMod + p.knockbackVx * 0 + 0;

      if (dx!==0||dy!==0) {
        const n=normalize(dx,dy);
        const nx=p.x+n.x*totalSpeed*dt + p.knockbackVx*dt;
        const ny=p.y+n.y*totalSpeed*dt + p.knockbackVy*dt;
        if (World.isPassable(nx, p.y, p.w, p.h)) p.x=nx;
        if (World.isPassable(p.x, ny, p.w, p.h)) p.y=ny;
        p.moving = true;
      } else {
        p.moving = false;
        if (p.knockbackVx!==0||p.knockbackVy!==0) {
          const nx=p.x+p.knockbackVx*dt;
          const ny=p.y+p.knockbackVy*dt;
          if (World.isPassable(nx,p.y,p.w,p.h)) p.x=nx;
          if (World.isPassable(p.x,ny,p.w,p.h)) p.y=ny;
        }
      }

      // Clamp to world bounds
      p.x = clamp(p.x, 0, MAP_W*TILE_SIZE-p.w);
      p.y = clamp(p.y, 0, MAP_H*TILE_SIZE-p.h);
    }

    // Facing toward mouse (world coords)
    const mx = G.mouse.wx, my = G.mouse.wy;
    p.facing = Math.atan2(my - (p.y+p.h/2), mx - (p.x+p.w/2));

    // Mark explored
    const ptx=Math.floor((p.x+p.w/2)/TILE_SIZE), pty=Math.floor((p.y+p.h/2)/TILE_SIZE);
    World.markExplored(ptx,pty);

    // Lava damage
    const tileUnder = World.getTile(ptx,pty);
    if (tileUnder===T.LAVA) {
      p.hp -= 18*dt;
      if (p.hp<=0) die(p,G);
    }
  }

  function tryDodge(p, G) {
    if (p.dodging||p.dodgeCooldown>0||p.stamina<20) return;
    const keys=G.keys;
    let dx=0,dy=0;
    if (keys['KeyW']||keys['ArrowUp'])    dy=-1;
    if (keys['KeyS']||keys['ArrowDown'])  dy= 1;
    if (keys['KeyA']||keys['ArrowLeft'])  dx=-1;
    if (keys['KeyD']||keys['ArrowRight']) dx= 1;
    if (dx===0&&dy===0) { dx=Math.cos(p.facing); dy=Math.sin(p.facing); }
    const n=normalize(dx,dy);
    p.dodgeVx=n.x; p.dodgeVy=n.y;
    p.dodging=true;
    p.dodgeTimer=0.28;
    p.dodgeCooldown=0.7;
    p.invincible=0.28;
    p.stamina-=20;
    Audio.play('dodge');
  }

  function takeDamage(p, amount, G) {
    if (p.invincible>0||p.dead) return;
    const reduced = amount * p.damageMult;
    p.hp -= reduced;
    p.invincible=0.35;
    G.damageNums.push({
      x:p.x+p.w/2, y:p.y,
      val:Math.ceil(reduced), color:'#ff4444',
      vy:-80, life:1.2
    });
    Audio.play('hurt');
    if (p.hp<=0) die(p,G);
  }

  function heal(p, amount, G) {
    const prev=p.hp;
    p.hp=Math.min(p.maxHp,p.hp+amount);
    const healed=Math.ceil(p.hp-prev);
    if (healed>0) G.damageNums.push({
      x:p.x+p.w/2, y:p.y,
      val:healed, color:'#44ff88',
      vy:-70, life:1.2
    });
  }

  function die(p, G) {
    p.dead=true; p.hp=0;
    p.deathTimer=2.5;
    Audio.play('death');
  }

  function respawn(p, G) {
    const bf=p.lastBonfire;
    p.x=(bf.tx+0.5)*TILE_SIZE; p.y=(bf.ty+0.5)*TILE_SIZE;
    p.hp=p.maxHp; p.stamina=p.maxStamina;
    p.dead=false; p.deathTimer=0;
    p.knockbackVx=0; p.knockbackVy=0;
    // Respawn enemies in current region
    Enemies.respawnRegion(World.getRegionAt(p.x,p.y), G);
    G.ui.notification={text:'Respawned at bonfire.',color:'#aaddff',timer:3};
  }

  function gainXP(p, amount, G) {
    p.xp+=amount;
    G.damageNums.push({
      x:p.x+p.w/2+20, y:p.y-10,
      val:'+'+amount+'xp', color:'#aaff44', isText:true,
      vy:-55, life:1.5
    });
    while (p.xp >= p.xpNext && p.level < 20) levelUp(p,G);
  }

  function levelUp(p, G) {
    p.level++;
    p.xp -= p.xpNext;
    p.xpNext = xpForLevel(p.level+1);
    p.statPoints += 1;
    // Stat bonuses
    p.maxHp   += 8 + p.end;
    p.maxStamina += 4;
    p.hp = p.maxHp;
    p.stamina = p.maxStamina;
    Audio.play('levelup');
    G.ui.notification={text:'Level '+p.level+'! Stat point available (C)',color:'#ffffaa',timer:4};
  }

  function allocateStat(p, stat) {
    if (p.statPoints<=0) return;
    p[stat]++;
    p.statPoints--;
    if (stat==='end') { p.maxHp+=5; p.hp=Math.min(p.hp+5,p.maxHp); }
    Audio.play('menu');
  }

  function useSpecial(p, G) {
    if (p.specialCooldown>0||p.stamina<30) return;
    p.specialCooldown = p.specialMaxCooldown;
    p.stamina -= 30;

    if (p.playerClass==='ironclad') {
      // Shield Bash — push enemy in front, stun
      Combat.shieldBash(p, G);
      Audio.play('special');
    } else if (p.playerClass==='duskwalker') {
      // Shadow Step — dash, pass-through
      p.invincible=0.45;
      p.dodgeVx=Math.cos(p.facing); p.dodgeVy=Math.sin(p.facing);
      p.dodging=true; p.dodgeTimer=0.45;
      p.specialActive=true; p.specialTimer=0.45;
      Audio.play('special');
    } else if (p.playerClass==='runebound') {
      // Rune Burst — AoE
      Combat.runeBurst(p, G);
      p.specialActive=true; p.specialTimer=0.4;
      Audio.play('special');
    }
  }

  function draw(ctx, p, cam, time) {
    if (!p) return;
    const sx = p.x - cam.x, sy = p.y - cam.y;
    const cx = sx + p.w / 2, cy = sy + p.h / 2;

    // Ground shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(cx, sy + p.h + 2, p.w * 0.4, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    if (p.invincible > 0 && Math.floor(p.invincible * 12) % 2 === 0) return;

    const dead = p.dead;

    // Dodge ghost trail
    if (p.dodging) {
      const ta = (p.dodgeTimer / 0.25) * 0.35;
      ctx.globalAlpha = ta;
      ctx.fillStyle = p.color;
      ctx.fillRect(sx + 4, sy + 8, p.w - 8, p.h - 14);
      ctx.globalAlpha = 1;
    }

    // Draw sprite if available, else fall back to primitive (runebound / load fail)
    const dir = Sprites.angleToDir(p.facing);
    const sprite = Sprites.getPlayerSprite(p.playerClass, dir);
    if (sprite) {
      if (dead) ctx.globalAlpha = 0.4;
      ctx.drawImage(sprite, Math.round(cx - 34), Math.round(cy - 34), 68, 68);
      if (dead) ctx.globalAlpha = 1;
    } else {
      _drawPlayerPrimitive(ctx, p, sx, sy, cx, cy, time);
    }

    // Attack arc
    if (p.attacking) {
      const frac = p.attackTimer / 0.15;
      ctx.strokeStyle = `rgba(255,255,180,${frac * 0.8})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, 38, p.facing - 0.9, p.facing + 0.9);
      ctx.stroke();
      // Slash streaks
      ctx.strokeStyle = `rgba(255,255,255,${frac * 0.45})`;
      ctx.lineWidth = 2;
      for (let i = -1; i <= 1; i++) {
        const a = p.facing + i * 0.35;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * 14, cy + Math.sin(a) * 14);
        ctx.lineTo(cx + Math.cos(a) * 34, cy + Math.sin(a) * 34);
        ctx.stroke();
      }
    }

    // Rune burst ring
    if (p.specialActive && p.playerClass === 'runebound') {
      const frac = p.specialTimer / 0.4;
      ctx.strokeStyle = `rgba(80,255,180,${frac * 0.9})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(cx, cy, 70 * (1 - frac) + 20, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function _drawPlayerPrimitive(ctx, p, sx, sy, cx, cy, time) {
    const dead = p.dead;
    let bodyCol, headCol, limbCol, accentCol, weaponCol;
    if (dead) {
      bodyCol = headCol = limbCol = '#555'; accentCol = '#444'; weaponCol = '#444';
    } else if (p.playerClass === 'ironclad') {
      bodyCol = '#7a8faa'; headCol = '#8899bb'; limbCol = '#6a7f9a';
      accentCol = '#cc3333'; weaponCol = '#ddeeff';
    } else if (p.playerClass === 'duskwalker') {
      bodyCol = '#2a1f3a'; headCol = '#1e1530'; limbCol = '#3a2a4a';
      accentCol = '#aa7722'; weaponCol = '#7b5010';
    } else {
      bodyCol = '#1a3a88'; headCol = '#2244aa'; limbCol = '#1a3088';
      accentCol = '#44ccff'; weaponCol = '#6b4a10';
    }

    const isMoving = p.vx || p.vy;
    const walkCycle = (isMoving && !dead) ? Math.sin(time * 8) : 0;
    const legLift = walkCycle * 2.5;

    // Legs
    ctx.fillStyle = limbCol;
    ctx.fillRect(cx - 9, sy + p.h * 0.56 + legLift, 8, 12);
    ctx.fillRect(cx + 1, sy + p.h * 0.56 - legLift, 8, 12);
    // Boots
    if (!dead) {
      ctx.fillStyle = '#553322';
      ctx.fillRect(cx - 10, sy + p.h * 0.56 + legLift + 9, 10, 5);
      ctx.fillRect(cx, sy + p.h * 0.56 - legLift + 9, 10, 5);
    }

    // Body
    ctx.fillStyle = bodyCol;
    ctx.fillRect(cx - 10, sy + p.h * 0.26, 20, p.h * 0.42);

    // Class chest detail
    if (!dead) {
      if (p.playerClass === 'ironclad') {
        ctx.fillStyle = '#99aacc';
        ctx.fillRect(cx - 7, sy + p.h * 0.28, 14, 8);
        ctx.fillStyle = accentCol;
        ctx.fillRect(cx - 3, sy + p.h * 0.28, 6, 3);
      } else if (p.playerClass === 'duskwalker') {
        ctx.fillStyle = accentCol;
        ctx.fillRect(cx - 9, sy + p.h * 0.27, 2, p.h * 0.4);
        ctx.fillRect(cx + 7, sy + p.h * 0.27, 2, p.h * 0.4);
      } else {
        ctx.fillStyle = accentCol;
        ctx.font = 'bold 10px serif';
        ctx.textAlign = 'center';
        ctx.fillText('✦', cx, sy + p.h * 0.48);
      }
    }

    // Arms
    ctx.fillStyle = limbCol;
    ctx.fillRect(cx - 15, sy + p.h * 0.28 + (-legLift * 0.5), 6, 11);
    ctx.fillRect(cx + 9, sy + p.h * 0.28 + (legLift * 0.5), 6, 11);

    // Head
    ctx.fillStyle = headCol;
    ctx.beginPath();
    ctx.arc(cx, sy + p.h * 0.17, 10, 0, Math.PI * 2);
    ctx.fill();

    if (!dead) {
      if (p.playerClass === 'ironclad') {
        ctx.fillStyle = '#223355';
        ctx.fillRect(cx - 8, sy + p.h * 0.13, 16, 5);
        ctx.fillStyle = accentCol;
        ctx.fillRect(cx - 2, sy + p.h * 0.06, 4, 7);
      } else if (p.playerClass === 'duskwalker') {
        ctx.fillStyle = 'rgba(10,5,20,0.72)';
        ctx.beginPath();
        ctx.arc(cx, sy + p.h * 0.18, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ddaa44';
        ctx.fillRect(cx - 4, sy + p.h * 0.15, 2, 2);
        ctx.fillRect(cx + 2, sy + p.h * 0.15, 2, 2);
      } else {
        ctx.fillStyle = accentCol;
        ctx.beginPath(); ctx.arc(cx, sy + p.h * 0.12, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(68,204,255,0.4)';
        ctx.beginPath(); ctx.arc(cx, sy + p.h * 0.12, 5, 0, Math.PI * 2); ctx.fill();
      }
    }

    // Weapon
    if (!dead) {
      const swingR = p.attacking ? Math.sin(p.attackTimer * 28) * 0.35 : 0;
      if (p.playerClass === 'ironclad') {
        ctx.save();
        ctx.translate(cx + 14, sy + p.h * 0.3);
        ctx.rotate(0.25 + swingR);
        ctx.fillStyle = weaponCol;
        ctx.fillRect(-2, -16, 4, 25);
        ctx.fillStyle = '#8B6914';
        ctx.fillRect(-6, -3, 12, 4);
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(-1, -18, 2, 4);
        ctx.restore();
        // Shield
        ctx.fillStyle = '#8899bb';
        ctx.beginPath();
        ctx.ellipse(cx - 17, sy + p.h * 0.36, 5, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = accentCol;
        ctx.fillRect(cx - 19, sy + p.h * 0.34, 4, 2);
      } else if (p.playerClass === 'duskwalker') {
        ctx.save();
        ctx.translate(cx + 17, sy + p.h * 0.35);
        ctx.strokeStyle = weaponCol;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 11, -Math.PI * 0.55, Math.PI * 0.55);
        ctx.stroke();
        ctx.strokeStyle = '#cccc88';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(Math.cos(-Math.PI * 0.55) * 11, Math.sin(-Math.PI * 0.55) * 11);
        ctx.lineTo(Math.cos(Math.PI * 0.55) * 11, Math.sin(Math.PI * 0.55) * 11);
        ctx.stroke();
        ctx.restore();
      } else {
        ctx.save();
        ctx.translate(cx + 15, sy + p.h * 0.18);
        ctx.rotate(-0.15);
        ctx.fillStyle = weaponCol;
        ctx.fillRect(-2, -6, 4, p.h * 0.95);
        const orbGlow = 0.6 + Math.sin(time * 3) * 0.4;
        ctx.fillStyle = accentCol;
        ctx.beginPath(); ctx.arc(0, -7, 6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `rgba(68,204,255,${orbGlow * 0.45})`;
        ctx.beginPath(); ctx.arc(0, -7, 10, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    }
  }

  return {
    PLAYER_W, PLAYER_H, CLASS_DEFS,
    create, update, draw,
    tryDodge, takeDamage, heal, gainXP, allocateStat, useSpecial
  };
})();
