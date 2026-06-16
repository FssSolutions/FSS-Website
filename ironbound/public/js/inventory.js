// ============================================================
//  inventory.js  —  Items, weapons, armor, inventory management
// ============================================================

const Inventory = (() => {
  const MAX_SLOTS = 20;

  // ── Item definitions ─────────────────────────────────────
  const WEAPON_DEFS = [
    {id:'sword',      name:'Iron Sword',      type:'sword',    dmgMin:8,  dmgMax:14, speed:0.45, rarity:'common',    icon:'⚔', lvl:1, value:30, effect:null,          desc:'A standard iron blade.'},
    {id:'shortsword', name:'Short Sword',      type:'sword',    dmgMin:6,  dmgMax:11, speed:0.35, rarity:'common',    icon:'⚔', lvl:1, value:20, effect:null,          desc:'Fast, light sword.'},
    {id:'axe',        name:'Battle Axe',       type:'axe',      dmgMin:12, dmgMax:20, speed:0.60, rarity:'common',    icon:'🪓', lvl:3, value:50, effect:null,          desc:'Slow but heavy damage.'},
    {id:'daggers',    name:'Dual Daggers',     type:'dagger',   dmgMin:5,  dmgMax:10, speed:0.28, rarity:'common',    icon:'◈', lvl:1, value:25, effect:null,          desc:'Quick strikes in pairs.'},
    {id:'runesword',  name:'Rune Sword',       type:'sword',    dmgMin:9,  dmgMax:15, speed:0.42, rarity:'common',    icon:'✦', lvl:1, value:40, effect:null,          desc:'Inscribed with ancient runes.'},
    {id:'bow',        name:'Shortbow',         type:'bow',      dmgMin:7,  dmgMax:13, speed:0.55, rarity:'common',    icon:'🏹', lvl:2, value:35, effect:null,          desc:'Ranged. Right-click to fire.'},
    {id:'throwaxe',   name:'Throwing Axes',    type:'throwaxe', dmgMin:6,  dmgMax:12, speed:0.50, rarity:'common',    icon:'⚡', lvl:2, value:30, effect:null,          desc:'Thrown ranged weapon.'},
    {id:'frostaxe',   name:'Frostbite Axe',    type:'axe',      dmgMin:14, dmgMax:22, speed:0.60, rarity:'rare',      icon:'❄', lvl:5, value:180, effect:'frostbite',  desc:'Slows enemies on hit.'},
    {id:'flameblade', name:'Flame Blade',      type:'sword',    dmgMin:16, dmgMax:26, speed:0.45, rarity:'rare',      icon:'🔥', lvl:6, value:200, effect:'burn',       desc:'+40% fire damage on hit.'},
    {id:'shadowdagger',name:"Shadowfang",      type:'dagger',   dmgMin:12, dmgMax:18, speed:0.25, rarity:'rare',      icon:'◈', lvl:5, value:220, effect:null,          desc:'Eerily swift blades.'},
    {id:'ironbow',    name:'Iron Recurve Bow', type:'bow',      dmgMin:14, dmgMax:20, speed:0.55, rarity:'rare',      icon:'🏹', lvl:6, value:190, effect:null,          desc:'Reinforced recurve bow.'},
    {id:'greatsword', name:"Warlord's Blade",  type:'sword',    dmgMin:22, dmgMax:35, speed:0.70, rarity:'legendary', icon:'⚔', lvl:10, value:500, effect:null,         desc:'Weapon of a fallen captain.'},
    {id:'runeaxe',    name:'Rune Axe',         type:'axe',      dmgMin:28, dmgMax:40, speed:0.72, rarity:'legendary', icon:'🪓', lvl:12, value:600, effect:'frostbite',  desc:'Carved with ancient kill-runes.'},
    {id:'ironbreaker',name:'Ironbreaker',      type:'sword',    dmgMin:35, dmgMax:50, speed:0.65, rarity:'legendary', icon:'⚔', lvl:15, value:900, effect:'burn',        desc:'Said to have slain a warlord.'}
  ];

  const ARMOR_DEFS = [
    {id:'leatherhelm',  name:'Leather Helm',     slot:'helm',  def:3,  rarity:'common',    icon:'🪖', lvl:1, value:20},
    {id:'ironhelm',     name:'Iron Helm',         slot:'helm',  def:6,  rarity:'common',    icon:'🪖', lvl:3, value:60},
    {id:'guardshelm',   name:"Guard's Helm",      slot:'helm',  def:10, rarity:'rare',      icon:'🪖', lvl:6, value:160},
    {id:'warlordhelm',  name:"Warlord's Crown",   slot:'helm',  def:16, rarity:'legendary', icon:'👑', lvl:12, value:450},
    {id:'leatherchest', name:'Leather Armor',     slot:'chest', def:5,  rarity:'common',    icon:'🛡', lvl:1, value:30},
    {id:'ironchest',    name:'Iron Plate',        slot:'chest', def:10, rarity:'common',    icon:'🛡', lvl:3, value:80},
    {id:'guardschest',  name:"Guard's Breastplate",slot:'chest',def:18, rarity:'rare',      icon:'🛡', lvl:6, value:200},
    {id:'ironboundplate',name:'Ironbound Plate',  slot:'chest', def:28, rarity:'legendary', icon:'🛡', lvl:12, value:580}
  ];

  const CONSUMABLE_DEFS = [
    {id:'hpotion',   name:'Health Potion',   type:'consume', effect:'heal',    value:50,  icon:'🧪', cost:25, desc:'Restores 50 HP.'},
    {id:'hpotion2',  name:'Strong Potion',   type:'consume', effect:'heal',    value:100, icon:'🧪', cost:55, desc:'Restores 100 HP.'},
    {id:'stonictonic',name:'Stamina Tonic',  type:'consume', effect:'stamina', value:60,  icon:'⚗',  cost:20, desc:'Restores 60 Stamina.'},
    {id:'antidote',  name:'Antidote',        type:'consume', effect:'cure',    value:0,   icon:'💊', cost:15, desc:'Cures status effects.'}
  ];

  function getWeaponDef(id) { return WEAPON_DEFS.find(w=>w.id===id); }
  function getArmorDef(id)  { return ARMOR_DEFS.find(a=>a.id===id); }
  function getConsumDef(id) { return CONSUMABLE_DEFS.find(c=>c.id===id); }

  function makeItem(def) {
    return Object.assign({}, def, {uid: Math.random().toString(36).slice(2)});
  }

  function makeWeapon(id) { const d=getWeaponDef(id); return d?makeItem(d):null; }
  function makeArmor(id)  { const d=getArmorDef(id);  return d?makeItem(d):null; }
  function makeConsume(id){ const d=getConsumDef(id); return d?makeItem(d):null; }

  function randomDrop(enemyLevel) {
    const r=Math.random();
    // 60% weapon, 30% armor, 10% consumable
    let pool;
    if (r<0.6) pool=WEAPON_DEFS.filter(w=>w.lvl<=Math.min(enemyLevel+2,20));
    else if (r<0.9) pool=ARMOR_DEFS.filter(a=>a.lvl<=Math.min(enemyLevel+2,20));
    else pool=CONSUMABLE_DEFS;

    if (!pool.length) pool=WEAPON_DEFS.slice(0,3);

    // Weight toward lower rarity
    const rng=Math.random();
    let filtered;
    if (rng<0.6) filtered=pool.filter(i=>i.rarity==='common');
    else if (rng<0.9) filtered=pool.filter(i=>i.rarity==='rare');
    else filtered=pool.filter(i=>i.rarity==='legendary');
    if (!filtered.length) filtered=pool;

    const def=filtered[rndInt(0,filtered.length-1)];
    return makeItem(def);
  }

  function initPlayerInventory(p, playerClass) {
    p.inventory = [];
    p.gold = 15;

    // Starting weapon based on class
    const startWeapons = { ironclad:'sword', duskwalker:'daggers', runebound:'runesword' };
    const wid=startWeapons[playerClass]||'sword';
    const startWeapon=makeWeapon(wid);
    p.weapon=startWeapon;
    p.helm=null; p.chest=null;
    addItem(p, makeConsume('hpotion'));
    addItem(p, makeConsume('hpotion'));
    addItem(p, makeConsume('stonictonic'));
  }

  function addItem(p, item) {
    if (!item) return false;
    if (p.inventory.length>=MAX_SLOTS) return false;
    p.inventory.push(item);
    return true;
  }

  function removeItem(p, uid) {
    const idx=p.inventory.findIndex(i=>i.uid===uid);
    if (idx>=0) { p.inventory.splice(idx,1); return true; }
    return false;
  }

  function equipItem(p, item, G) {
    if (item.type==='consume') { useConsumable(p,item,G); return; }
    if (item.dmgMin!==undefined) {
      // Weapon
      if (p.weapon) addItem(p,p.weapon);
      p.weapon=item;
      removeItem(p,item.uid);
      Audio.play('menu');
      G.ui.notification={text:'Equipped: '+item.name,color:'#aaddff',timer:2};
    } else if (item.slot==='helm') {
      if (p.helm) addItem(p,p.helm);
      p.helm=item;
      removeItem(p,item.uid);
      Audio.play('menu');
    } else if (item.slot==='chest') {
      if (p.chest) addItem(p,p.chest);
      p.chest=item;
      removeItem(p,item.uid);
      Audio.play('menu');
    }
  }

  function useConsumable(p, item, G) {
    if (item.effect==='heal') {
      Player.heal(p, item.value, G);
    } else if (item.effect==='stamina') {
      p.stamina=Math.min(p.maxStamina,p.stamina+item.value);
    }
    removeItem(p,item.uid);
    Audio.play('menu');
  }

  function getDefense(p) {
    return (p.helm?.def||0)+(p.chest?.def||0);
  }

  // ── Merchant system ──────────────────────────────────────
  const MERCHANT_STOCKS = {
    edda:    ['hpotion','hpotion','stonictonic','antidote','shortsword','leatherhelm','leatherchest'],
    vira:    ['hpotion','hpotion2','stonictonic','bow','ironhelm','leatherchest','axe'],
    boros:   ['hpotion2','stonictonic','ironbow','shadowdagger','guardshelm','guardschest'],
    merchant:['hpotion','hpotion2','stonictonic','antidote','axe','ironhelm','ironchest']
  };

  function getMerchantStock(npcId) {
    const ids = MERCHANT_STOCKS[npcId]||MERCHANT_STOCKS.merchant;
    return ids.map(id=>{
      const w=getWeaponDef(id), a=getArmorDef(id), c=getConsumDef(id);
      return makeItem(w||a||c);
    }).filter(Boolean);
  }

  function buyItem(p, item, G) {
    if ((p.gold||0) < item.value) {
      G.ui.notification={text:'Not enough gold!',color:'#ffaaaa',timer:2};
      return false;
    }
    if (!addItem(p,item)) {
      G.ui.notification={text:'Inventory full!',color:'#ffaaaa',timer:2};
      return false;
    }
    p.gold-=item.value;
    Audio.play('menu');
    return true;
  }

  function sellItem(p, item, G) {
    const sellPrice=Math.floor((item.value||5)*0.4);
    p.gold=(p.gold||0)+sellPrice;
    removeItem(p,item.uid);
    Audio.play('menu');
    G.ui.notification={text:'Sold for '+sellPrice+'g',color:'#FFD700',timer:2};
  }

  // ── Inventory UI draw ────────────────────────────────────
  function draw(ctx, G) {
    const p=G.player;
    if (!p) return;

    const PW=560, PH=440, PX=(CANVAS_W-PW)/2, PY=(CANVAS_H-PH)/2;
    roundRect(ctx,PX,PY,PW,PH,8,'rgba(12,14,20,0.96)','#445');
    ctx.fillStyle='#aabbcc';
    ctx.font='bold 18px monospace';
    ctx.textAlign='left';
    ctx.fillText('INVENTORY',PX+16,PY+28);
    ctx.fillStyle='#887755';
    ctx.fillText('Gold: '+Math.floor(p.gold||0)+'g',PX+PW-130,PY+28);

    // Grid (5×4)
    const COLS=5, ROWS=4, SZ=64, GAP=6;
    const GX=PX+16, GY=PY+46;
    for (let row=0;row<ROWS;row++) {
      for (let col=0;col<COLS;col++) {
        const i=row*COLS+col;
        const sx=GX+col*(SZ+GAP), sy=GY+row*(SZ+GAP);
        roundRect(ctx,sx,sy,SZ,SZ,4,'rgba(30,35,45,0.9)','#334');
        const item=p.inventory[i];
        if (item) {
          const col2=item.rarity==='legendary'?'rgba(255,170,0,0.25)':item.rarity==='rare'?'rgba(80,100,255,0.2)':'rgba(80,80,80,0.2)';
          ctx.fillStyle=col2;
          ctx.fillRect(sx,sy,SZ,SZ);
          const wSpr = item.dmgMin !== undefined ? Sprites.getWeaponSprite(item.id) : null;
          if (wSpr) {
            ctx.drawImage(wSpr, sx + (SZ-32)/2, sy + (SZ-32)/2 + 2, 32, 32);
          } else {
            ctx.font='22px serif';
            ctx.textAlign='center';
            ctx.fillText(item.icon||'?',sx+SZ/2,sy+SZ/2+8);
          }
          ctx.font='8px monospace';
          ctx.fillStyle='#aaa';
          ctx.fillText(item.name.slice(0,9),sx+SZ/2,sy+SZ-4);
          if (item.rarity==='legendary') {
            ctx.strokeStyle='rgba(255,170,0,0.6)'; ctx.lineWidth=2;
            ctx.strokeRect(sx+1,sy+1,SZ-2,SZ-2);
          } else if (item.rarity==='rare') {
            ctx.strokeStyle='rgba(80,100,255,0.5)'; ctx.lineWidth=2;
            ctx.strokeRect(sx+1,sy+1,SZ-2,SZ-2);
          }
        }
      }
    }

    // Equipped panel
    const EX=GX+COLS*(SZ+GAP)+16, EY=GY;
    ctx.fillStyle='#778899';
    ctx.font='bold 13px monospace';
    ctx.textAlign='left';
    ctx.fillText('EQUIPPED',EX,EY-6);

    drawEquipSlot(ctx,'Weapon',p.weapon,EX,EY+8);
    drawEquipSlot(ctx,'Helm',  p.helm,  EX,EY+82);
    drawEquipSlot(ctx,'Chest', p.chest, EX,EY+156);

    // Hover tooltip
    if (G.ui.invHover>=0) {
      const item=p.inventory[G.ui.invHover];
      if (item) drawItemTooltip(ctx,item,GX+PW-200,GY+220);
    }

    ctx.fillStyle='#445566';
    ctx.font='11px monospace';
    ctx.textAlign='center';
    ctx.fillText('[I] Close  •  Click item to equip/use',PX+PW/2,PY+PH-10);
  }

  function drawEquipSlot(ctx,label,item,x,y) {
    const SZ=64;
    ctx.fillStyle='#445566';
    ctx.font='10px monospace';
    ctx.textAlign='left';
    ctx.fillText(label,x,y);
    roundRect(ctx,x,y+4,SZ,SZ,4,'rgba(20,25,35,0.9)','#445');
    if (item) {
      const wSpr = item.dmgMin !== undefined ? Sprites.getWeaponSprite(item.id) : null;
      if (wSpr) {
        ctx.drawImage(wSpr, x + (SZ-32)/2, y + 4 + (SZ-32)/2 + 2, 32, 32);
      } else {
        ctx.font='22px serif';
        ctx.textAlign='center';
        ctx.fillText(item.icon||'?',x+SZ/2,y+4+SZ/2+8);
      }
      ctx.font='9px monospace';
      ctx.fillStyle='#aaa';
      ctx.textAlign='center';
      ctx.fillText(item.name.slice(0,8),x+SZ/2,y+4+SZ-4);
    }
  }

  function drawItemTooltip(ctx,item,x,y) {
    const W=180,H=90;
    roundRect(ctx,x,y,W,H,5,'rgba(10,12,18,0.95)','#556');
    ctx.fillStyle=item.rarity==='legendary'?'#ffaa00':item.rarity==='rare'?'#8899ff':'#cccccc';
    ctx.font='bold 12px monospace';
    ctx.textAlign='left';
    ctx.fillText(item.name,x+8,y+18);
    ctx.fillStyle='#aaa';
    ctx.font='11px monospace';
    if (item.dmgMin) ctx.fillText(`DMG: ${item.dmgMin}-${item.dmgMax}`,x+8,y+34);
    if (item.def)    ctx.fillText(`DEF: +${item.def}`,x+8,y+34);
    if (item.effect) ctx.fillText(`Effect: ${item.effect}`,x+8,y+48);
    ctx.fillText(item.desc||'',x+8,y+62,W-16);
    ctx.fillStyle='#887755';
    ctx.fillText('Value: '+item.value+'g',x+8,y+78);
  }

  // Merchant UI
  function drawMerchant(ctx, G) {
    const stock = G.ui.merchantStock || [];
    const PW=600,PH=420,PX=(CANVAS_W-PW)/2,PY=(CANVAS_H-PH)/2;
    roundRect(ctx,PX,PY,PW,PH,8,'rgba(10,12,20,0.97)','#665544');
    ctx.fillStyle='#ccaa88';
    ctx.font='bold 18px monospace';
    ctx.textAlign='left';
    ctx.fillText('MERCHANT',PX+16,PY+28);
    ctx.fillStyle='#887755';
    ctx.font='14px monospace';
    ctx.fillText('Your Gold: '+(G.player.gold||0)+'g',PX+PW-160,PY+28);

    const COLS=4, SZ=68, GAP=8;
    const GX=PX+16, GY=PY+44;

    for (let i=0;i<stock.length;i++) {
      const item=stock[i];
      const col=i%COLS, row=Math.floor(i/COLS);
      const sx=GX+col*(SZ+GAP), sy=GY+row*(SZ+GAP+16);
      roundRect(ctx,sx,sy,SZ,SZ+16,4,'rgba(30,35,45,0.9)','#445');
      const wSpr = item.dmgMin !== undefined ? Sprites.getWeaponSprite(item.id) : null;
      if (wSpr) {
        ctx.drawImage(wSpr, sx + (SZ-32)/2, sy + (SZ-32)/2, 32, 32);
      } else {
        ctx.font='22px serif';
        ctx.textAlign='center';
        ctx.fillText(item.icon||'?',sx+SZ/2,sy+SZ/2+4);
      }
      ctx.font='8px monospace';
      ctx.fillStyle='#aaa';
      ctx.fillText(item.name.slice(0,8),sx+SZ/2,sy+SZ+2);
      ctx.fillStyle='#FFD700';
      ctx.fillText(item.value+'g',sx+SZ/2,sy+SZ+14);
    }

    ctx.fillStyle='#445566';
    ctx.font='11px monospace';
    ctx.textAlign='center';
    ctx.fillText('[E] or click to buy  •  [I] close',PX+PW/2,PY+PH-10);
  }

  return {
    MAX_SLOTS, WEAPON_DEFS, ARMOR_DEFS, CONSUMABLE_DEFS,
    makeWeapon, makeArmor, makeConsume, makeItem, randomDrop,
    initPlayerInventory, addItem, removeItem, equipItem, getDefense,
    getMerchantStock, buyItem, sellItem,
    draw, drawMerchant
  };
})();
