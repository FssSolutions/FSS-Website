// ============================================================
//  ui.js  —  HUD, menus, title, class select, dialogue, map
// ============================================================

const UI = (() => {

  // ── Title screen ─────────────────────────────────────────
  function drawTitle(ctx, time) {
    // Background — dark nordic sky
    const sky=ctx.createLinearGradient(0,0,0,CANVAS_H);
    sky.addColorStop(0,'#0a0f1e'); sky.addColorStop(1,'#1a2c3a');
    ctx.fillStyle=sky; ctx.fillRect(0,0,CANVAS_W,CANVAS_H);

    // Stars
    ctx.fillStyle='rgba(200,220,255,0.7)';
    for(let i=0;i<120;i++){
      const x=(i*137.5)%CANVAS_W, y=(i*93.7)%300;
      const twink=0.4+Math.sin(time*2+i)*0.3;
      ctx.globalAlpha=twink;
      ctx.fillRect(x,y,1+((i%3)===0?1:0),1);
    }
    ctx.globalAlpha=1;

    // Mountain silhouette
    ctx.fillStyle='#0d1520';
    ctx.beginPath();
    ctx.moveTo(0,CANVAS_H);
    ctx.lineTo(0,380); ctx.lineTo(100,280); ctx.lineTo(200,340);
    ctx.lineTo(320,200); ctx.lineTo(440,310); ctx.lineTo(560,240);
    ctx.lineTo(680,310); ctx.lineTo(800,180); ctx.lineTo(900,270);
    ctx.lineTo(1000,300); ctx.lineTo(1100,220); ctx.lineTo(1200,280);
    ctx.lineTo(1280,340); ctx.lineTo(1280,CANVAS_H);
    ctx.closePath(); ctx.fill();

    // Title text
    ctx.textAlign='center';
    ctx.shadowColor='#3366aa'; ctx.shadowBlur=30;
    ctx.fillStyle='#dde8f8';
    ctx.font='bold 80px serif';
    ctx.fillText('IRONBOUND',CANVAS_W/2, CANVAS_H/2-80);
    ctx.shadowBlur=0;

    ctx.fillStyle='#8899aa';
    ctx.font='18px monospace';
    ctx.fillText('A tale of conquest, resistance, and ruin',CANVAS_W/2,CANVAS_H/2-36);

    // Subtitle
    ctx.fillStyle='#667788';
    ctx.font='14px monospace';
    ctx.fillText('Land of Valdrek — under the Iron Reign of Aldric',CANVAS_W/2,CANVAS_H/2-10);

    // Buttons
    drawMenuButton(ctx,'NEW GAME',CANVAS_W/2,CANVAS_H/2+60,200,44, time, 'newgame');
    drawMenuButton(ctx,'CONTINUE',CANVAS_W/2,CANVAS_H/2+116,200,44, time, 'continue');

    ctx.fillStyle='#445566';
    ctx.font='12px monospace';
    ctx.fillText('v1.0  —  WASD to move  •  LMB attack  •  RMB special  •  SPACE dodge',CANVAS_W/2,CANVAS_H-16);
  }

  function drawMenuButton(ctx, label, cx, cy, w, h, time, id) {
    const x=cx-w/2, y=cy-h/2;
    roundRect(ctx,x,y,w,h,6,'rgba(20,30,50,0.85)','#4466aa');
    ctx.fillStyle='#aaccee';
    ctx.font='bold 16px monospace';
    ctx.textAlign='center';
    ctx.fillText(label,cx,cy+6);
  }

  // ── Class select ─────────────────────────────────────────
  function drawClassSelect(ctx, selectedClass, time) {
    ctx.fillStyle='#0a0f1e';
    ctx.fillRect(0,0,CANVAS_W,CANVAS_H);
    ctx.fillStyle='#aabbcc';
    ctx.font='bold 26px monospace';
    ctx.textAlign='center';
    ctx.fillText('CHOOSE YOUR CLASS',CANVAS_W/2,60);
    ctx.fillStyle='#667788';
    ctx.font='13px monospace';
    ctx.fillText('Your choice shapes stats, abilities, and story outcome',CANVAS_W/2,88);

    const classes=[
      { id:'ironclad',   name:'IRONCLAD',    subtitle:'Warrior',
        color:'#4488cc', icon:'⚔',
        lines:['-20% incoming damage','Shield Bash: stun enemies','Weapons: Sword & Axe','High HP, High Armor'],
        stat:'STR:5 | AGI:2 | END:4 | PRE:1' },
      { id:'duskwalker', name:'DUSKWALKER',  subtitle:'Ranger',
        color:'#884488', icon:'◈',
        lines:['+25% movement speed','Shadow Step: pass through foes','Weapons: Daggers & Bow','High Speed, Medium HP'],
        stat:'STR:2 | AGI:6 | END:2 | PRE:4' },
      { id:'runebound',  name:'RUNEBOUND',   subtitle:'Spellblade',
        color:'#44aa88', icon:'✦',
        lines:['15% chance bonus rune dmg','Rune Burst: AoE explosion','Weapons: Rune Sword','Balanced stats'],
        stat:'STR:3 | AGI:3 | END:3 | PRE:3' }
    ];

    const BW=340, BH=340, GAP=30;
    const total=classes.length*BW+(classes.length-1)*GAP;
    let bx=(CANVAS_W-total)/2;

    for (const cls of classes) {
      const selected=selectedClass===cls.id;
      const by=120;
      roundRect(ctx,bx,by,BW,BH,8,
        selected?`rgba(${hexToRgb(cls.color)},0.22)`:'rgba(16,20,28,0.9)',
        selected?cls.color:'#334455');
      if (selected) {
        ctx.shadowColor=cls.color; ctx.shadowBlur=20;
        ctx.strokeStyle=cls.color; ctx.lineWidth=2;
        ctx.strokeRect(bx,by,BW,BH);
        ctx.shadowBlur=0;
      }
      ctx.fillStyle=cls.color;
      ctx.font='48px serif';
      ctx.textAlign='center';
      ctx.fillText(cls.icon,bx+BW/2,by+68);
      ctx.fillStyle=selected?'#fff':'#aabbcc';
      ctx.font='bold 20px monospace';
      ctx.fillText(cls.name,bx+BW/2,by+102);
      ctx.fillStyle='#8899aa';
      ctx.font='14px monospace';
      ctx.fillText(cls.subtitle,bx+BW/2,by+122);
      ctx.fillStyle='#778899';
      ctx.font='11px monospace';
      ctx.fillText(cls.stat,bx+BW/2,by+142);
      ctx.textAlign='left';
      ctx.fillStyle='#9aabbc';
      ctx.font='13px monospace';
      for (let i=0;i<cls.lines.length;i++) {
        ctx.fillText('• '+cls.lines[i], bx+16, by+172+i*24);
      }
      // Select button
      const selBtn=selected;
      roundRect(ctx,bx+BW/2-70,by+BH-50,140,36,5,
        selBtn?cls.color:'rgba(30,40,55,0.8)',
        selBtn?'#fff':'#445');
      ctx.textAlign='center';
      ctx.fillStyle=selBtn?'#000':'#889';
      ctx.font='bold 13px monospace';
      ctx.fillText(selBtn?'SELECTED':'SELECT',bx+BW/2,by+BH-27);
      bx+=BW+GAP;
    }

    ctx.fillStyle='#445566';
    ctx.font='13px monospace';
    ctx.textAlign='center';
    if (selectedClass) {
      ctx.fillStyle='#aaddff';
      ctx.fillText('Press ENTER or click START to begin your journey',CANVAS_W/2,CANVAS_H-50);
    }
    drawMenuButton(ctx,'START GAME',CANVAS_W/2,CANVAS_H-24,180,36,time,'start');
  }

  function hexToRgb(h){
    h=h.replace('#','');
    const r=parseInt(h.slice(0,2),16),g=parseInt(h.slice(2,4),16),b=parseInt(h.slice(4,6),16);
    return `${r},${g},${b}`;
  }

  // ── HUD ──────────────────────────────────────────────────
  function drawHUD(ctx, G, time) {
    const p=G.player;
    if (!p) return;

    // HP bar
    const hpFrac=clamp(p.hp/p.maxHp,0,1);
    const hpColor=hpFrac>0.5?'#44cc44':hpFrac>0.25?'#ccaa22':'#cc3322';
    drawBar(ctx,12,12,200,18,hpFrac,hpColor,'#222',`HP ${Math.ceil(p.hp)}/${p.maxHp}`);

    // Stamina bar
    const stFrac=clamp(p.stamina/p.maxStamina,0,1);
    drawBar(ctx,12,34,200,14,stFrac,'#2266ee','#222',`STA ${Math.ceil(p.stamina)}/${p.maxStamina}`);

    // XP bar
    const xpFrac=clamp(p.xp/p.xpNext,0,1);
    drawBar(ctx,12,52,200,8,xpFrac,'#9966dd','#111');
    ctx.fillStyle='#8877aa';
    ctx.font='9px monospace';
    ctx.textAlign='left';
    ctx.fillText(`LVL ${p.level}  XP ${p.xp}/${p.xpNext}`,14,68);

    // Class name + stat points indicator
    const classDef=Player.CLASS_DEFS[p.playerClass];
    ctx.fillStyle=classDef?.color||'#aaa';
    ctx.font='bold 11px monospace';
    ctx.fillText(classDef?.name||'',14,82);
    if (p.statPoints>0) {
      ctx.fillStyle='#ffffaa';
      ctx.fillText(`+${p.statPoints} STAT PT (C)`,14,96);
    }

    // Hotbar (bottom center)
    drawHotbar(ctx, p, time);

    // Region indicator (bottom-left)
    const reg=World.getRegionAt(p.x,p.y);
    const regNames={frostholm:'Frostholm',thornwood:'Thornwood',greyspire:'Greyspire',ashfeld:'Ashfeld'};
    ctx.fillStyle='rgba(0,0,0,0.5)';
    ctx.fillRect(8,CANVAS_H-30,130,22);
    ctx.fillStyle='#8899bb';
    ctx.font='11px monospace';
    ctx.textAlign='left';
    ctx.fillText(regNames[reg]||'', 14, CANVAS_H-14);

    // Notification
    if (G.ui.notification && G.ui.notification.timer>0) {
      const n=G.ui.notification;
      const alpha=Math.min(1,n.timer*2);
      ctx.globalAlpha=alpha;
      ctx.fillStyle='rgba(0,0,0,0.7)';
      ctx.fillRect(CANVAS_W/2-200,CANVAS_H-70,400,30);
      ctx.fillStyle=n.color||'#fff';
      ctx.font='bold 14px monospace';
      ctx.textAlign='center';
      ctx.fillText(n.text,CANVAS_W/2,CANVAS_H-50);
      ctx.globalAlpha=1;
    }

    // Interact hint (near bonfire)
    drawBonfireHint(ctx,G,time);

    // Key hints (small, bottom right area)
    ctx.fillStyle='rgba(30,35,45,0.6)';
    ctx.fillRect(CANVAS_W-155,CANVAS_H-90,148,82);
    ctx.fillStyle='#556677';
    ctx.font='10px monospace';
    ctx.textAlign='left';
    const hints=['I - Inventory','M - World Map','L - Quest Log','C - Character','E - Interact'];
    hints.forEach((h,i)=>ctx.fillText(h,CANVAS_W-150,CANVAS_H-80+i*15));
  }

  function drawHotbar(ctx, p, time) {
    const HBW=320, HBH=56, HBX=(CANVAS_W-HBW)/2, HBY=CANVAS_H-64;
    roundRect(ctx,HBX,HBY,HBW,HBH,6,'rgba(10,14,22,0.82)','#334455');

    // Weapon slot
    const slot1x=HBX+8, slot1y=HBY+8, SZ=40;
    roundRect(ctx,slot1x,slot1y,SZ,SZ,4,'rgba(30,35,45,0.9)','#445');
    if (p.weapon) {
      ctx.font='22px serif'; ctx.textAlign='center';
      ctx.fillText(p.weapon.icon,slot1x+SZ/2,slot1y+SZ/2+8);
      ctx.font='8px monospace';
      ctx.fillStyle='#aaa';
      ctx.fillText(p.weapon.name.slice(0,8),slot1x+SZ/2,slot1y+SZ+8);
    } else {
      ctx.fillStyle='#445';
      ctx.font='10px monospace';
      ctx.textAlign='center';
      ctx.fillText('Fist',slot1x+SZ/2,slot1y+SZ/2+4);
    }

    // Special ability
    const specX=HBX+60, specY=HBY+8;
    const cdFrac=p.specialCooldown>0?p.specialCooldown/p.specialMaxCooldown:0;
    roundRect(ctx,specX,specY,SZ,SZ,4,'rgba(30,35,45,0.9)',cdFrac>0?'#442':'#664');
    ctx.fillStyle=cdFrac>0?'rgba(40,40,40,0.7)':'transparent';
    if (cdFrac>0) ctx.fillRect(specX,specY+SZ*(1-cdFrac),SZ,SZ*cdFrac);
    ctx.fillStyle=cdFrac>0?'#555':'#aaddcc';
    ctx.font='11px monospace'; ctx.textAlign='center';
    ctx.fillText(p.specialName||'Special',specX+SZ/2,specY+14);
    if (cdFrac>0) {
      ctx.fillStyle='#ff8';
      ctx.font='bold 14px monospace';
      ctx.fillText(p.specialCooldown.toFixed(1)+'s',specX+SZ/2,specY+SZ/2+6);
    } else {
      ctx.fillStyle='#44cc88';
      ctx.font='9px monospace';
      ctx.fillText('RMB / E',specX+SZ/2,specY+SZ-4);
    }

    // Potions
    const potions=p.inventory.filter(i=>i.effect==='heal');
    const potX=HBX+112, potY=HBY+8;
    roundRect(ctx,potX,potY,SZ,SZ,4,'rgba(30,35,45,0.9)','#445');
    ctx.font='22px serif'; ctx.textAlign='center';
    ctx.fillText('🧪',potX+SZ/2,potY+SZ/2+8);
    ctx.font='bold 12px monospace'; ctx.fillStyle='#fff';
    ctx.fillText(potions.length,potX+SZ-8,potY+8);
    ctx.font='9px monospace'; ctx.fillStyle='#668';
    ctx.fillText('[Q]',potX+SZ/2,potY+SZ+8);

    // Dodge cooldown
    const dodgeX=HBX+164, dodgeY=HBY+8;
    const ddFrac=clamp(p.dodgeCooldown/0.7,0,1);
    roundRect(ctx,dodgeX,dodgeY,SZ,SZ,4,'rgba(30,35,45,0.9)',ddFrac>0?'#442':'#445');
    ctx.fillStyle=ddFrac>0?'#556677':'#88aacc';
    ctx.font='11px monospace'; ctx.textAlign='center';
    ctx.fillText('DODGE',dodgeX+SZ/2,dodgeY+14);
    if (ddFrac>0) {
      ctx.font='9px monospace'; ctx.fillStyle='#889';
      ctx.fillText(p.dodgeCooldown.toFixed(1)+'s',dodgeX+SZ/2,dodgeY+SZ/2+6);
    } else {
      ctx.fillStyle='#aabbcc';
      ctx.font='9px monospace';
      ctx.fillText('[SPACE]',dodgeX+SZ/2,dodgeY+SZ-4);
    }

    // Gold
    ctx.fillStyle='#FFD700';
    ctx.font='bold 12px monospace';
    ctx.textAlign='right';
    ctx.fillText((p.gold||0)+'g', HBX+HBW-10, HBY+HBH/2+6);
  }

  function drawBonfireHint(ctx, G, time) {
    if (!G.player) return;
    const bonfires=World.bonfires;
    for (const bf of bonfires) {
      const bx=bf.tx*TILE_SIZE+TILE_SIZE/2, by=bf.ty*TILE_SIZE+TILE_SIZE/2;
      const d=dist(G.player.x+Player.PLAYER_W/2,G.player.y+Player.PLAYER_H/2,bx,by);
      if (d<52) {
        const sx=bx-G.camera.x, sy=by-G.camera.y;
        const pulse=0.7+Math.sin(time*3)*0.3;
        ctx.globalAlpha=pulse;
        ctx.fillStyle='#ffcc66';
        ctx.font='bold 11px monospace';
        ctx.textAlign='center';
        ctx.fillText('[F] Rest at Bonfire',sx,sy-22);
        ctx.globalAlpha=1;
        break;
      }
    }
  }

  // ── Dialogue box ──────────────────────────────────────────
  function drawDialogue(ctx, G, time) {
    const dlg=G.ui.dialogue;
    if (!dlg) return;

    if (dlg.showMerchant) {
      Inventory.drawMerchant(ctx, G);
      return;
    }

    const DW=CANVAS_W-120, DH=140, DX=60, DY=CANVAS_H-DH-16;
    roundRect(ctx,DX,DY,DW,DH,8,'rgba(8,10,16,0.94)','#445566');

    // Speaker name
    ctx.fillStyle='#aaccee';
    ctx.font='bold 15px monospace';
    ctx.textAlign='left';
    ctx.fillText(dlg.npc.name, DX+16, DY+22);

    // Dialogue text (word-wrapped)
    const line=dlg.lines[dlg.index]||'';
    ctx.fillStyle='#ccdde8';
    ctx.font='14px monospace';
    wrapText(ctx, line, DX+16, DY+44, DW-32, 20);

    // Continuation hint
    const more=dlg.index<dlg.lines.length-1;
    const pulse=0.6+Math.sin(time*4)*0.4;
    ctx.globalAlpha=pulse;
    ctx.fillStyle='#8899aa';
    ctx.font='11px monospace';
    ctx.textAlign='right';
    ctx.fillText(more?'[E] Next ▶':'[E] '+(dlg.npc.isMerchant?'Shop / Close':'Close'), DX+DW-16, DY+DH-10);
    ctx.globalAlpha=1;

    // Progress dots
    if (dlg.lines.length>1) {
      for (let i=0;i<dlg.lines.length;i++) {
        ctx.fillStyle=i===dlg.index?'#aabbcc':'#334455';
        ctx.beginPath();
        ctx.arc(DX+DW/2+(i-dlg.lines.length/2)*12, DY+DH-12, 3, 0, Math.PI*2);
        ctx.fill();
      }
    }
  }

  function wrapText(ctx,text,x,y,maxW,lineH) {
    const words=text.split(' ');
    let line='';
    let cy=y;
    for (const word of words) {
      const test=line+(line?' ':'')+word;
      if (ctx.measureText(test).width>maxW&&line) {
        ctx.fillText(line,x,cy);
        cy+=lineH; line=word;
      } else line=test;
    }
    if (line) ctx.fillText(line,x,cy);
  }

  // ── Full map ──────────────────────────────────────────────
  function drawFullMap(ctx, G) {
    const PW=620,PH=500,PX=(CANVAS_W-PW)/2,PY=(CANVAS_H-PH)/2;
    roundRect(ctx,PX,PY,PW,PH,8,'rgba(8,10,16,0.97)','#445');
    ctx.fillStyle='#aabbcc'; ctx.font='bold 18px monospace';
    ctx.textAlign='left'; ctx.fillText('WORLD MAP — VALDREK',PX+16,PY+26);

    // Region blocks
    const regions=[
      {name:'FROSTHOLM',x:0,y:0,w:100,h:100,col:'rgba(60,100,140,0.4)',border:'#4488aa'},
      {name:'THORNWOOD',x:100,y:0,w:100,h:100,col:'rgba(20,60,20,0.5)',border:'#446633'},
      {name:'GREYSPIRE',x:0,y:100,w:100,h:100,col:'rgba(50,50,70,0.5)',border:'#556677'},
      {name:'ASHFELD',x:100,y:100,w:100,h:100,col:'rgba(80,20,10,0.5)',border:'#884433'}
    ];
    const scale=2.4, OX=PX+16, OY=PY+36;
    for (const r of regions) {
      ctx.fillStyle=r.col;
      ctx.fillRect(OX+r.x*scale, OY+r.y*scale, r.w*scale, r.h*scale);
      ctx.strokeStyle=r.border; ctx.lineWidth=2;
      ctx.strokeRect(OX+r.x*scale, OY+r.y*scale, r.w*scale, r.h*scale);
      ctx.fillStyle='rgba(255,255,255,0.7)';
      ctx.font='bold 12px monospace'; ctx.textAlign='center';
      ctx.fillText(r.name, OX+(r.x+r.w/2)*scale, OY+(r.y+r.h/2)*scale+5);
    }

    // Player dot
    if (G.player) {
      const ptx=G.player.x/TILE_SIZE, pty=G.player.y/TILE_SIZE;
      ctx.fillStyle='#ffffff';
      ctx.beginPath();
      ctx.arc(OX+ptx*scale,OY+pty*scale,6,0,Math.PI*2);
      ctx.fill();
      ctx.strokeStyle='#aaccff'; ctx.lineWidth=2;
      ctx.beginPath();
      ctx.arc(OX+ptx*scale,OY+pty*scale,10,0,Math.PI*2);
      ctx.stroke();
    }

    // Legend
    ctx.fillStyle='#7788aa'; ctx.font='11px monospace'; ctx.textAlign='left';
    ctx.fillText('● You  ● Bonfires  ● Dungeons  ● NPCs', PX+16, PY+PH-24);
    ctx.fillText('[M] Close', PX+PW-80, PY+PH-10);
  }

  // ── Character sheet ───────────────────────────────────────
  function drawCharSheet(ctx, G) {
    const p=G.player;
    if (!p) return;
    const PW=400,PH=460,PX=(CANVAS_W-PW)/2,PY=(CANVAS_H-PH)/2;
    roundRect(ctx,PX,PY,PW,PH,8,'rgba(8,10,18,0.96)','#445');

    const classDef=Player.CLASS_DEFS[p.playerClass];
    ctx.fillStyle=classDef?.color||'#aaa';
    ctx.font='bold 20px monospace'; ctx.textAlign='left';
    ctx.fillText(classDef?.name||'Unknown',PX+16,PY+28);
    ctx.fillStyle='#778899'; ctx.font='12px monospace';
    ctx.fillText('Level '+p.level+' of 20',PX+16,PY+46);

    const stats=[
      ['STR',p.str,'+'+Math.ceil(p.str*2)+' melee dmg'],
      ['AGI',p.agi,'atk speed / dodge'],
      ['END',p.end,'+'+p.end*5+' max HP'],
      ['PRE',p.pre,'crit/ranged dmg']
    ];
    let sy=PY+66;
    ctx.fillStyle='#556677'; ctx.font='12px monospace';
    ctx.fillText('— STATS —',PX+16,sy); sy+=18;

    for (const [name,val,desc] of stats) {
      ctx.fillStyle='#aabbcc'; ctx.font='bold 13px monospace';
      ctx.fillText(name+': '+val, PX+16, sy);
      ctx.fillStyle='#667788'; ctx.font='11px monospace';
      ctx.fillText(desc, PX+90, sy);
      if (p.statPoints>0) {
        roundRect(ctx,PX+290,sy-12,36,16,3,'rgba(60,80,40,0.8)','#668844');
        ctx.fillStyle='#aaffaa'; ctx.font='bold 11px monospace';
        ctx.textAlign='center';
        ctx.fillText('+1',PX+308,sy);
        ctx.textAlign='left';
      }
      sy+=22;
    }

    sy+=8;
    ctx.fillStyle='#556677'; ctx.font='12px monospace';
    ctx.fillText('— COMBAT —',PX+16,sy); sy+=18;
    const combatLines=[
      ['HP',Math.ceil(p.hp)+'/'+p.maxHp],
      ['Stamina',Math.ceil(p.stamina)+'/'+p.maxStamina],
      ['Atk Dmg',p.attackDamage+(p.weapon?'-'+(p.weapon.dmgMax+p.str*2):'')],
      ['Defense',Inventory.getDefense(p)],
      ['Crit',Math.floor(p.critChance*100)+'%'],
      ['Passive',classDef?.passiveDesc||'-']
    ];
    for (const [label,val] of combatLines) {
      ctx.fillStyle='#aabbcc'; ctx.font='12px monospace';
      ctx.fillText(label+': ', PX+16, sy);
      ctx.fillStyle='#eef'; ctx.font='12px monospace';
      ctx.fillText(val, PX+120, sy);
      sy+=18;
    }

    sy+=8;
    ctx.fillStyle='#556677'; ctx.font='12px monospace';
    ctx.fillText('— ABILITIES —',PX+16,sy); sy+=18;
    ctx.fillStyle='#aaddcc'; ctx.font='bold 12px monospace';
    ctx.fillText(p.specialName||'',PX+16,sy);
    ctx.fillStyle='#778899'; ctx.font='11px monospace';
    ctx.fillText(classDef?.specialDesc||'',PX+16,sy+14);

    if (p.statPoints>0) {
      ctx.fillStyle='#ffffaa'; ctx.font='bold 12px monospace';
      ctx.textAlign='center';
      ctx.fillText('Click [+1] to allocate '+p.statPoints+' stat point(s)',PX+PW/2,PY+PH-30);
    }

    ctx.fillStyle='#445566'; ctx.font='11px monospace';
    ctx.textAlign='center';
    ctx.fillText('[C] Close',PX+PW/2,PY+PH-10);
  }

  // ── Intro story screen ───────────────────────────────────
  const INTRO_PAGES = [
    {
      title: 'VALDREK — YEAR OF IRON',
      lines: [
        'Three years ago, a warlord named Aldric seized power.',
        'He called himself the Iron — and his armies swept',
        'across Valdrek like a plague of steel and fire.',
        '',
        'Four regions fell. The garrisons were planted.',
        'The roads were closed. The people grew silent.',
      ]
    },
    {
      title: 'THE LAST FREE VILLAGE',
      lines: [
        'Frostholm. A village at the edge of the tundra.',
        'Aldric\'s soldiers burned the eastern farms.',
        'You were found in the rubble — the only survivor.',
        '',
        'You remember nothing before the fire.',
        'But you remember how to fight.',
      ]
    },
    {
      title: 'YOUR MISSION',
      lines: [
        'Elder Edda nursed you back to health.',
        'She tells you: the garrison south of the village',
        'blocks the only road out of Frostholm.',
        '',
        'Clear the garrison. Open the road.',
        'Find allies in Thornwood and Greyspire.',
        'Then march on Aldric\'s Iron Citadel.',
        '',
        '        The Iron Reign ends with you.',
      ]
    }
  ];

  function drawIntro(ctx, page, fadeAlpha, time) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Subtle star field
    ctx.save();
    for (let i = 0; i < 80; i++) {
      const sx = ((i * 173 + 7) % CANVAS_W);
      const sy = ((i * 97 + 13) % CANVAS_H);
      const twinkle = 0.3 + 0.3 * Math.sin(time * 1.5 + i);
      ctx.globalAlpha = twinkle * fadeAlpha;
      ctx.fillStyle = '#aabbcc';
      ctx.fillRect(sx, sy, 1, 1);
    }
    ctx.restore();

    ctx.globalAlpha = fadeAlpha;

    const pg = INTRO_PAGES[page];
    if (!pg) { ctx.globalAlpha = 1; return; }

    // Title
    ctx.fillStyle = '#cc9944';
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(pg.title, CANVAS_W / 2, CANVAS_H / 2 - 120);

    // Divider
    ctx.strokeStyle = '#445566';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(CANVAS_W/2 - 220, CANVAS_H/2 - 104);
    ctx.lineTo(CANVAS_W/2 + 220, CANVAS_H/2 - 104);
    ctx.stroke();

    // Story lines
    ctx.fillStyle = '#aabbcc';
    ctx.font = '17px monospace';
    ctx.textAlign = 'center';
    for (let i = 0; i < pg.lines.length; i++) {
      ctx.fillText(pg.lines[i], CANVAS_W / 2, CANVAS_H / 2 - 76 + i * 28);
    }

    // Page indicator dots
    for (let i = 0; i < INTRO_PAGES.length; i++) {
      ctx.fillStyle = i === page ? '#cc9944' : '#334455';
      ctx.beginPath();
      ctx.arc(CANVAS_W/2 + (i - 1) * 20, CANVAS_H/2 + 130, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Prompt
    const pulse = 0.5 + 0.5 * Math.sin(time * 3);
    ctx.globalAlpha = pulse * fadeAlpha;
    ctx.fillStyle = '#667788';
    ctx.font = '13px monospace';
    ctx.textAlign = 'center';
    const isLast = page >= INTRO_PAGES.length - 1;
    ctx.fillText(isLast ? '[Space / Click] — Begin' : '[Space / Click] — Next', CANVAS_W / 2, CANVAS_H / 2 + 165);

    ctx.globalAlpha = 1;
  }

  // ── Death screen ──────────────────────────────────────────
  function drawDeath(ctx, deathTimer, time) {
    const fade=clamp(1-deathTimer/2.5,0,1);
    ctx.fillStyle=`rgba(80,0,0,${fade*0.7})`;
    ctx.fillRect(0,0,CANVAS_W,CANVAS_H);
    if (fade>0.5) {
      ctx.globalAlpha=(fade-0.5)*2;
      ctx.fillStyle='#cc4444';
      ctx.font='bold 48px serif';
      ctx.textAlign='center';
      ctx.fillText('YOU HAVE FALLEN',CANVAS_W/2,CANVAS_H/2-20);
      ctx.fillStyle='#778899';
      ctx.font='18px monospace';
      ctx.fillText('Respawning at last bonfire...',CANVAS_W/2,CANVAS_H/2+30);
      ctx.globalAlpha=1;
    }
  }

  // ── Win screen ────────────────────────────────────────────
  function drawWin(ctx, G, time) {
    ctx.fillStyle='rgba(0,0,0,0.85)';
    ctx.fillRect(0,0,CANVAS_W,CANVAS_H);
    ctx.shadowColor='#ffcc44'; ctx.shadowBlur=30;
    ctx.fillStyle='#ffe080';
    ctx.font='bold 56px serif';
    ctx.textAlign='center';
    ctx.fillText('VALDREK IS FREE',CANVAS_W/2,CANVAS_H/2-100);
    ctx.shadowBlur=0;
    ctx.fillStyle='#aabbcc';
    ctx.font='18px monospace';
    ctx.fillText('Aldric the Iron lies defeated.',CANVAS_W/2,CANVAS_H/2-46);
    ctx.fillText('The people of Valdrek can breathe again.',CANVAS_W/2,CANVAS_H/2-20);

    const p=G.player;
    if (p) {
      const endings={
        ironclad:"The Ironclad became the first Warden of Valdrek — a protector sworn to no lord but the people.",
        duskwalker:"The Duskwalker vanished into Thornwood, leaving only shadow and the sound of distant footsteps.",
        runebound:"The Runebound inscribed Aldric's fall into the Greyspire stones, so no tyrant would be forgotten."
      };
      ctx.fillStyle='#8899bb';
      ctx.font='16px monospace';
      wrapText(ctx, endings[p.playerClass]||'', CANVAS_W/2-280, CANVAS_H/2+20, 560, 24);
      ctx.fillStyle='#667788';
      ctx.font='14px monospace';
      ctx.fillText(`Level ${p.level} • ${p.xp} XP earned`, CANVAS_W/2, CANVAS_H/2+100);
    }

    ctx.fillStyle='#445566'; ctx.font='13px monospace';
    ctx.fillText('Thank you for playing IRONBOUND.', CANVAS_W/2, CANVAS_H-30);
  }

  return {
    drawTitle, drawClassSelect, drawHUD, drawDialogue, drawBonfireHint,
    drawFullMap, drawCharSheet, drawDeath, drawWin, drawIntro,
    INTRO_PAGES
  };
})();
