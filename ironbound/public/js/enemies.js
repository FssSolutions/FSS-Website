// ============================================================
//  enemies.js  —  Enemy types, AI, spawning, rendering
// ============================================================

const Enemies = (() => {

  // Enemy type definitions
  const TYPES = {
    soldier: {
      name:'Iron Soldier', color:'#aa2222', size:26,
      hp:30, damage:8, speed:95, xp:15, gold:[2,6],
      region:'frostholm', level:1, range:36, attackCD:1.4,
      detect:200, patrol:120, shape:'rect'
    },
    wolf: {
      name:'Tundra Wolf', color:'#8899aa', size:22,
      hp:20, damage:6, speed:130, xp:10, gold:[0,2],
      region:'frostholm', level:1, range:30, attackCD:1.0,
      detect:180, patrol:150, shape:'ellipse'
    },
    bandit: {
      name:'Bandit', color:'#8B6914', size:24,
      hp:45, damage:12, speed:105, xp:22, gold:[4,10],
      region:'thornwood', level:3, range:34, attackCD:1.3,
      detect:220, patrol:130, shape:'rect'
    },
    direwolf: {
      name:'Dire Wolf', color:'#445566', size:32,
      hp:70, damage:18, speed:155, xp:35, gold:[2,5],
      region:'thornwood', level:4, range:40, attackCD:1.1,
      detect:240, patrol:180, shape:'ellipse'
    },
    guardian: {
      name:'Ruins Guardian', color:'#553366', size:28,
      hp:80, damage:20, speed:80, xp:40, gold:[6,14],
      region:'greyspire', level:6, range:38, attackCD:1.8,
      detect:190, patrol:100, shape:'diamond'
    },
    heavysoldier: {
      name:'Heavy Soldier', color:'#882222', size:30,
      hp:100, damage:25, speed:75, xp:50, gold:[8,16],
      region:'greyspire', level:7, range:40, attackCD:2.0,
      detect:200, patrol:110, shape:'rect'
    },
    eliteguard: {
      name:'Elite Guard', color:'#cc2200', size:30,
      hp:130, damage:30, speed:110, xp:65, gold:[12,22],
      region:'ashfeld', level:10, range:42, attackCD:1.2,
      detect:250, patrol:140, shape:'rect'
    },
    ironguard: {
      name:'Iron Guard', color:'#330000', size:34,
      hp:180, damage:38, speed:90, xp:80, gold:[15,28],
      region:'ashfeld', level:12, range:44, attackCD:1.6,
      detect:260, patrol:120, shape:'diamond'
    },
    direwolfboss: {
      name:'Beast of Thornwood', color:'#223344', size:44,
      hp:300, damage:22, speed:145, xp:200, gold:[20,40],
      region:'thornwood', level:5, range:52, attackCD:1.2,
      detect:300, patrol:200, shape:'ellipse', boss:true
    },
    aldric: {
      name:'Aldric the Iron', color:'#110011', size:40,
      hp:600, damage:45, speed:100, xp:1000, gold:[100,150],
      region:'ashfeld', level:20, range:50, attackCD:1.0,
      detect:320, patrol:60, shape:'rect', boss:true
    }
  };

  // Spawn configurations per region
  const SPAWN_CONFIGS = {
    frostholm: [
      {type:'soldier',  count:14, radius:80},
      {type:'wolf',     count:10, radius:100}
    ],
    thornwood: [
      {type:'bandit',   count:14, radius:90},
      {type:'direwolf', count:8,  radius:110}
    ],
    greyspire: [
      {type:'guardian',     count:12, radius:85},
      {type:'heavysoldier', count:8,  radius:90}
    ],
    ashfeld: [
      {type:'eliteguard', count:12, radius:80},
      {type:'ironguard',  count:8,  radius:70}
    ]
  };

  // Region tile bounds
  const REGION_BOUNDS = {
    frostholm:    {tx:0,   ty:0,   bx:99,  by:99},
    thornwood:    {tx:100, ty:0,   bx:199, by:99},
    greyspire:    {tx:0,   ty:100, bx:99,  by:199},
    ashfeld:      {tx:100, ty:100, bx:199, by:199}
  };

  const AI = { IDLE:0, PATROL:1, CHASE:2, ATTACK:3, FLEE:4, DEAD:5 };
  let eid = 0;

  function spawnEnemy(type, wx, wy) {
    const def = TYPES[type];
    if (!def) return null;
    return {
      id: eid++,
      type, name:def.name, color:def.color,
      x:wx, y:wy, w:def.size, h:def.size,
      hp: def.hp, maxHp: def.hp,
      damage: def.damage, speed: def.speed,
      xpReward: def.xp, goldMin:def.gold[0], goldMax:def.gold[1],
      level: def.level, detect:def.detect,
      attackRange:def.range, attackCD:def.attackCD, attackTimer:0,
      patrol:def.patrol, shape:def.shape,
      boss: def.boss||false,

      // AI state
      state: AI.IDLE,
      patrolCX: wx, patrolCY: wy,
      patrolTX: wx, patrolTY: wy,
      patrolTimer: rnd(1,4),
      stateTimer: 0,
      stunTimer: 0,
      knockVx:0, knockVy:0,

      // Visual
      alive: true,
      dying: false, dyingTimer: 0,
      hitFlash: 0,
      facing: Math.PI/2,
      spawnedLoot: false
    };
  }

  function findSpawnPos(region) {
    const b = REGION_BOUNDS[region];
    for (let tries=0; tries<50; tries++) {
      const tx = rndInt(b.tx+5, b.bx-5);
      const ty = rndInt(b.ty+5, b.by-5);
      const wx = tx*TILE_SIZE, wy = ty*TILE_SIZE;
      if (World.isPassable(wx, wy, 28, 28)) return {wx, wy};
    }
    return null;
  }

  function spawnAll() {
    const list = [];
    for (const [region, configs] of Object.entries(SPAWN_CONFIGS)) {
      for (const cfg of configs) {
        for (let i=0; i<cfg.count; i++) {
          const pos = findSpawnPos(region);
          if (pos) {
            const e = spawnEnemy(cfg.type, pos.wx, pos.wy);
            if (e) list.push(e);
          }
        }
      }
    }

    // Special boss spawns
    const direwolfPos = {wx:162*TILE_SIZE, wy:56*TILE_SIZE};
    const dw = spawnEnemy('direwolfboss', direwolfPos.wx, direwolfPos.wy);
    if (dw) list.push(dw);

    const aldricPos = {wx:167*TILE_SIZE, wy:167*TILE_SIZE};
    const al = spawnEnemy('aldric', aldricPos.wx, aldricPos.wy);
    if (al) list.push(al);

    return list;
  }

  function respawnRegion(region, G) {
    // Remove dead enemies in region, respawn them
    G.enemies = G.enemies.filter(e => !(!e.alive && World.getRegionAt(e.x,e.y)===region));
    const configs = SPAWN_CONFIGS[region] || [];
    for (const cfg of configs) {
      // Count living enemies of this type in region
      const living = G.enemies.filter(e=>e.type===cfg.type&&e.alive&&World.getRegionAt(e.x,e.y)===region).length;
      const need = Math.max(0, Math.floor(cfg.count/2) - living);
      for (let i=0;i<need;i++) {
        const pos = findSpawnPos(region);
        if (pos) {
          const e = spawnEnemy(cfg.type, pos.wx, pos.wy);
          if (e) G.enemies.push(e);
        }
      }
    }
  }

  // ── AI update ────────────────────────────────────────────
  function updateEnemy(e, dt, G) {
    if (!e.alive) {
      if (e.dying) {
        e.dyingTimer -= dt;
        if (e.dyingTimer <= 0) e.dying = false; // fully gone — draw will skip it
      }
      return;
    }

    if (e.stunTimer > 0) { e.stunTimer -= dt; return; }

    // Knockback decay
    e.knockVx *= 1 - Math.min(1, 10*dt);
    e.knockVy *= 1 - Math.min(1, 10*dt);
    if (e.hitFlash > 0) e.hitFlash -= dt;
    if (e.attackTimer > 0) e.attackTimer -= dt;

    const p = G.player;
    if (!p || p.dead) return;

    const dx = p.x + Player.PLAYER_W/2 - (e.x + e.w/2);
    const dy = p.y + Player.PLAYER_H/2 - (e.y + e.h/2);
    const d  = Math.sqrt(dx*dx + dy*dy);

    // Boss phase transitions
    if (e.type==='aldric') updateAldric(e, d, dx, dy, dt, G);
    else updateStandardAI(e, d, dx, dy, dt, G);

    // Apply knockback
    const nx = e.x + e.knockVx*dt;
    const ny = e.y + e.knockVy*dt;
    if (World.isPassable(nx, e.y, e.w, e.h)) e.x=nx;
    if (World.isPassable(e.x, ny, e.w, e.h)) e.y=ny;
  }

  function updateStandardAI(e, d, dx, dy, dt, G) {
    const p = G.player;

    switch(e.state) {
      case AI.IDLE:
        e.patrolTimer -= dt;
        if (e.patrolTimer <= 0) { e.state=AI.PATROL; e.patrolTimer=rnd(2,5); setNewPatrolTarget(e); }
        if (d < e.detect) e.state=AI.CHASE;
        break;

      case AI.PATROL:
        moveToward(e, e.patrolTX, e.patrolTY, e.speed*0.5, dt);
        const pd=dist(e.x,e.y,e.patrolTX,e.patrolTY);
        if (pd<8) { e.state=AI.IDLE; e.patrolTimer=rnd(1,3); }
        if (d<e.detect) e.state=AI.CHASE;
        break;

      case AI.CHASE:
        if (d > e.detect*1.4) { e.state=AI.PATROL; break; }
        if (d < e.attackRange) { e.state=AI.ATTACK; break; }
        moveToward(e, p.x+Player.PLAYER_W/2, p.y+Player.PLAYER_H/2, e.speed, dt);
        break;

      case AI.ATTACK:
        if (d > e.attackRange + 20) { e.state=AI.CHASE; break; }
        if (e.attackTimer <= 0) {
          doAttack(e, G);
          e.attackTimer = e.attackCD;
        }
        e.facing = Math.atan2(dy, dx);
        // Shuffle slightly
        const ang2 = Math.atan2(dy,dx) + Math.PI/2;
        const nx2=e.x+Math.cos(ang2)*30*dt, ny2=e.y+Math.sin(ang2)*30*dt;
        if (World.isPassable(nx2,e.y,e.w,e.h)) e.x=nx2;
        if (World.isPassable(e.x,ny2,e.w,e.h)) e.y=ny2;
        break;
    }

    // Low HP flee (non-boss)
    if (!e.boss && e.hp < e.maxHp*0.2 && e.state!==AI.FLEE) {
      e.state=AI.FLEE;
    }
    if (e.state===AI.FLEE) {
      const nx=e.x-dx/d*e.speed*dt, ny=e.y-dy/d*e.speed*dt;
      if (World.isPassable(nx,e.y,e.w,e.h)) e.x=nx;
      if (World.isPassable(e.x,ny,e.w,e.h)) e.y=ny;
      e.facing = Math.atan2(-dy, -dx);
    }
  }

  function updateAldric(e, d, dx, dy, dt, G) {
    // 3 phases based on HP
    const hpFrac = e.hp / e.maxHp;
    const phase = hpFrac > 0.6 ? 1 : hpFrac > 0.3 ? 2 : 3;
    const speedMult = [1, 1.3, 1.6][phase-1];
    const atkMult   = [1, 0.8, 0.65][phase-1]; // faster attacks in later phases

    e.speed = TYPES.aldric.speed * speedMult;
    const curAtkCD = TYPES.aldric.attackCD * atkMult;

    if (d > e.attackRange + 15) {
      moveToward(e, G.player.x+Player.PLAYER_W/2, G.player.y+Player.PLAYER_H/2, e.speed, dt);
    } else {
      if (e.attackTimer <= 0) {
        doAttack(e, G);
        e.attackTimer = curAtkCD;
      }
      // Phase 3: also dash
      if (phase===3 && e.attackTimer < curAtkCD*0.3) {
        const n=normalize(dx,dy);
        const nx=e.x+n.x*200*dt, ny=e.y+n.y*200*dt;
        if (World.isPassable(nx,e.y,e.w,e.h)) e.x=nx;
        if (World.isPassable(e.x,ny,e.w,e.h)) e.y=ny;
      }
    }
    e.facing = Math.atan2(dy, dx);
    e.state = d < e.detect ? AI.CHASE : AI.PATROL;
  }

  function moveToward(e, tx, ty, speed, dt) {
    const dx=tx-e.x, dy=ty-e.y;
    const d=Math.sqrt(dx*dx+dy*dy)||0.001;
    const nx=e.x+dx/d*speed*dt, ny=e.y+dy/d*speed*dt;
    if (World.isPassable(nx,e.y,e.w,e.h)) e.x=nx;
    if (World.isPassable(e.x,ny,e.w,e.h)) e.y=ny;
    e.facing = Math.atan2(dy, dx);
  }

  function setNewPatrolTarget(e) {
    const angle=rnd(0,Math.PI*2);
    const r=rnd(30,e.patrol);
    e.patrolTX = e.patrolCX + Math.cos(angle)*r;
    e.patrolTY = e.patrolCY + Math.sin(angle)*r;
  }

  function doAttack(e, G) {
    const p=G.player;
    if (!p||p.dead) return;
    const d=dist(e.x+e.w/2,e.y+e.h/2,p.x+Player.PLAYER_W/2,p.y+Player.PLAYER_H/2);
    if (d<=e.attackRange+10) {
      Player.takeDamage(p, e.damage * (0.9+Math.random()*0.2), G);
      Audio.play('hit');
    }
  }

  function takeDamage(e, amount, knockDx, knockDy, G) {
    if (!e.alive||e.dying) return;
    e.hp -= amount;
    e.hitFlash = 0.12;
    e.knockVx = knockDx * 220;
    e.knockVy = knockDy * 220;
    e.state = AI.CHASE;

    G.damageNums.push({
      x:e.x+e.w/2, y:e.y,
      val:Math.ceil(amount),
      color: amount>30 ? '#ffaa00' : '#ffffff',
      vy:-70, life:1.0
    });
    Audio.play('hit');

    if (e.hp <= 0) killEnemy(e, G);
  }

  function killEnemy(e, G) {
    e.alive=false; e.dying=true; e.dyingTimer=0.6; e.hp=0;
    Audio.play('death');
    Player.gainXP(G.player, e.xpReward, G);
    dropLoot(e, G);
    Quests.onEnemyKilled(e, G);
  }

  function dropLoot(e, G) {
    if (e.spawnedLoot) return;
    e.spawnedLoot=true;
    const gold=rndInt(e.goldMin,e.goldMax);
    G.loot.push({x:e.x+e.w/2-8,y:e.y+e.h/2-8,w:16,h:16,gold,item:null,life:30,pulse:0});
    // Random item drop
    if (Math.random()<0.18) {
      const drop=Inventory.randomDrop(e.level);
      if (drop) G.loot.push({x:e.x+e.w/2+4,y:e.y+e.h/2-8,w:16,h:16,gold:0,item:drop,life:30,pulse:0});
    }
  }

  function updateLoot(G, dt) {
    for (const l of G.loot) {
      l.life-=dt;
      l.pulse+=dt;
      // Auto-pickup when player is close
      if (G.player && !G.player.dead) {
        const d=dist(G.player.x+Player.PLAYER_W/2,G.player.y+Player.PLAYER_H/2,l.x+l.w/2,l.y+l.h/2);
        if (d<28) {
          if (l.gold>0) {
            G.player.gold=(G.player.gold||0)+l.gold;
            G.damageNums.push({x:l.x,y:l.y,val:'+'+l.gold+'g',color:'#FFD700',isText:true,vy:-55,life:1.2});
            l.life=0;
          }
          if (l.item) {
            const added=Inventory.addItem(G.player,l.item);
            if (added) {
              G.ui.notification={text:'Found: '+l.item.name,color:'#aaffaa',timer:2.5};
              l.life=0;
            }
          }
        }
      }
    }
    G.loot=G.loot.filter(l=>l.life>0);
  }

  function stun(e, duration) { e.stunTimer=duration; }

  // ── Draw helpers ─────────────────────────────────────────
  function _drawWolf(ctx, e, sx, sy, cx, cy, flash, time) {
    const walk = e.state === 'chase' ? Math.sin(time * 10) * 2 : 0;
    const bodyCol = flash ? '#ffffff' : e.color;
    const darkCol = flash ? '#ffffff' : adjustRGB([40, 40, 40], 0);

    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(cx + 2, cy + e.h * 0.42, e.w * 0.44, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Tail
    ctx.fillStyle = bodyCol;
    ctx.beginPath(); ctx.arc(sx + e.w * 0.1, cy - walk, 5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(sx + e.w * 0.04, cy - 4 - walk, 3.5, 0, Math.PI * 2); ctx.fill();

    // Four legs
    ctx.fillStyle = flash ? '#fff' : (e.color.includes('8ab') ? '#5a7a95' : '#3a4a22');
    ctx.fillRect(cx - 8, cy + 4 + walk, 5, 8);
    ctx.fillRect(cx + 3, cy + 4 - walk, 5, 8);
    ctx.fillRect(cx - 13, cy + 2 - walk, 5, 8);
    ctx.fillRect(cx - 2, cy + 2 + walk, 5, 8);

    // Body
    ctx.fillStyle = bodyCol;
    ctx.beginPath();
    ctx.ellipse(cx - 2, cy - 2, e.w * 0.42, e.h * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.beginPath();
    ctx.ellipse(cx + e.w * 0.3, cy - 4, 9, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    // Snout
    ctx.beginPath();
    ctx.ellipse(cx + e.w * 0.3 + 7, cy - 3, 5, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Eye
    ctx.fillStyle = flash ? '#fff' : '#ff4422';
    ctx.beginPath(); ctx.arc(cx + e.w * 0.3 + 1, cy - 7, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(cx + e.w * 0.3 + 1, cy - 7, 1.2, 0, Math.PI * 2); ctx.fill();
    // Ear
    ctx.fillStyle = bodyCol;
    ctx.beginPath();
    ctx.moveTo(cx + e.w * 0.28, cy - 11);
    ctx.lineTo(cx + e.w * 0.34, cy - 16);
    ctx.lineTo(cx + e.w * 0.4, cy - 10);
    ctx.closePath(); ctx.fill();

    if (e.type === 'pack_leader') {
      ctx.fillStyle = 'rgba(255,120,0,0.55)';
      ctx.beginPath(); ctx.arc(cx - 2, cy - 2, 6, 0, Math.PI * 2); ctx.fill();
    }
  }

  function _drawSoldier(ctx, e, sx, sy, cx, cy, flash, time) {
    const walk = e.state === 'chase' ? Math.sin(time * 7) * 2 : 0;
    let armC, helmC, accentC;
    if (flash) {
      armC = helmC = accentC = '#ffffff';
    } else if (e.type === 'garrison_archer') {
      armC = '#556633'; helmC = '#445522'; accentC = '#88aa44';
    } else if (e.type === 'garrison_scout') {
      armC = '#334455'; helmC = '#223344'; accentC = '#4488aa';
    } else if (e.type === 'garrison_paladin') {
      armC = '#aa8844'; helmC = '#cc9955'; accentC = '#ffdd88';
    } else {
      armC = '#667788'; helmC = '#556677'; accentC = '#8899aa';
    }

    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(cx, sy + e.h + 1, e.w * 0.37, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Legs
    ctx.fillStyle = armC;
    ctx.fillRect(cx - 8, sy + e.h * 0.58 + walk, 7, 11);
    ctx.fillRect(cx + 1, sy + e.h * 0.58 - walk, 7, 11);

    // Body
    ctx.fillStyle = armC;
    ctx.fillRect(cx - 9, sy + e.h * 0.28, 18, e.h * 0.42);
    // Chest plate
    ctx.fillStyle = accentC;
    ctx.fillRect(cx - 6, sy + e.h * 0.3, 12, 7);

    // Arms
    ctx.fillStyle = armC;
    ctx.fillRect(cx - 14, sy + e.h * 0.3 - walk * 0.4, 6, 10);
    ctx.fillRect(cx + 8, sy + e.h * 0.3 + walk * 0.4, 6, 10);

    // Head/helmet
    ctx.fillStyle = helmC;
    ctx.beginPath(); ctx.arc(cx, sy + e.h * 0.17, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = accentC;
    ctx.fillRect(cx - 7, sy + e.h * 0.14, 14, 4);
    ctx.fillStyle = '#00000088';
    ctx.fillRect(cx - 5, sy + e.h * 0.15, 10, 2);

    // Weapon per type
    if (e.type === 'garrison_archer') {
      ctx.strokeStyle = flash ? '#fff' : '#7b5010';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx + 12, cy - 2, 10, -Math.PI * 0.5, Math.PI * 0.5);
      ctx.stroke();
      ctx.strokeStyle = flash ? '#fff' : '#cccc88';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx + 12, cy - 12); ctx.lineTo(cx + 12, cy + 8); ctx.stroke();
    } else if (e.type === 'garrison_paladin') {
      ctx.fillStyle = flash ? '#fff' : '#aaa';
      ctx.fillRect(cx + 10, sy + e.h * 0.18, 4, e.h * 0.52);
      ctx.fillStyle = flash ? '#fff' : '#ccc';
      ctx.fillRect(cx + 7, sy + e.h * 0.15, 10, 8);
      ctx.fillStyle = flash ? '#fff' : helmC;
      ctx.beginPath(); ctx.ellipse(cx - 17, cy + 2, 7, 9, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = flash ? '#fff' : accentC;
      ctx.font = 'bold 8px serif'; ctx.textAlign = 'center';
      ctx.fillText('+', cx - 17, cy + 5);
    } else {
      ctx.fillStyle = flash ? '#fff' : '#ccccdd';
      ctx.fillRect(cx + 11, sy + e.h * 0.2, 3, e.h * 0.55);
      ctx.fillStyle = flash ? '#fff' : '#8B6914';
      ctx.fillRect(cx + 8, sy + e.h * 0.3, 9, 3);
    }

    if (e.stunTimer > 0) {
      ctx.fillStyle = '#ffff00'; ctx.font = '12px serif';
      ctx.textAlign = 'center';
      ctx.fillText('★', cx, sy - 3);
    }
  }

  function _drawAldric(ctx, e, sx, sy, cx, cy, flash, time) {
    const hpFrac = e.hp / e.maxHp;
    const phase = hpFrac > 0.6 ? 1 : hpFrac > 0.3 ? 2 : 3;
    const pulse = 0.7 + Math.sin(time * 4) * 0.3;

    if (phase > 1) {
      ctx.fillStyle = phase === 3 ? `rgba(255,0,0,${0.14*pulse})` : `rgba(255,100,0,${0.11*pulse})`;
      ctx.beginPath(); ctx.arc(cx, cy, e.w * 0.82, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(cx, sy + e.h + 2, e.w * 0.42, 6, 0, 0, Math.PI * 2); ctx.fill();

    let armC, capeC, glowC;
    if (flash) { armC = capeC = glowC = '#ffffff'; }
    else if (phase === 3) { armC = '#660000'; capeC = '#880000'; glowC = '#ff2222'; }
    else if (phase === 2) { armC = '#883300'; capeC = '#aa4400'; glowC = '#ff6600'; }
    else { armC = '#332244'; capeC = '#221133'; glowC = '#aa66ff'; }

    // Cape
    ctx.fillStyle = capeC;
    ctx.beginPath();
    ctx.moveTo(cx, sy + e.h * 0.15);
    ctx.lineTo(cx - e.w * 0.7, sy + e.h * 0.92);
    ctx.lineTo(cx + e.w * 0.7, sy + e.h * 0.92);
    ctx.closePath(); ctx.fill();

    const walk = e.state === 'chase' ? Math.sin(time * 6) * 3 : 0;
    ctx.fillStyle = armC;
    ctx.fillRect(cx - 12, sy + e.h * 0.58 + walk, 10, 16);
    ctx.fillRect(cx + 2, sy + e.h * 0.58 - walk, 10, 16);

    // Body
    ctx.fillStyle = armC;
    ctx.fillRect(cx - 15, sy + e.h * 0.25, 30, e.h * 0.44);
    ctx.fillStyle = `rgba(${phase===3?'255,80,80':phase===2?'255,140,60':'180,120,255'},0.38)`;
    ctx.fillRect(cx - 12, sy + e.h * 0.27, 24, 8);

    // Arms + pauldrons
    ctx.fillStyle = armC;
    ctx.fillRect(cx - 22, sy + e.h * 0.27, 8, 16);
    ctx.fillRect(cx + 14, sy + e.h * 0.27, 8, 16);
    ctx.fillStyle = phase === 3 ? '#990000' : phase === 2 ? '#aa5500' : '#554488';
    ctx.beginPath(); ctx.arc(cx - 18, sy + e.h * 0.28, 7, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 18, sy + e.h * 0.28, 7, 0, Math.PI * 2); ctx.fill();

    // Head
    ctx.fillStyle = armC;
    ctx.beginPath(); ctx.arc(cx, sy + e.h * 0.14, 13, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = phase > 1 ? glowC : '#223355';
    ctx.fillRect(cx - 10, sy + e.h * 0.1, 20, 7);
    if (phase > 1) {
      ctx.fillStyle = `rgba(255,255,200,${0.8 * pulse})`;
      ctx.fillRect(cx - 8, sy + e.h * 0.11, 16, 4);
    }

    // Crown
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(cx - 11, sy + e.h * 0.04, 22, 5);
    for (let i = 0; i < 5; i++) {
      const csx = cx - 9 + i * 5;
      ctx.beginPath();
      ctx.moveTo(csx, sy + e.h * 0.04);
      ctx.lineTo(csx + 2.5, sy + e.h * 0.04 - 6 - (i % 2) * 2);
      ctx.lineTo(csx + 5, sy + e.h * 0.04);
      ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = '#ff4444';
    ctx.beginPath(); ctx.arc(cx, sy + e.h * 0.04 + 2, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#4444ff';
    ctx.beginPath(); ctx.arc(cx - 7, sy + e.h * 0.04 + 2, 1.8, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 7, sy + e.h * 0.04 + 2, 1.8, 0, Math.PI * 2); ctx.fill();

    // Greatsword
    ctx.fillStyle = flash ? '#fff' : (phase === 3 ? '#ff4422' : '#8899bb');
    ctx.fillRect(cx + 18, sy - 5, 5, e.h * 0.85);
    ctx.fillStyle = flash ? '#fff' : '#8B6914';
    ctx.fillRect(cx + 13, sy + e.h * 0.2, 15, 5);
    if (phase > 1) {
      ctx.fillStyle = `rgba(${phase===3?'255,100,0':'255,180,80'},${0.5*pulse})`;
      ctx.fillRect(cx + 17, sy - 5, 7, e.h * 0.85);
    }

    // Phase energy arcs
    if (phase > 1) {
      const savedAlpha = ctx.globalAlpha;
      ctx.strokeStyle = glowC;
      ctx.lineWidth = 2;
      ctx.globalAlpha = savedAlpha * pulse * 0.8;
      for (let i = 0; i < 3; i++) {
        const a = time * 3 + i * 2.1;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * 16, cy + Math.sin(a) * 16);
        ctx.lineTo(cx + Math.cos(a + 0.5) * 32, cy + Math.sin(a + 0.5) * 32);
        ctx.stroke();
      }
      ctx.globalAlpha = savedAlpha;
    }

    if (e.stunTimer > 0) {
      ctx.fillStyle = '#ffff00'; ctx.font = 'bold 13px serif';
      ctx.textAlign = 'center'; ctx.fillText('★★', cx, sy - 8);
    }
  }

  // ── Draw ─────────────────────────────────────────────────
  function draw(ctx, enemies, cam, time) {
    for (const e of enemies) {
      if (!e.alive && !e.dying) continue;
      const sx=e.x-cam.x, sy=e.y-cam.y;
      if (sx<-80||sy<-80||sx>CANVAS_W+80||sy>CANVAS_H+80) continue;

      const alpha = e.dying ? Math.max(0, e.dyingTimer/0.6) : 1;
      if (alpha<=0) continue;

      ctx.globalAlpha=alpha;
      const flash=e.hitFlash>0;
      const cx=sx+e.w/2, cy=sy+e.h/2;

      const sprSize = e.boss ? 80 : 64;
      const dir = Sprites.angleToDir(e.facing != null ? e.facing : Math.PI/2);
      const sprite = Sprites.getEnemySprite(e.type, dir);

      if (sprite) {
        const ix = Math.round(cx - sprSize/2);
        const iy = Math.round(cy - sprSize/2);
        if (flash) {
          ctx.save();
          ctx.filter = 'brightness(0) invert(1)';
          ctx.drawImage(sprite, ix, iy, sprSize, sprSize);
          ctx.restore();
        } else {
          ctx.drawImage(sprite, ix, iy, sprSize, sprSize);
        }
      } else {
        if (e.type==='wolf'||e.type==='pack_leader') {
          _drawWolf(ctx,e,sx,sy,cx,cy,flash,time);
        } else if (e.type==='aldric') {
          _drawAldric(ctx,e,sx,sy,cx,cy,flash,time);
        } else {
          _drawSoldier(ctx,e,sx,sy,cx,cy,flash,time);
        }
      }

      // HP bar
      if (!e.dying) {
        const bw=e.w+10, bh=5;
        const bx=sx-5, by=sy-12;
        ctx.fillStyle='#400';
        ctx.fillRect(bx,by,bw,bh);
        const frac=clamp(e.hp/e.maxHp,0,1);
        ctx.fillStyle=frac>0.5?'#4a4':'#cc4422';
        ctx.fillRect(bx,by,bw*frac,bh);
        ctx.strokeStyle='#222';
        ctx.lineWidth=1;
        ctx.strokeRect(bx,by,bw,bh);
        if (e.boss) {
          ctx.fillStyle='#ffddaa';
          ctx.font='bold 9px monospace';
          ctx.textAlign='center';
          ctx.fillText(e.name,sx+e.w/2,by-2);
        }
      }

      ctx.globalAlpha=1;
    }
  }

  function drawLoot(ctx, loot, cam, time) {
    for (const l of loot) {
      const sx=l.x-cam.x, sy=l.y-cam.y;
      const pulse=0.8+Math.sin(l.pulse*4)*0.2;
      ctx.globalAlpha=Math.min(1,l.life)*pulse;
      if (l.gold>0) {
        ctx.fillStyle='#FFD700';
        ctx.beginPath();
        ctx.arc(sx+l.w/2,sy+l.h/2,6,0,Math.PI*2);
        ctx.fill();
        ctx.fillStyle='#cc9900';
        ctx.font='9px monospace';
        ctx.textAlign='center';
        ctx.fillText(l.gold+'g',sx+l.w/2,sy+l.h+12);
      }
      if (l.item) {
        ctx.fillStyle=l.item.rarity==='legendary'?'#ffaa00':l.item.rarity==='rare'?'#6688ff':'#aaaaaa';
        ctx.fillRect(sx,sy,l.w,l.h);
        const lootSpr = l.item.dmgMin !== undefined ? Sprites.getWeaponSprite(l.item.id) : null;
        if (lootSpr) {
          ctx.drawImage(lootSpr, sx, sy, l.w, l.h);
        } else {
          ctx.fillStyle='#fff';
          ctx.font='10px monospace';
          ctx.textAlign='center';
          ctx.fillText(l.item.icon||'?',sx+l.w/2,sy+l.h-2);
        }
      }
      ctx.globalAlpha=1;
    }
  }

  function updateAll(G, dt) {
    for (const e of G.enemies) {
      updateEnemy(e, dt, G);
    }
  }

  return {
    TYPES, spawnAll, respawnRegion, updateEnemy, updateAll, updateLoot,
    draw, drawLoot, takeDamage, stun, killEnemy, doAttack
  };
})();
