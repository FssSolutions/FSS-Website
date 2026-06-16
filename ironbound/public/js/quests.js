// ============================================================
//  quests.js  —  Quest definitions, tracking, progress
// ============================================================

const Quests = (() => {

  // Quest state flags stored on G.questFlags
  const defaultFlags = {
    // Main quest
    garrison_cleared: false,
    vira_allied: false,
    bandit_cleared: false,
    boros_allied: false,
    crown_retrieved: false,
    supply_hit: false,
    citadel_entered: false,
    aldric_killed: false,

    // Side quests
    hunters_rescued: false,
    beast_killed: false,
    beast_spared: false,
    merchant_helped: false,

    // Progress counters
    garrison_kills: 0,    // need 8 soldiers at garrison
    hunters_found: false,
    bandit_kills: 0,      // need 10 bandits
    crown_item: false     // player has crown in inventory
  };

  const QUEST_DEFS = [
    {
      id: 'clear_garrison',
      title: 'Iron Grip',
      region: 'Frostholm',
      giver: 'Elder Edda',
      description: 'Aldric\'s garrison blocks the only road south. Clear the Iron Soldiers from the garrison compound.',
      objectives: [
        { text: 'Defeat Iron Soldiers at the garrison (0/8)', done: f=>f.garrison_kills>=8 },
        { text: 'Return to Elder Edda', done: f=>f.garrison_cleared }
      ],
      reward: { xp:120, gold:40, item:'leatherchest' },
      isDone: f=>f.garrison_cleared,
      isActive: f=>!f.garrison_cleared
    },
    {
      id: 'missing_hunters',
      title: 'The Missing Hunters',
      region: 'Frostholm',
      giver: 'Village Board',
      description: 'Three hunters went into the tundra caves and never returned. Find them.',
      objectives: [
        { text: 'Search the tundra cave', done: f=>f.hunters_found },
        { text: 'Rescue the captured hunters', done: f=>f.hunters_rescued }
      ],
      reward: { xp:80, gold:30 },
      isDone: f=>f.hunters_rescued,
      isActive: f=>!f.hunters_rescued
    },
    {
      id: 'beast_of_thornwood',
      title: 'Beast of Thornwood',
      region: 'Thornwood',
      giver: 'Commander Vira',
      description: 'A massive dire wolf stalks the forest, slaughtering scouts. Track it down.',
      objectives: [
        { text: 'Find and confront the dire wolf', done: f=>f.beast_killed||f.beast_spared }
      ],
      reward: { xp:200, gold:60, item:'frostaxe' },
      isDone: f=>f.beast_killed||f.beast_spared,
      isActive: f=>(!f.beast_killed&&!f.beast_spared)&&f.garrison_cleared
    },
    {
      id: 'the_stolen_crown',
      title: 'The Stolen Crown',
      region: 'Greyspire',
      giver: 'Thane Boros',
      description: 'An artifact crown was stolen from the ruins by a bandit lord. Retrieve it for Thane Boros.',
      objectives: [
        { text: 'Find the bandit lord\'s stronghold', done: f=>f.bandit_kills>=10 },
        { text: 'Retrieve the Crown of Free Kings', done: f=>f.crown_item },
        { text: 'Return the crown to Thane Boros', done: f=>f.crown_retrieved }
      ],
      reward: { xp:250, gold:80, item:'ironbow' },
      isDone: f=>f.crown_retrieved,
      isActive: f=>!f.crown_retrieved&&f.garrison_cleared
    },
    {
      id: 'merchants_debt',
      title: "Merchant's Debt",
      region: 'Any',
      giver: 'Traveling Merchant',
      description: 'A merchant is being threatened by an Iron enforcer demanding tribute. Help him.',
      objectives: [
        { text: 'Deal with the Iron Enforcer (fight or bribe)', done: f=>f.merchant_helped }
      ],
      reward: { xp:60, gold:50 },
      isDone: f=>f.merchant_helped,
      isActive: f=>!f.merchant_helped
    },
    {
      id: 'strike_aldric',
      title: 'End the Iron Reign',
      region: 'Ashfeld',
      giver: 'Commander Vira & Thane Boros',
      description: 'With allies rallied, push into Ashfeld and defeat Aldric the Iron in the Iron Citadel.',
      objectives: [
        { text: 'Rally Commander Vira', done: f=>f.vira_allied },
        { text: 'Rally Thane Boros',    done: f=>f.boros_allied },
        { text: 'Enter the Iron Citadel', done: f=>f.citadel_entered },
        { text: 'Defeat Aldric the Iron', done: f=>f.aldric_killed }
      ],
      reward: { xp:1000, gold:200 },
      isDone: f=>f.aldric_killed,
      isActive: f=>!f.aldric_killed
    }
  ];

  function initFlags() {
    return Object.assign({}, defaultFlags);
  }

  function getQuestState(G) {
    return G.questFlags || defaultFlags;
  }

  function onEnemyKilled(e, G) {
    const f=G.questFlags;
    if (!f) return;
    const ex=e.x, ey=e.y;
    const reg=World.getRegionAt(ex,ey);

    if (e.type==='soldier' && reg==='frostholm') {
      // Check if near garrison area (tiles 65-80, 65-80)
      const etx=Math.floor(ex/TILE_SIZE), ety=Math.floor(ey/TILE_SIZE);
      if (etx>=60&&etx<=85&&ety>=60&&ety<=85) {
        f.garrison_kills=Math.min(f.garrison_kills+1,8);
        if (f.garrison_kills>=8 && !f.garrison_cleared) {
          f.garrison_cleared=true;
          G.ui.notification={text:'Quest Updated: Iron Grip',color:'#ffffaa',timer:4};
          Player.gainXP(G.player,60,G);
        }
      }
    }
    if ((e.type==='bandit'||e.type==='heavysoldier') && reg==='greyspire') {
      f.bandit_kills=Math.min(f.bandit_kills+1,10);
    }
    if ((e.type==='bandit'||e.type==='heavysoldier') && reg==='thornwood') {
      if (f.garrison_cleared) f.bandit_kills=Math.min(f.bandit_kills+1,10);
    }
    if (e.type==='direwolfboss') {
      f.beast_killed=true;
      G.ui.notification={text:'Quest Complete: Beast of Thornwood',color:'#ffffaa',timer:4};
      if (!f.vira_allied) f.vira_allied=true;
    }
    if (e.type==='aldric') {
      f.aldric_killed=true;
      G.phase='win';
    }

    // Check garrison for quest trigger
    if (!f.garrison_cleared && reg==='frostholm') checkGarrisonQuest(G);
  }

  function checkGarrisonQuest(G) {
    const f=G.questFlags;
    if (f.garrison_kills>=8&&!f.garrison_cleared) {
      f.garrison_cleared=true;
      // Unlock Thornwood
      G.ui.notification={text:'Garrison cleared! The road south is open.',color:'#aaffaa',timer:5};
    }
  }

  function onChestOpened(tx, ty, G) {
    const f=G.questFlags;
    // Crown chest is at Greyspire fortress area
    if (tx>=55&&tx<=75&&ty>=155&&ty<=175) {
      f.crown_item=true;
      Inventory.addItem(G.player, {
        id:'freedomcrown', name:'Crown of Free Kings',
        type:'quest', icon:'👑', rarity:'legendary', value:0,
        desc:'The ancient symbol of Valdrek\'s freedom.',uid:'crown_'+Date.now()
      });
      G.ui.notification={text:'Found the Crown of Free Kings!',color:'#FFD700',timer:5};
      // Auto-complete if boros is met
      if (!f.crown_retrieved) {
        G.ui.notification={text:'Return the crown to Thane Boros.',color:'#ffffaa',timer:5};
      }
    }
    // Hunters in tundra cave
    if (tx>=46&&tx<=54&&ty>=32&&ty<=42) {
      if (!f.hunters_found) {
        f.hunters_found=true;
        f.hunters_rescued=true;
        G.ui.notification={text:'Quest Complete: The Missing Hunters!',color:'#aaffaa',timer:5};
        Player.gainXP(G.player,80,G);
        G.player.gold=(G.player.gold||0)+30;
      }
    }
  }

  function onBonfireRested(bfId, G) {
    const f=G.questFlags;
    if (bfId==='citadel'&&!f.citadel_entered) {
      f.citadel_entered=true;
      G.ui.notification={text:'You have entered the Iron Citadel.',color:'#ffaaaa',timer:4};
    }
  }

  function onNPCInteractComplete(npcId, G) {
    const f=G.questFlags;
    if (npcId==='vira' && f.bandit_cleared && !f.vira_allied) {
      f.vira_allied=true;
      G.ui.notification={text:'Commander Vira has joined your cause!',color:'#aaffaa',timer:4};
      Player.gainXP(G.player,120,G);
    }
    if (npcId==='boros' && f.crown_retrieved && !f.boros_allied) {
      f.boros_allied=true;
      G.ui.notification={text:'Thane Boros has joined your cause!',color:'#aaffaa',timer:4};
      Player.gainXP(G.player,150,G);
    }
  }

  function checkBanditCleared(G) {
    const f=G.questFlags;
    if (f.bandit_kills>=10 && !f.bandit_cleared) {
      f.bandit_cleared=true;
      G.ui.notification={text:'Quest Updated: Bandit camp destroyed!',color:'#ffffaa',timer:4};
    }
  }

  function checkCrownReturned(G) {
    const f=G.questFlags;
    if (f.crown_item && !f.crown_retrieved) {
      // Check if player is near Boros
      const boros=NPCs.list.find(n=>n.id==='boros');
      if (boros) {
        const d=dist(G.player.x,G.player.y,boros.x,boros.y);
        if (d<80) {
          f.crown_retrieved=true;
          // Remove crown from inventory
          G.player.inventory=G.player.inventory.filter(i=>i.id!=='freedomcrown');
          G.ui.notification={text:'Quest Complete: The Stolen Crown!',color:'#FFD700',timer:5};
          Player.gainXP(G.player,250,G);
          G.player.gold=(G.player.gold||0)+80;
          if (!f.boros_allied) onNPCInteractComplete('boros',G);
        }
      }
    }
  }

  function update(G) {
    if (!G.questFlags||!G.player) return;
    checkBanditCleared(G);
    checkCrownReturned(G);
    checkMerchantDebt(G);
  }

  function checkMerchantDebt(G) {
    const f=G.questFlags;
    if (!f.merchant_helped) {
      // Auto-help if player has enough gold (simplified)
      if ((G.player.gold||0)>200 && !f.merchant_helped) {
        // Player passes by merchant location
        const merch=NPCs.list.find(n=>n.id==='merchant');
        if (merch) {
          const d=dist(G.player.x,G.player.y,merch.x,merch.y);
          if (d<60) {
            // Trigger automatically on interaction
          }
        }
      }
    }
  }

  // ── Quest log draw ───────────────────────────────────────
  function draw(ctx, G) {
    const f=G.questFlags||{};
    const PW=520,PH=440,PX=(CANVAS_W-PW)/2,PY=(CANVAS_H-PH)/2;
    roundRect(ctx,PX,PY,PW,PH,8,'rgba(10,12,18,0.96)','#445');
    ctx.fillStyle='#aabbcc';
    ctx.font='bold 18px monospace';
    ctx.textAlign='left';
    ctx.fillText('QUEST LOG',PX+16,PY+28);

    let yOff=PY+48;
    const ACTIVE_COLOR='#ffffaa', DONE_COLOR='#66aa55', INACTIVE_COLOR='#556677';

    for (const q of QUEST_DEFS) {
      const done=q.isDone(f);
      const active=q.isActive(f)&&!done;
      const color=done?DONE_COLOR:active?ACTIVE_COLOR:INACTIVE_COLOR;

      ctx.fillStyle=color;
      ctx.font='bold 13px monospace';
      ctx.fillText((done?'✓ ':active?'► ':'  ')+q.title, PX+16, yOff);
      ctx.font='10px monospace';
      ctx.fillStyle='#8899aa';
      ctx.fillText('['+q.region+'] '+q.giver, PX+20, yOff+13);

      if (active) {
        // Show objectives
        for (const obj of q.objectives) {
          const objDone=obj.done(f);
          ctx.fillStyle=objDone?'#66aa55':'#aabbcc';
          ctx.font='11px monospace';
          ctx.fillText('  '+(objDone?'✓':'○')+' '+obj.text, PX+20, yOff+26);
          yOff+=14;
        }
        yOff+=8;
      }

      yOff+=32;
      if (yOff>PY+PH-20) break;
    }

    ctx.fillStyle='#445566';
    ctx.font='11px monospace';
    ctx.textAlign='center';
    ctx.fillText('[L] Close',PX+PW/2,PY+PH-10);
  }

  return { initFlags, getQuestState, onEnemyKilled, onChestOpened, onBonfireRested, onNPCInteractComplete, update, draw };
})();
