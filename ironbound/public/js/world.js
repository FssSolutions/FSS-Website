// ============================================================
//  world.js  —  Map generation, tile rendering, collision
// ============================================================

const World = (() => {
  const tiles     = new Uint8Array(MAP_W * MAP_H);   // tile type
  const tileRegion = new Uint8Array(MAP_W * MAP_H);  // 0=frost 1=thorn 2=grey 3=ash
  const explored  = new Uint8Array(MAP_W * MAP_H);

  // Offscreen minimap canvas
  let mmCanvas = null, mmCtx = null, mmDirty = true;

  // Named bonfires (world-tile coords)
  const BONFIRES = [
    {tx:27,ty:27,id:'frost_start'}, {tx:52,ty:18,id:'frost_north'},
    {tx:18,ty:52,id:'frost_west'},  {tx:72,ty:72,id:'frost_garrison'},
    {tx:122,ty:28,id:'thorn_camp'}, {tx:168,ty:22,id:'thorn_north'},
    {tx:162,ty:62,id:'thorn_bandit'},{tx:28,ty:122,id:'grey_ruins'},
    {tx:68,ty:168,id:'grey_fort'},  {tx:112,ty:112,id:'ash_entry'},
    {tx:168,ty:168,id:'citadel'}
  ];

  // Regions encoded as numbers for typed array
  const REGION_NAMES = ['frostholm','thornwood','greyspire','ashfeld'];

  function idx(tx,ty){ return ty * MAP_W + tx; }

  // ── Terrain noise helpers ────────────────────────────────
  function chunkNoise(tx, ty, seed, density) {
    const cx = Math.floor(tx/6)*6, cy = Math.floor(ty/6)*6;
    const cv = tileHash(cx + seed*37, cy + seed*53);
    const tv = tileHash(tx + seed*7, ty + seed*11);
    if (cv < density * 0.5) return true;
    if (cv < density && tv < 55) return true;
    return false;
  }

  // ── Rectangular area clearing ────────────────────────────
  function clearRect(x1, y1, x2, y2) {
    for (let ty=y1; ty<=y2; ty++)
      for (let tx=x1; tx<=x2; tx++)
        if (tx>=0&&ty>=0&&tx<MAP_W&&ty<MAP_H) tiles[idx(tx,ty)] = T.GROUND;
  }

  // ── Build walled compound with entrance ─────────────────
  function buildCompound(x1, y1, x2, y2, gateDir) {
    // Fill walls around perimeter
    for (let tx=x1; tx<=x2; tx++) {
      setWall(tx,y1); setWall(tx,y2);
    }
    for (let ty=y1; ty<=y2; ty++) {
      setWall(x1,ty); setWall(x2,ty);
    }
    // Gate opening (3 tiles wide)
    const mx = Math.floor((x1+x2)/2);
    const my = Math.floor((y1+y2)/2);
    if (gateDir==='N') { setGround(mx-1,y1); setGround(mx,y1); setGround(mx+1,y1); }
    if (gateDir==='S') { setGround(mx-1,y2); setGround(mx,y2); setGround(mx+1,y2); }
    if (gateDir==='E') { setGround(x2,my-1); setGround(x2,my); setGround(x2,my+1); }
    if (gateDir==='W') { setGround(x1,my-1); setGround(x1,my); setGround(x1,my+1); }
  }

  function setWall(tx,ty) { if(tx>=0&&ty>=0&&tx<MAP_W&&ty<MAP_H) tiles[idx(tx,ty)]=T.WALL; }
  function setGround(tx,ty){ if(tx>=0&&ty>=0&&tx<MAP_W&&ty<MAP_H) tiles[idx(tx,ty)]=T.GROUND; }

  // ── Region connection paths ──────────────────────────────
  function carvePath(x1,y1,x2,y2) {
    // Clear 3-tile-wide path from (x1,y1) to (x2,y2) along X then Y
    const steps = Math.max(Math.abs(x2-x1), Math.abs(y2-y1));
    for (let i=0; i<=steps; i++) {
      const t = steps ? i/steps : 0;
      const tx = Math.round(x1 + (x2-x1)*t);
      const ty = Math.round(y1 + (y2-y1)*t);
      clearRect(tx-1,ty-1,tx+1,ty+1);
    }
  }

  // ── Main generation ──────────────────────────────────────
  function generate() {
    // 1. Base terrain per region
    for (let ty=0; ty<MAP_H; ty++) {
      for (let tx=0; tx<MAP_W; tx++) {
        const i = idx(tx,ty);
        const region = getRegionName(tx,ty);
        const rn = REGION_NAMES.indexOf(region);
        tileRegion[i] = rn;

        let tile = T.GROUND;

        if (region === 'frostholm') {
          if (chunkNoise(tx,ty,1,12)) tile = T.TREE;
          else if (tileHash(tx+300,ty+300) < 8) tile = T.ICE;
          else if (tileHash(tx+600,ty+1200) < 4) tile = T.WATER;

        } else if (region === 'thornwood') {
          if (chunkNoise(tx,ty,2,44)) tile = T.TREE;
          // Small streams horizontal
          const streamY = ty % 22;
          if ((streamY===8||streamY===9) && tileHash(tx+900,ty+400)<55) tile=T.WATER;

        } else if (region === 'greyspire') {
          if (chunkNoise(tx,ty,3,20)) tile = T.WALL;
          else if (tileHash(tx+400,ty+800)<6) tile=T.WATER;

        } else { // ashfeld
          if (chunkNoise(tx,ty,4,9)) tile = T.TREE;
          // Lava channels
          const lcX = tx % 24, lcY = ty % 20;
          if ((lcX<2||lcY<2) && tileHash(tx+1500,ty+2000)<60) tile=T.LAVA;
        }

        tiles[i] = tile;
      }
    }

    // 2. Region connecting paths (border crossings)
    carvePath(96,48, 104,48);   // Frostholm ↔ Thornwood
    carvePath(48,96,  48,104);  // Frostholm ↔ Greyspire
    carvePath(148,96, 148,104); // Thornwood ↔ Ashfeld
    carvePath(96,148, 104,148); // Greyspire ↔ Ashfeld

    // 3. Villages + structures
    // Frostholm village
    clearRect(18,18, 36,36);
    buildCompound(18,18,36,36,'S');

    // Frostholm garrison (enemy stronghold)
    clearRect(65,65,80,80);
    buildCompound(65,65,80,80,'W');

    // Thornwood resistance camp
    clearRect(112,18,132,34);
    buildCompound(112,18,132,34,'S');

    // Thornwood bandit stronghold
    clearRect(154,52,170,68);
    buildCompound(154,52,170,68,'W');

    // Greyspire ruins (partial walls for atmosphere)
    clearRect(18,112,38,132);
    for (let ty=112;ty<=132;ty+=4)
      for (let tx=18;tx<=38;tx+=4)
        if (tileHash(tx*3,ty*3)<50) setWall(tx,ty);

    // Greyspire mountain fortress
    clearRect(55,155,75,175);
    buildCompound(55,155,75,175,'N');

    // Ashfeld entry clearing
    clearRect(105,105,118,118);

    // Iron Citadel (3-layer walled)
    clearRect(150,150,185,185);
    buildCompound(150,150,185,185,'W');
    buildCompound(155,155,180,180,'W');
    buildCompound(160,160,175,175,'E');

    // 4. Bonfires
    for (const bf of BONFIRES) {
      if (bf.tx>=0&&bf.ty>=0&&bf.tx<MAP_W&&bf.ty<MAP_H) {
        tiles[idx(bf.tx,bf.ty)] = T.BONFIRE;
        clearRect(bf.tx-2,bf.ty-2,bf.tx+2,bf.ty+2);
        tiles[idx(bf.tx,bf.ty)] = T.BONFIRE;
      }
    }

    // 5. Dungeon entrances
    const dungeons = [
      {tx:50,ty:36},{tx:138,ty:72},{tx:42,ty:148},{tx:162,ty:158}
    ];
    for (const d of dungeons) tiles[idx(d.tx,d.ty)] = T.DUNGEON;

    // 6. Treasure chests scattered
    const chestSpots = [
      {tx:30,ty:24},{tx:75,ty:24},{tx:24,ty:75},{tx:125,ty:24},
      {tx:165,ty:30},{tx:25,ty:125},{tx:68,ty:168},{tx:115,ty:115},
      {tx:165,ty:155}
    ];
    for (const c of chestSpots) {
      setGround(c.tx,c.ty);
      tiles[idx(c.tx,c.ty)] = T.CHEST;
    }

    // 7. Expose starting area on minimap
    markExplored(27,27,12);

    // Init minimap canvas
    mmCanvas = document.createElement('canvas');
    mmCanvas.width  = MAP_W;
    mmCanvas.height = MAP_H;
    mmCtx = mmCanvas.getContext('2d');
    mmDirty = true;
  }

  // ── Exploration ──────────────────────────────────────────
  function markExplored(ptx, pty, r) {
    r = r || 9;
    for (let dy=-r;dy<=r;dy++) {
      for (let dx=-r;dx<=r;dx++) {
        if (dx*dx+dy*dy > r*r) continue;
        const tx=ptx+dx, ty=pty+dy;
        if (tx>=0&&ty>=0&&tx<MAP_W&&ty<MAP_H) explored[idx(tx,ty)]=1;
      }
    }
    mmDirty = true;
  }

  // ── Accessors ────────────────────────────────────────────
  function getTile(tx,ty) {
    if (tx<0||ty<0||tx>=MAP_W||ty>=MAP_H) return T.WALL;
    return tiles[idx(tx,ty)];
  }

  function getRegionAt(wx,wy) {
    return REGION_NAMES[tileRegion[idx(Math.floor(wx/TILE_SIZE), Math.floor(wy/TILE_SIZE))] || 0];
  }

  function isPassable(wx,wy,pw,ph) {
    const m=3;
    const x1=wx+m, x2=wx+pw-m, y1=wy+m, y2=wy+ph-m;
    for (let cx=x1; cx<=x2; cx+=Math.max(1,(x2-x1)/2)) {
      for (let cy=y1; cy<=y2; cy+=Math.max(1,(y2-y1)/2)) {
        const tx=Math.floor(cx/TILE_SIZE), ty=Math.floor(cy/TILE_SIZE);
        const t=getTile(tx,ty);
        if (t===T.WALL||t===T.TREE||t===T.WATER||t===T.LAVA) return false;
      }
    }
    return true;
  }

  function isInBounds(wx,wy) {
    return wx>=0&&wy>=0&&wx<MAP_W*TILE_SIZE&&wy<MAP_H*TILE_SIZE;
  }

  // ── Tile drawing ─────────────────────────────────────────
  function drawTile(ctx, tx, ty, sx, sy, time) {
    const reg = REGION_NAMES[tileRegion[idx(tx,ty)]] || 'frostholm';
    const pal = PAL[reg];
    const t = tiles[idx(tx,ty)];
    const h = tileHash(tx, ty);
    const v = (h % 14) - 7;
    const S = TILE_SIZE;

    ctx.fillStyle = adjustRGB(pal.ground, v);
    ctx.fillRect(sx, sy, S, S);

    if (t === T.GROUND) {
      // Grass texture blades
      ctx.fillStyle = adjustRGB(pal.ground, v - 16);
      for (let i = 0; i < 5; i++) {
        const mx = sx + 3 + (tileHash(tx * 7 + i, ty * 11) % (S - 6));
        const my = sy + 3 + (tileHash(tx * 11, ty * 7 + i) % (S - 6));
        ctx.fillRect(mx, my, 1, 3 + (tileHash(tx + i, ty - i) % 3));
      }

    } else if (t === T.TREE) {
      // Drop shadow
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.beginPath();
      ctx.ellipse(sx + S * 0.55, sy + S * 0.56, S * 0.34, S * 0.27, 0, 0, Math.PI * 2);
      ctx.fill();
      // Trunk
      ctx.fillStyle = adjustRGB([101, 67, 33], v);
      ctx.fillRect(sx + S * 0.41, sy + S * 0.5, S * 0.18, S * 0.44);
      // Dark canopy rim
      ctx.fillStyle = adjustRGB(pal.tree, v - 22);
      ctx.beginPath();
      ctx.arc(sx + S * 0.47, sy + S * 0.39, S * 0.38, 0, Math.PI * 2);
      ctx.fill();
      // Main canopy
      ctx.fillStyle = adjustRGB(pal.tree, v);
      ctx.beginPath();
      ctx.arc(sx + S * 0.44, sy + S * 0.36, S * 0.32, 0, Math.PI * 2);
      ctx.fill();
      // Top-left highlight
      ctx.fillStyle = adjustRGB(pal.tree, v + 26);
      ctx.beginPath();
      ctx.arc(sx + S * 0.3, sy + S * 0.23, S * 0.17, 0, Math.PI * 2);
      ctx.fill();

    } else if (t === T.WALL) {
      ctx.fillStyle = adjustRGB(pal.wall, v);
      ctx.fillRect(sx, sy, S, S);
      // Brick mortar grid
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      for (let row = 0; row * 12 < S; row++) {
        ctx.fillRect(sx, sy + row * 12, S, 1);
        const off = (row % 2) * 10;
        for (let bx = 0; bx < S + 20; bx += 20) {
          ctx.fillRect(sx + ((bx + off) % S), sy + row * 12, 1, 12);
        }
      }
      // Top/left highlight
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillRect(sx, sy, S, 2);
      ctx.fillRect(sx, sy, 2, S);
      // Bottom/right shadow
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(sx, sy + S - 3, S, 3);
      ctx.fillRect(sx + S - 3, sy, 3, S);

    } else if (t === T.WATER) {
      ctx.fillStyle = adjustRGB(pal.water, v - 14);
      ctx.fillRect(sx, sy, S, S);
      ctx.fillStyle = adjustRGB(pal.water, v);
      ctx.fillRect(sx + 5, sy + 5, S - 10, S - 10);
      // Wave lines
      for (let w = 0; w < 3; w++) {
        const wy2 = sy + (S * 0.22 + w * S * 0.25) + Math.sin(time * 2 + tx * 0.8 + ty * 0.6 + w * 1.4) * 3;
        ctx.fillStyle = `rgba(255,255,255,${0.07 + w * 0.04})`;
        ctx.fillRect(sx + 3, wy2, S - 6, 2);
      }
      // Glint sparkles
      for (let i = 0; i < 2; i++) {
        const gx = sx + 4 + (tileHash(tx * 11 + i, ty * 7) % (S - 8));
        const gy = sy + 4 + (tileHash(tx * 7, ty * 11 + i) % (S - 8));
        ctx.fillStyle = `rgba(255,255,255,${0.22 + Math.sin(time * 4 + i * 2.3 + tx + ty) * 0.18})`;
        ctx.fillRect(gx, gy, 2, 2);
      }

    } else if (t === T.ICE) {
      ctx.fillStyle = adjustRGB(pal.ice || pal.ground, 14);
      ctx.fillRect(sx, sy, S, S);
      // Crack lines
      ctx.strokeStyle = 'rgba(180,220,255,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sx + h % 20, sy + (h * 3) % 20);
      ctx.lineTo(sx + S * 0.5, sy + S * 0.55);
      ctx.lineTo(sx + S * 0.76, sy + S * 0.34 + h % 10);
      ctx.stroke();
      // Crystal sparkles
      for (let i = 0; i < 3; i++) {
        const px = sx + 4 + (tileHash(tx * 3 + i, ty * 7) % (S - 8));
        const py = sy + 4 + (tileHash(tx * 7 + i, ty * 3) % (S - 8));
        const sp = 0.4 + Math.sin(time * 3 + i * 1.8 + tx * 0.5 + ty * 0.4) * 0.4;
        ctx.fillStyle = `rgba(200,235,255,${sp * 0.8})`;
        ctx.fillRect(px, py, 2, 2);
        ctx.fillStyle = `rgba(255,255,255,${sp * 0.6})`;
        ctx.fillRect(px + 1, py - 1, 1, 4);
        ctx.fillRect(px - 1, py + 1, 4, 1);
      }
      ctx.fillStyle = 'rgba(255,255,255,0.13)';
      ctx.fillRect(sx + 2, sy + 2, S - 4, S * 0.32);

    } else if (t === T.LAVA) {
      const glow = 0.7 + Math.sin(time * 3 + tx * 0.5 + ty * 0.8) * 0.3;
      ctx.fillStyle = `rgb(${Math.floor(195 * glow)},${Math.floor(52 * glow)},0)`;
      ctx.fillRect(sx, sy, S, S);
      ctx.fillStyle = `rgba(255,150,30,${0.35 * glow})`;
      ctx.fillRect(sx + 5, sy + 5, S - 10, S - 10);
      // Glowing cracks
      ctx.strokeStyle = `rgba(255,220,80,${0.6 * glow})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(sx + h % 16, sy + h % 16);
      ctx.lineTo(sx + S * 0.5, sy + S * 0.44 + Math.sin(time * 2) * 3);
      ctx.lineTo(sx + S * 0.82, sy + S * 0.72);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(sx + S * 0.22, sy + S * 0.8);
      ctx.lineTo(sx + S * 0.5, sy + S * 0.5 + Math.cos(time * 2) * 2);
      ctx.lineTo(sx + S * 0.78, sy + S * 0.18);
      ctx.stroke();
      ctx.fillStyle = `rgba(255,240,120,${0.7 * glow})`;
      ctx.beginPath();
      ctx.arc(sx + S * 0.5, sy + S * 0.5, 3 + Math.sin(time * 5) * 1.5, 0, Math.PI * 2);
      ctx.fill();

    } else if (t === T.BONFIRE) {
      ctx.fillStyle = '#444';
      ctx.beginPath();
      ctx.arc(sx + S / 2, sy + S / 2, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#333';
      ctx.beginPath();
      ctx.arc(sx + S / 2, sy + S / 2, 10, 0, Math.PI * 2);
      ctx.fill();
      // Ring stones
      ctx.fillStyle = '#666';
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        ctx.beginPath();
        ctx.ellipse(sx + S / 2 + Math.cos(a) * 13, sy + S / 2 + Math.sin(a) * 13, 3, 2.5, a, 0, Math.PI * 2);
        ctx.fill();
      }
      // Crossed logs
      ctx.fillStyle = '#5D3A1A';
      ctx.fillRect(sx + S / 2 - 8, sy + S / 2 - 2, 16, 4);
      ctx.fillRect(sx + S / 2 - 2, sy + S / 2 - 8, 4, 16);
      // Flame layers
      const f1 = 0.6 + Math.sin(time * 5.2) * 0.4;
      const f2 = 0.5 + Math.cos(time * 6.8) * 0.5;
      const f3 = 0.7 + Math.sin(time * 7.3) * 0.3;
      ctx.fillStyle = `rgba(220,55,0,${0.9 * f1})`;
      ctx.beginPath(); ctx.arc(sx + S / 2, sy + S / 2 - 2, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(255,135,0,${0.85 * f2})`;
      ctx.beginPath(); ctx.arc(sx + S / 2, sy + S / 2 - 5, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(255,215,45,${f3})`;
      ctx.beginPath(); ctx.arc(sx + S / 2, sy + S / 2 - 8, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,200,0.95)';
      ctx.beginPath(); ctx.arc(sx + S / 2, sy + S / 2 - 10, 2, 0, Math.PI * 2); ctx.fill();

    } else if (t === T.DUNGEON) {
      ctx.fillStyle = '#1e1818';
      ctx.fillRect(sx, sy, S, S);
      // Stone block grid
      ctx.fillStyle = 'rgba(70,55,45,0.6)';
      for (let row = 0; row * 16 < S; row++) {
        ctx.fillRect(sx, sy + row * 16, S, 1);
        const off = (row % 2) * 8;
        for (let bx = 0; bx < S + 16; bx += 16) {
          ctx.fillRect(sx + ((bx + off) % (S + 8)), sy + row * 16, 1, 16);
        }
      }
      ctx.strokeStyle = '#aa7744';
      ctx.lineWidth = 2;
      ctx.strokeRect(sx + 7, sy + 7, S - 14, S - 14);
      ctx.fillStyle = '#0a0606';
      ctx.fillRect(sx + 10, sy + 10, S - 20, S - 20);
      ctx.fillStyle = '#664422';
      ctx.font = '16px serif';
      ctx.textAlign = 'center';
      ctx.fillText('▼', sx + S / 2, sy + S / 2 + 7);

    } else if (t === T.CHEST) {
      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(sx + 9, sy + S - 12, S - 18, 6);
      // Wooden body
      ctx.fillStyle = '#7B4A16';
      ctx.fillRect(sx + 6, sy + 14, S - 12, S - 22);
      // Wood grain lines
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.fillRect(sx + 10, sy + 22, S - 20, 2);
      ctx.fillRect(sx + 10, sy + 28, S - 20, 2);
      // Metal straps
      ctx.fillStyle = '#8B7355';
      ctx.fillRect(sx + 6, sy + 14, S - 12, 4);
      ctx.fillRect(sx + 6, sy + 23, S - 12, 3);
      // Corner brackets
      ctx.fillStyle = '#AABB88';
      ctx.fillRect(sx + 6, sy + 14, 5, 10);
      ctx.fillRect(sx + S - 11, sy + 14, 5, 10);
      ctx.fillRect(sx + 6, sy + S - 22, 5, 8);
      ctx.fillRect(sx + S - 11, sy + S - 22, 5, 8);
      // Gold lock
      ctx.fillStyle = '#FFD700';
      ctx.beginPath(); ctx.arc(sx + S / 2, sy + S / 2 - 2, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#CC9900';
      ctx.beginPath(); ctx.arc(sx + S / 2, sy + S / 2 - 2, 3, 0, Math.PI * 2); ctx.fill();
      // Shimmer
      const shimmer = 0.7 + Math.sin(time * 3) * 0.3;
      ctx.fillStyle = `rgba(255,220,80,${shimmer * 0.35})`;
      ctx.fillRect(sx + 7, sy + 15, S - 14, 3);
    }
  }

  // ── World draw ───────────────────────────────────────────
  function draw(ctx, cam, time, G) {
    const startTX = Math.max(0, Math.floor(cam.x/TILE_SIZE)-1);
    const startTY = Math.max(0, Math.floor(cam.y/TILE_SIZE)-1);
    const endTX   = Math.min(MAP_W-1, Math.ceil((cam.x+CANVAS_W)/TILE_SIZE)+1);
    const endTY   = Math.min(MAP_H-1, Math.ceil((cam.y+CANVAS_H)/TILE_SIZE)+1);

    for (let ty=startTY; ty<=endTY; ty++) {
      for (let tx=startTX; tx<=endTX; tx++) {
        const sx = tx*TILE_SIZE - cam.x;
        const sy = ty*TILE_SIZE - cam.y;
        drawTile(ctx, tx, ty, sx, sy, time);
      }
    }

    // Environmental overlay
    const reg = G && G.player ? getRegionAt(G.player.x, G.player.y) : 'frostholm';
    if (reg === 'thornwood') {
      ctx.fillStyle = 'rgba(80,110,60,0.08)';
      ctx.fillRect(0,0,CANVAS_W,CANVAS_H);
    }
    if (reg === 'ashfeld') {
      ctx.fillStyle = 'rgba(100,20,0,0.06)';
      ctx.fillRect(0,0,CANVAS_W,CANVAS_H);
    }
  }

  // ── Weather particles (called from main loop) ────────────
  function drawWeather(ctx, G, time) {
    if (!G || !G.player) return;
    const reg = getRegionAt(G.player.x, G.player.y);

    if (reg === 'frostholm') {
      // Snowflakes
      ctx.fillStyle = 'rgba(220,235,255,0.7)';
      for (let i=0;i<40;i++) {
        const x = ((i*137+Math.floor(time*30)) % CANVAS_W);
        const y = ((i*91+Math.floor(time*25+i*13)) % CANVAS_H);
        ctx.fillRect(x, y, 2, 2);
      }
    } else if (reg === 'thornwood') {
      // Fog wisps
      ctx.fillStyle = 'rgba(130,150,110,0.06)';
      for (let i=0;i<8;i++) {
        const x = ((i*200+Math.floor(time*15)) % (CANVAS_W+200)) - 100;
        const y = ((i*93) % CANVAS_H);
        ctx.fillRect(x, y, 60, 20);
      }
    } else if (reg === 'ashfeld') {
      // Ash embers
      for (let i=0;i<25;i++) {
        const x = ((i*173+Math.floor(time*20)) % CANVAS_W);
        const y = CANVAS_H - ((i*117+Math.floor(time*18+i*21)) % CANVAS_H);
        const brightness = 0.4+((i*37)%60)/100;
        ctx.fillStyle = `rgba(255,${Math.floor(100+i*4)},0,${brightness})`;
        ctx.fillRect(x,y,2,2);
      }
    }
  }

  // ── Minimap rendering ─────────────────────────────────────
  function getMinimapColor(tx, ty) {
    const t = tiles[idx(tx,ty)];
    const reg = REGION_NAMES[tileRegion[idx(tx,ty)]];
    if (t===T.BONFIRE) return '#ff8800';
    if (t===T.DUNGEON) return '#444466';
    if (t===T.WATER)   return reg==='ashfeld'?'#c03010':'#3870a0';
    if (t===T.LAVA)    return '#e04000';
    if (t===T.WALL)    return '#888890';
    if (t===T.TREE)    return reg==='thornwood'?'#183010':reg==='greyspire'?'#404048':'#5a7080';
    if (t===T.ICE)     return '#a0c8e0';
    if (t===T.CHEST)   return '#c8a000';
    const base = {frostholm:'#8090a0',thornwood:'#304028',greyspire:'#505060',ashfeld:'#5a2808'};
    return base[reg] || '#555';
  }

  function rebuildMinimap(G) {
    if (!mmCtx) return;
    mmCtx.fillStyle='#000';
    mmCtx.fillRect(0,0,MAP_W,MAP_H);
    for (let ty=0;ty<MAP_H;ty++) {
      for (let tx=0;tx<MAP_W;tx++) {
        if (!explored[idx(tx,ty)]) continue;
        mmCtx.fillStyle = getMinimapColor(tx,ty);
        mmCtx.fillRect(tx,ty,1,1);
      }
    }
    mmDirty = false;
  }

  function drawMinimap(ctx, G, time) {
    if (!mmCanvas) return;
    if (mmDirty) rebuildMinimap(G);

    const MM_SIZE = 210;
    const MX = CANVAS_W - MM_SIZE - 12;
    const MY = 12;

    // Border
    ctx.fillStyle='rgba(0,0,0,0.8)';
    ctx.fillRect(MX-3,MY-3,MM_SIZE+6,MM_SIZE+6);
    ctx.strokeStyle='#556';
    ctx.lineWidth=2;
    ctx.strokeRect(MX-3,MY-3,MM_SIZE+6,MM_SIZE+6);

    // Scale 200x200 map to MM_SIZE pixels (1.05x)
    ctx.drawImage(mmCanvas, MX, MY, MM_SIZE, MM_SIZE);

    const scaleX = MM_SIZE/MAP_W, scaleY = MM_SIZE/MAP_H;

    // Bonfires
    for (const bf of BONFIRES) {
      if (!explored[idx(bf.tx,bf.ty)]) continue;
      ctx.fillStyle='#ff8800';
      ctx.fillRect(MX+bf.tx*scaleX-1,MY+bf.ty*scaleY-1,3,3);
    }

    // Enemies
    if (G.enemies) {
      ctx.fillStyle='#ff4444';
      for (const e of G.enemies) {
        if (!e.alive) continue;
        const etx=Math.floor(e.x/TILE_SIZE), ety=Math.floor(e.y/TILE_SIZE);
        if (!explored[idx(etx,ety)]) continue;
        ctx.fillRect(MX+etx*scaleX,MY+ety*scaleY,2,2);
      }
    }

    // NPCs
    if (G.npcs) {
      ctx.fillStyle='#ffff44';
      for (const n of G.npcs) {
        const ntx=Math.floor(n.x/TILE_SIZE), nty=Math.floor(n.y/TILE_SIZE);
        if (!explored[idx(ntx,nty)]) continue;
        ctx.fillRect(MX+ntx*scaleX-1,MY+nty*scaleY-1,3,3);
      }
    }

    // Player dot
    if (G.player) {
      const ptx=Math.floor(G.player.x/TILE_SIZE), pty=Math.floor(G.player.y/TILE_SIZE);
      ctx.fillStyle='#fff';
      ctx.fillRect(MX+ptx*scaleX-2,MY+pty*scaleY-2,5,5);
    }

    // Region label
    const reg = G && G.player ? getRegionAt(G.player.x,G.player.y) : 'frostholm';
    const regLabel = {frostholm:'FROSTHOLM',thornwood:'THORNWOOD',greyspire:'GREYSPIRE',ashfeld:'ASHFELD'};
    ctx.fillStyle='rgba(0,0,0,0.6)';
    ctx.fillRect(MX,MY+MM_SIZE-18,MM_SIZE,18);
    ctx.fillStyle='#aabbcc';
    ctx.font='bold 11px monospace';
    ctx.textAlign='center';
    ctx.fillText(regLabel[reg]||'', MX+MM_SIZE/2, MY+MM_SIZE-5);
  }

  return {
    generate, getTile, isPassable, isInBounds, getRegionAt,
    markExplored, draw, drawWeather, drawMinimap,
    get bonfires() { return BONFIRES; },
    getBonfireById: (id) => BONFIRES.find(b=>b.id===id),
    setTile: (tx,ty,t) => { if(tx>=0&&ty>=0&&tx<MAP_W&&ty<MAP_H){ tiles[idx(tx,ty)]=t; mmDirty=true; } },
    invalidateMinimap: () => { mmDirty=true; }
  };
})();
