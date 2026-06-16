// ============================================================
//  npcs.js  —  NPC data, dialogue system, merchants
// ============================================================

const NPCs = (() => {

  // ── NPC definitions ──────────────────────────────────────
  const NPC_DATA = {
    edda: {
      name: 'Elder Edda',
      color: '#aacc88', size: 24,
      tx: 28, ty: 29,
      isMerchant: true,
      dialogues: {
        default: [
          "Survivor... you finally woke. I feared the worst.",
          "Aldric's Iron Soldiers burned the eastern farms. Three days ago. You were found in the rubble.",
          "This village — what's left of it — is all we have. But his garrison blocks the southern road. We're trapped.",
          "If you could clear that garrison... we might have a chance. It's at the old watchtower, south-east of here."
        ],
        garrison_cleared: [
          "You cleared the garrison! The road is open again.",
          "I've heard word from the other regions — there are people fighting back.",
          "Seek Commander Vira in Thornwood, and Thane Boros in the Greyspire ruins.",
          "They'll need your help before they trust you. But together... we may just survive this."
        ],
        aldric_dead: [
          "It's over. Aldric is dead. I never thought I'd see the day.",
          "The regions can start to heal now. Thanks to you, Valdrek has a future.",
          "Rest now. You've more than earned it."
        ]
      }
    },

    vira: {
      name: 'Commander Vira',
      color: '#88aa44', size: 24,
      tx: 122, ty: 28,
      isMerchant: true,
      dialogues: {
        default: [
          "Another wanderer? Thornwood's not safe for the uninitiated.",
          "I'm Vira. I've been harassing Aldric's supply lines for months. Not enough.",
          "You want my allegiance? Prove yourself. Destroy the bandit stronghold at the eastern camp.",
          "Those bandits work for Aldric — or at least take his coin. Burn it down and come back."
        ],
        bandit_cleared: [
          "The stronghold is ash. I'm impressed.",
          "My guerrillas are yours to call upon. When the time comes, we'll hit Aldric's supply chain hard.",
          "One more thing — there's a beast in these woods. A great dire wolf. It's been slaughtering my scouts.",
          "If you can deal with it... or even tame it... that would go a long way."
        ],
        ready: [
          "We're ready when you are. Give the word and we march on Ashfeld.",
          "Stay sharp out there. Aldric's elite guard is no joke."
        ]
      }
    },

    boros: {
      name: 'Thane Boros',
      color: '#8888cc', size: 24,
      tx: 28, ty: 122,
      isMerchant: true,
      dialogues: {
        default: [
          "Who goes there? These ruins are no place for wanderers.",
          "I am Boros. Once Thane of the Western March, before Aldric stripped me of everything.",
          "I'll help you fight him, but I need something first. A crown — the Crown of the Free Kings.",
          "Bandits stole it from this very ruin weeks ago. Their fort is in the mountain pass to the south.",
          "Retrieve it. Prove you understand what we're fighting for. Then we talk."
        ],
        crown_retrieved: [
          "The Crown... you actually found it.",
          "This belonged to the last free king of Valdrek, before Aldric's conquest. It's a symbol.",
          "When we raise it at the citadel gates, Aldric's own soldiers may hesitate. That hesitation could win the day.",
          "I'm with you. My remaining soldiers march at your command.",
          "One request: when this is over, we hold a proper council. No more warlords."
        ],
        ready: [
          "The Mountain Company is ready. Say the word.",
          "For Valdrek. For the free people. Let's end this."
        ]
      }
    },

    merchant: {
      name: 'Traveling Merchant',
      color: '#ccaa44', size: 22,
      tx: 75, ty: 25,
      isMerchant: true,
      dialogues: {
        default: [
          "Ah, a customer! Rare sight these days with the soldiers everywhere.",
          "I've got goods from all across Valdrek. Prices are fair — well, fair enough.",
          "Careful out there. These roads aren't safe anymore."
        ]
      }
    }
  };

  let npcs = [];

  function spawnAll() {
    npcs = [];
    for (const [id, def] of Object.entries(NPC_DATA)) {
      npcs.push({
        id, name:def.name, color:def.color, size:def.size,
        x: def.tx*TILE_SIZE, y: def.ty*TILE_SIZE,
        w: def.size, h: def.size,
        isMerchant: def.isMerchant||false,
        dialogueStage: 'default',
        interactRadius: 52,
        bobOffset: Math.random()*Math.PI*2
      });
    }
    return npcs;
  }

  function getNearbyNPC(px, py, pw, ph) {
    for (const npc of npcs) {
      const d=dist(px+pw/2,py+ph/2,npc.x+npc.w/2,npc.y+npc.h/2);
      if (d<npc.interactRadius) return npc;
    }
    return null;
  }

  function getDialogue(npc, G) {
    const def = NPC_DATA[npc.id];
    if (!def) return ['...'];

    // Pick dialogue based on quest state
    const qstate = Quests.getQuestState(G);

    if (npc.id==='edda') {
      if (qstate.aldric_killed)       return def.dialogues.aldric_dead;
      if (qstate.garrison_cleared)    return def.dialogues.garrison_cleared;
      return def.dialogues.default;
    }
    if (npc.id==='vira') {
      if (qstate.vira_allied)         return def.dialogues.ready;
      if (qstate.bandit_cleared)      return def.dialogues.bandit_cleared;
      return def.dialogues.default;
    }
    if (npc.id==='boros') {
      if (qstate.boros_allied)        return def.dialogues.ready;
      if (qstate.crown_retrieved)     return def.dialogues.crown_retrieved;
      return def.dialogues.default;
    }
    return def.dialogues.default||['...'];
  }

  function startDialogue(npc, G) {
    const lines = getDialogue(npc, G);
    G.ui.dialogue = {
      npc,
      lines,
      index: 0,
      showMerchant: false
    };
    Audio.play('menu');
  }

  function advanceDialogue(G) {
    const dlg = G.ui.dialogue;
    if (!dlg) return;
    dlg.index++;
    if (dlg.index >= dlg.lines.length) {
      // Check if npc is merchant — offer shop
      if (dlg.npc.isMerchant) {
        dlg.showMerchant=true;
        G.ui.merchantStock = Inventory.getMerchantStock(dlg.npc.id);
      } else {
        G.ui.dialogue=null;
      }
    }
    Audio.play('menu');
  }

  function closeDialogue(G) {
    G.ui.dialogue=null;
    G.ui.merchantOpen=null;
    G.ui.merchantStock=null;
  }

  // ── Draw NPCs ────────────────────────────────────────────
  function draw(ctx, npcs, cam, time) {
    for (const npc of npcs) {
      const sx = npc.x - cam.x, sy = npc.y - cam.y;
      if (sx < -60 || sy < -60 || sx > CANVAS_W + 60 || sy > CANVAS_H + 60) continue;
      const bob = Math.sin(time * 2 + npc.bobOffset) * 2;
      const cx = sx + npc.w / 2;
      const by = sy + bob; // base y with bob offset

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath();
      ctx.ellipse(cx, by + npc.h + 2, npc.w * 0.38, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Legs
      ctx.fillStyle = adjustRGB(hexToRgb(npc.color), -30);
      ctx.fillRect(cx - 8, by + npc.h * 0.58, 7, 11);
      ctx.fillRect(cx + 1, by + npc.h * 0.58, 7, 11);

      // Body
      ctx.fillStyle = npc.color;
      ctx.fillRect(cx - 9, by + npc.h * 0.27, 18, npc.h * 0.43);

      // Merchant bag / quest scroll detail
      if (npc.isMerchant) {
        ctx.fillStyle = '#8B6914';
        ctx.fillRect(cx - 14, by + npc.h * 0.38, 6, 8);
        ctx.fillStyle = '#C8960A';
        ctx.fillRect(cx - 13, by + npc.h * 0.39, 4, 6);
      } else {
        // Scroll / quest item in hand
        ctx.fillStyle = '#f5deb3';
        ctx.fillRect(cx + 8, by + npc.h * 0.33, 5, 9);
        ctx.fillStyle = '#8B6914';
        ctx.fillRect(cx + 8, by + npc.h * 0.33, 5, 2);
        ctx.fillRect(cx + 8, by + npc.h * 0.33 + 7, 5, 2);
      }

      // Arms
      ctx.fillStyle = adjustRGB(hexToRgb(npc.color), -15);
      ctx.fillRect(cx - 14, by + npc.h * 0.3, 6, 10);
      ctx.fillRect(cx + 8, by + npc.h * 0.3, 6, 10);

      // Head
      ctx.fillStyle = '#d4a76a';
      ctx.beginPath();
      ctx.arc(cx, by + npc.h * 0.17, 9, 0, Math.PI * 2);
      ctx.fill();

      // Hat / hood specific to role
      if (npc.isMerchant) {
        // Wide-brimmed merchant hat
        ctx.fillStyle = '#553311';
        ctx.fillRect(cx - 11, by + npc.h * 0.08, 22, 4);
        ctx.fillRect(cx - 7, by + npc.h * 0.02, 14, 8);
        ctx.fillStyle = '#aa7733';
        ctx.fillRect(cx - 9, by + npc.h * 0.08, 18, 2);
      } else {
        // Simple hood
        ctx.fillStyle = adjustRGB(hexToRgb(npc.color), 10);
        ctx.beginPath();
        ctx.arc(cx, by + npc.h * 0.14, 9, Math.PI, 2 * Math.PI);
        ctx.fill();
      }

      // Friendly glow outline
      ctx.strokeStyle = 'rgba(255,255,160,0.5)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(cx - 9, by + npc.h * 0.27, 18, npc.h * 0.43);

      // Name above
      ctx.fillStyle = '#ffffcc';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(npc.name, cx, by - 5);
    }
  }

  function hexToRgb(hex) {
    const r = parseInt(hex.slice(1,3), 16);
    const g = parseInt(hex.slice(3,5), 16);
    const b = parseInt(hex.slice(5,7), 16);
    return [r, g, b];
  }

  function drawInteractHint(ctx, G, cam, time) {
    if (!G.player||G.ui.dialogue) return;
    const npc=getNearbyNPC(G.player.x,G.player.y,Player.PLAYER_W,Player.PLAYER_H);
    if (!npc) return;
    const sx=npc.x-cam.x+npc.w/2, sy=npc.y-cam.y-18;
    const pulse=0.75+Math.sin(time*4)*0.25;
    ctx.globalAlpha=pulse;
    ctx.fillStyle='#ffffc0';
    ctx.font='bold 11px monospace';
    ctx.textAlign='center';
    ctx.fillText('[E] Talk'+(npc.isMerchant?' / Shop':''), sx, sy);
    ctx.globalAlpha=1;
  }

  return { spawnAll, draw, drawInteractHint, getNearbyNPC, startDialogue, advanceDialogue, closeDialogue, get list() { return npcs; } };
})();
