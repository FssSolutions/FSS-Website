// ============================================================
//  sprites.js  —  Sprite loading and lookup
// ============================================================

const Sprites = (() => {
  const _cache = {};
  const DIRS = ['south','south-east','east','north-east','north','north-west','west','south-west'];
  const ENEMY_TYPES = ['soldier','wolf','bandit','direwolf','guardian','heavysoldier','eliteguard','ironguard','direwolfboss','aldric'];
  const WEAPON_IDS = ['sword','shortsword','axe','daggers','runesword','bow','throwaxe','frostaxe','flameblade','shadowdagger','ironbow','greatsword','runeaxe','ironbreaker'];
  const DUSK_PATH = '/sprites/duskwalker';

  function _loadImg(key, src) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload  = () => { _cache[key] = img;  resolve(); };
      img.onerror = () => { _cache[key] = null; resolve(); };
      img.src = src;
    });
  }

  function preload() {
    const jobs = [];
    for (const dir of DIRS) {
      jobs.push(_loadImg(`p_ironclad_${dir}`,   `/sprites/ironclad/${dir}.png`));
      jobs.push(_loadImg(`p_duskwalker_${dir}`,  `${DUSK_PATH}/${dir}.png`));
      jobs.push(_loadImg(`p_runebound_${dir}`,   `/sprites/runebound/${dir}.png`));
    }
    for (const type of ENEMY_TYPES) {
      for (const dir of DIRS) {
        jobs.push(_loadImg(`e_${type}_${dir}`, `/sprites/enemies/${type}/${dir}.png`));
      }
    }
    for (const id of WEAPON_IDS) {
      jobs.push(_loadImg(`w_${id}`, `/sprites/weapons/${id}.png`));
    }
    return Promise.all(jobs);
  }

  // Convert radian angle to one of 8 direction strings.
  // Math.atan2 convention: east=0, south=PI/2, west=PI, north=-PI/2
  function angleToDir(rad) {
    const dirs = ['east','south-east','south','south-west','west','north-west','north','north-east'];
    const angle = ((rad % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const idx = Math.round(angle / (Math.PI / 4)) % 8;
    return dirs[idx];
  }

  function getPlayerSprite(playerClass, dir) { return _cache[`p_${playerClass}_${dir}`] || null; }
  function getEnemySprite(type, dir)         { return _cache[`e_${type}_${dir}`]        || null; }
  function getWeaponSprite(id)               { return _cache[`w_${id}`]                 || null; }

  return { preload, angleToDir, getPlayerSprite, getEnemySprite, getWeaponSprite };
})();
