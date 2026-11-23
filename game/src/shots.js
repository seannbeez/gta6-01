// shots.js — PROJECT VICE. Screenshot staging: ?shot=cover|hurricane|garage|night
// sets the live game to a deterministic, dense frame for real renders. Every shot
// plays the real game state (no fake overlays): the cover is the live chase at
// golden sunset with 4 stars, heli + cone, dispatch list, dialogue and weapon wheel.
// The hint badge is hidden (it fades on first input in real play) and the HUD is
// force-refreshed so the frame shows the staged state at once.
export function stageShot(name, game) {
  const g = game;
  g.hud.setHint(false);
  // stage the pursuit close to the player so cruisers read in-frame and the
  // dispatch distances are tens of metres, not hundreds
  const stageChase = () => {
    g.police.cruisers.forEach((c, i) => {
      const ahead = i < 3;
      c.mesh.position.set(
        (i % 2 === 0 ? -6 : 6) + (i % 3) * 2,
        0,
        g.player.pos.z + (ahead ? -32 - i * 16 : 26 + i * 12)
      );
      c.heading = 0;
      c.mesh.rotation.y = 0;
      c.speed = 30;
    });
  };
  if (name === 'hurricane') {
    g.setWeatherMode('hurricane');
    g.police.setStars(3);
    g.player.pos.set(0, 0, -40);
    g.player.heading = 0;
    g.player.speed = 34;
    stageChase();
    g.hud.setDialogue('MIRA — fixer', 'The storm is here. Drive through it — the cargo does not wait.');
    g.hud.flash('HURRICANE WARNING — SEEK COVER', 'warn');
  } else if (name === 'garage') {
    g.setWeatherMode('sunset');
    g.police.setStars(0);
    // parked on the road facing the beach-side safehouse bay (west), car left of the panel
    g.player.pos.set(-20, 0, 60);
    g.player.heading = Math.PI / 2;
    g.player.speed = 0;
    g.openGarage(true);
    g.hud.setDialogue('DANTE — mechanic', 'Fresh paint, fresh neon. She is ready when you are.');
  } else if (name === 'night') {
    g.setWeatherMode('night');
    g.police.setStars(5);
    g.player.pos.set(0, 0, 10);
    g.player.heading = 0;
    g.player.speed = 38;
    stageChase();
    g.hud.setDialogue('MIRA — fixer', 'Five stars. Lose them on the bridge and the cargo is yours.');
    g.hud.flash('WANTED LEVEL 5 — AIR ONE OVERHEAD', 'hot');
  } else {
    // cover: golden-sunset chase, 4 stars, heli + cone, dispatch, dialogue, wheel
    g.setWeatherMode('sunset');
    g.police.setStars(4);
    g.player.pos.set(0, 0, 26);
    g.player.heading = 0;
    g.player.speed = 36;
    stageChase();
    g.hud.setDialogue('MIRA — fixer', 'Lose them on the bridge and the cargo is yours.');
  }
  // the hero car's mesh follows the staged position/heading at once
  if (g.player.car) {
    g.player.car.position.copy(g.player.pos);
    g.player.car.rotation.y = g.player.heading;
  }
  // snap the chase camera behind the staged car (no slow lerp in screenshots)
  if (g.snapCamera) g.snapCamera();
  if (g.forceHud) g.forceHud();
  // let the frame settle, then signal the screenshot harness
  setTimeout(() => { window.__VICE_READY__ = true; }, 1200);
  return name;
}
