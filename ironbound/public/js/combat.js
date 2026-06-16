// ============================================================
//  combat.js  —  Attacks, hit detection, projectiles, effects
// ============================================================

const Combat = (() => {

  // ── Melee attack ─────────────────────────────────────────
  function playerAttack(G) {
    const p = G.player;
    if (!p || p.dead) return;
    if (p.attackCooldown > 0) return;

    p.attackCooldown = p.attackSpeed;
    p.attacking = true;
    p.attackTimer = 0.15;

    const pw = Player.PLAYER_W, ph = Player.PLAYER_H;
    const cx = p.x + pw/2, cy = p.y + ph/2;
    const range = 62;
    const arcWidth = 1.1;    // radians, ~63° each side = 126° arc
    const ax = cx + Math.cos(p.facing) * range * 0.55;
    const ay = cy + Math.sin(p.facing) * range * 0.55;

    let weapon = p.weapon;
    let baseDmg = p.attackDamage;
    if (weapon) baseDmg = rndInt(weapon.dmgMin, weapon.dmgMax) + p.str * 2;

    let hit = false;

    for (const e of G.enemies) {
      if (!e.alive || e.dying) continue;
      const ex=e.x+e.w/2, ey=e.y+e.h/2;
      const d=dist(cx,cy,ex,ey);
      if (d > range + e.w/2) continue;

      // Angle check
      const a=Math.atan2(ey-cy,ex-cx);
      let da=Math.abs(a - p.facing);
      if (da>Math.PI) da=Math.PI*2-da;
      if (da > arcWidth) continue;

      let dmg = baseDmg * (0.85 + Math.random()*0.3);

      // Critical hit
      if (Math.random() < p.critChance) {
        dmg *= 1.8;
        G.damageNums.push({x:ex,y:e.y-14,val:'CRIT!',color:'#ffee00',isText:true,vy:-50,life:1.0});
      }

      // Runebound passive: 15% bonus rune damage
      if (p.playerClass==='runebound' && Math.random()<0.15) {
        const bonus = Math.ceil(dmg * 0.4);
        dmg += bonus;
        G.particles.push(createSparkle(ex,ey,'#44ffcc',6));
      }

      // Weapon special effects
      if (weapon && weapon.effect==='frostbite') {
        e.stunTimer = Math.max(e.stunTimer, 0.6);
        G.particles.push(createSparkle(ex,ey,'#88ddff',5));
      }
      if (weapon && weapon.effect==='burn') {
        e.hp -= dmg * 0.3;   // extra burn
      }

      const n=normalize(ex-cx,ey-cy);
      Enemies.takeDamage(e, Math.ceil(dmg), n.x, n.y, G);
      hit=true;
    }

    // Melee flash particles
    const fx=cx+Math.cos(p.facing)*range*0.7;
    const fy=cy+Math.sin(p.facing)*range*0.7;
    for(let i=0;i<3;i++) G.particles.push(createSpark(fx+rnd(-12,12),fy+rnd(-12,12)));

    Audio.play(hit ? 'hit' : 'swing');
  }

  // ── Ranged / bow attack ───────────────────────────────────
  function playerRangedAttack(G) {
    const p = G.player;
    if (!p||p.dead||p.attackCooldown>0) return;
    if (!p.weapon || (p.weapon.type!=='bow'&&p.weapon.type!=='throwaxe')) return;

    p.attackCooldown = p.attackSpeed * 1.2;
    const cx=p.x+Player.PLAYER_W/2, cy=p.y+Player.PLAYER_H/2;
    const speed=p.weapon.type==='bow'?480:360;
    const dmg=rndInt(p.weapon.dmgMin,p.weapon.dmgMax)+p.pre*2;

    G.projectiles.push({
      x:cx, y:cy,
      vx:Math.cos(p.facing)*speed, vy:Math.sin(p.facing)*speed,
      w:8, h:8, dmg, owner:'player',
      type:p.weapon.type,
      life:2.5, color:p.weapon.type==='bow'?'#c8a060':'#8888aa'
    });
    Audio.play('swing');
  }

  // ── Projectile update ────────────────────────────────────
  function updateProjectiles(G, dt) {
    for (const proj of G.projectiles) {
      proj.x += proj.vx*dt;
      proj.y += proj.vy*dt;
      proj.life -= dt;

      const tx=Math.floor(proj.x/TILE_SIZE), ty=Math.floor(proj.y/TILE_SIZE);
      if (!World.isPassable(proj.x-2,proj.y-2,8,8)) { proj.life=0; continue; }

      if (proj.owner==='player') {
        for (const e of G.enemies) {
          if (!e.alive||e.dying) continue;
          if (rectOverlap(proj.x-4,proj.y-4,8,8,e.x,e.y,e.w,e.h)) {
            const n=normalize(proj.vx,proj.vy);
            Enemies.takeDamage(e, proj.dmg*(0.9+Math.random()*0.2), n.x, n.y, G);
            for(let i=0;i<4;i++) G.particles.push(createSpark(proj.x+rnd(-6,6),proj.y+rnd(-6,6)));
            proj.life=0;
          }
        }
      }
    }
    G.projectiles=G.projectiles.filter(p=>p.life>0);
  }

  // ── Special abilities ────────────────────────────────────
  function shieldBash(p, G) {
    const cx=p.x+Player.PLAYER_W/2, cy=p.y+Player.PLAYER_H/2;
    const bx=cx+Math.cos(p.facing)*50;
    const by=cy+Math.sin(p.facing)*50;
    for (const e of G.enemies) {
      if (!e.alive||e.dying) continue;
      if (dist(bx,by,e.x+e.w/2,e.y+e.h/2)<60) {
        const n=normalize(e.x-cx,e.y-cy);
        Enemies.takeDamage(e,p.attackDamage*1.5,n.x*1.4,n.y*1.4,G);
        Enemies.stun(e,1.8);
        for(let i=0;i<6;i++) G.particles.push(createSpark(e.x+rnd(0,e.w),e.y+rnd(0,e.h),'#88aaff'));
      }
    }
  }

  function runeBurst(p, G) {
    const cx=p.x+Player.PLAYER_W/2, cy=p.y+Player.PLAYER_H/2;
    const radius=90;
    for (const e of G.enemies) {
      if (!e.alive||e.dying) continue;
      const ex=e.x+e.w/2, ey=e.y+e.h/2;
      if (dist(cx,cy,ex,ey)<=radius) {
        const n=normalize(ex-cx,ey-cy);
        const dmg=p.attackDamage*(1.5+Math.random()*0.5);
        Enemies.takeDamage(e,dmg,n.x*1.2,n.y*1.2,G);
        for(let i=0;i<5;i++) G.particles.push(createSparkle(ex+rnd(-10,10),ey+rnd(-10,10),'#44ffcc',4));
      }
    }
    // Big ring burst particles
    for(let a=0;a<Math.PI*2;a+=0.3) {
      G.particles.push(createSparkle(
        cx+Math.cos(a)*radius*0.8, cy+Math.sin(a)*radius*0.8, '#44ffcc', 5
      ));
    }
  }

  // ── Particle helpers ─────────────────────────────────────
  function createSpark(x,y,color) {
    color=color||'#ffffaa';
    return {x,y,vx:rnd(-90,90),vy:rnd(-90,90),life:rnd(0.2,0.5),maxLife:0.5,color,size:3,type:'spark'};
  }

  function createSparkle(x,y,color,size) {
    return {x,y,vx:rnd(-40,40),vy:rnd(-80,-20),life:rnd(0.4,0.8),maxLife:0.8,color,size:size||3,type:'sparkle'};
  }

  function spawnHitEffect(x,y,G) {
    for(let i=0;i<4;i++) G.particles.push(createSpark(x,y));
  }

  // ── Particle update + draw ───────────────────────────────
  function updateParticles(G, dt) {
    for (const p of G.particles) {
      p.x+=p.vx*dt; p.y+=p.vy*dt;
      p.life-=dt;
    }
    G.particles=G.particles.filter(p=>p.life>0);
  }

  function drawParticles(ctx, G, cam) {
    for (const p of G.particles) {
      const frac=p.life/p.maxLife;
      ctx.globalAlpha=frac;
      ctx.fillStyle=p.color;
      const sx=p.x-cam.x, sy=p.y-cam.y;
      if (p.type==='sparkle') {
        ctx.beginPath();
        ctx.arc(sx,sy,p.size*frac,0,Math.PI*2);
        ctx.fill();
      } else {
        ctx.fillRect(sx-p.size/2,sy-p.size/2,p.size,p.size);
      }
    }
    ctx.globalAlpha=1;
  }

  // ── Damage numbers ───────────────────────────────────────
  function updateDamageNums(G, dt) {
    for (const d of G.damageNums) {
      d.y+=d.vy*dt; d.vy*=0.85; d.life-=dt;
    }
    G.damageNums=G.damageNums.filter(d=>d.life>0);
  }

  function drawDamageNums(ctx, G, cam) {
    for (const d of G.damageNums) {
      const frac=clamp(d.life,0,0.5)/0.5;
      ctx.globalAlpha=frac;
      ctx.fillStyle=d.color||'#fff';
      ctx.font=`bold ${d.isText?13:15}px monospace`;
      ctx.textAlign='center';
      ctx.fillText(d.val, d.x-cam.x, d.y-cam.y);
    }
    ctx.globalAlpha=1;
  }

  // ── Projectile draw ──────────────────────────────────────
  function drawProjectiles(ctx, G, cam) {
    for (const p of G.projectiles) {
      const sx=p.x-cam.x, sy=p.y-cam.y;
      ctx.fillStyle=p.color;
      if (p.type==='bow') {
        // Arrow — draw as thin line
        ctx.save();
        ctx.translate(sx,sy);
        ctx.rotate(Math.atan2(p.vy,p.vx));
        ctx.fillRect(-8,-1,16,2);
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(sx,sy,5,0,Math.PI*2);
        ctx.fill();
      }
    }
  }

  // ── Day/night ambient light ───────────────────────────────
  function drawAmbient(ctx, G) {
    const phase = G.dayPhase;
    // phase 0=noon, 0.5=midnight
    let darkness=0;
    if (phase < 0.25) darkness = phase/0.25 * 0.45;
    else if (phase < 0.5) darkness = 0.45;
    else if (phase < 0.75) darkness = (0.75-phase)/0.25 * 0.45;

    // Region sky tint
    const reg = G.player ? World.getRegionAt(G.player.x,G.player.y) : 'frostholm';
    const skies={frostholm:0,thornwood:0.08,greyspire:0.06,ashfeld:0.10};
    const extraDark=skies[reg]||0;

    const total=darkness+extraDark;
    if (total>0) {
      ctx.fillStyle=`rgba(0,0,${reg==='ashfeld'?8:20},${total})`;
      ctx.fillRect(0,0,CANVAS_W,CANVAS_H);
    }

    // Bonfire glow (if player is near a bonfire)
    if (G.player && darkness > 0.1) {
      const bonfires = World.bonfires;
      for (const bf of bonfires) {
        const bx=bf.tx*TILE_SIZE+TILE_SIZE/2, by=bf.ty*TILE_SIZE+TILE_SIZE/2;
        const pd=dist(G.player.x,G.player.y,bx,by);
        if (pd>350) continue;
        const sx=bx-G.camera.x, sy=by-G.camera.y;
        const radius=150*(1-pd/350)+80;
        const grd=ctx.createRadialGradient(sx,sy,5,sx,sy,radius);
        grd.addColorStop(0,'rgba(255,150,50,0.18)');
        grd.addColorStop(1,'rgba(255,100,20,0)');
        ctx.fillStyle=grd;
        ctx.fillRect(sx-radius,sy-radius,radius*2,radius*2);
      }
    }
  }

  return {
    playerAttack, playerRangedAttack, updateProjectiles,
    shieldBash, runeBurst,
    createSpark, createSparkle, spawnHitEffect,
    updateParticles, drawParticles,
    updateDamageNums, drawDamageNums,
    drawProjectiles, drawAmbient
  };
})();
