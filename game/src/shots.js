// Screenshot scenes behind ?shot=start|chase|street|heli (with &seed=N).
// Each one plays the real game forward from a fresh state with scripted inputs,
// so the frame is what real play looks like and the same seed always gives it.
// Sets window.__shotReady once the scene is painted twice.
export function stageShot(name, game) {
  const step = 1 / 60;
  const drive = (seconds, steer = 0) => {
    for (let i = 0; i < seconds / step; i++) {
      game.shotInput = { fwd: true, steer };
      game.step(step);
    }
    game.shotInput = null;
  };
  const walk = (seconds) => {
    for (let i = 0; i < seconds / step; i++) {
      game.shotInput = { fwd: true };
      game.step(step);
    }
    game.shotInput = null;
  };
  game.startGame({ silent: true });
  if (name === 'chase') {
    // COVER: driving a gold sports car down Palm Boulevard, wanted 3, cruisers behind.
    game.putPlayerInCar('sport', 0xe0a92e, -120, -40, 0);
    game.police.addHeat(3, 0);
    game.missions.start(0);
    game.hud.setDialogue('SELMA: Take the sedan to the Copper Market meet. No trouble, no heat.');
    drive(7);
    // Extra traffic ahead so the boulevard reads busy, not empty.
    const car0 = game.player.inCar;
    game.traffic.spawn(6, car0.x + Math.sin(car0.heading) * 40, car0.z + Math.cos(car0.heading) * 40);
    drive(1);
    // Park two cruisers flanking the player's tail so the chase reads in one
    // frame. Placed LAST, after all driving, so the pursuit AI cannot chase
    // them out of frame before the render — they must sit BESIDE the car
    // (4 back, 6 to each side): directly behind the car they fall behind the
    // chase camera, and too far to the side they fall outside the view.
    const car = game.player.inCar;
    const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
    const rx = Math.cos(car.heading), rz = -Math.sin(car.heading);
    for (const s of [-6, 6]) {
      const cop = game.police.spawnCar(car.x - fx * 4 + rx * s, car.z - fz * 4 + rz * s);
      cop.heading = car.heading;
      cop.speed = Math.max(20, car.speed * 0.9);
      cop.sync();
    }
    game.state = 'playing';
  } else if (name === 'street') {
    // On foot on the Riverside Promenade: traffic, pedestrians, the Hollow Men ahead.
    // Short walk only — the river starts 40 units south of the promenade.
    game.teleportPlayer(60, 235, 0);
    game.missions.start(3);
    walk(1.5);
    game.state = 'playing';
  } else if (name === 'heli') {
    // Helicopter pursuit at dusk over the river bridges, roadblock ahead, wanted 5.
    game.putPlayerInCar('sport', 0xc23b2e, 120, 240, Math.PI);
    game.police.addHeat(5, 0);
    game.missions.start(5);
    game.clockMinutes = 19 * 60 + 5;
    drive(8);
    // Bring the helicopter low and ahead so it is in frame, and a roadblock ahead.
    const car2 = game.player.inCar;
    game.police.heliHeight = 22;
    game.police.heliRadius = 30;
    game.police.heliAngle = car2.heading;
    const hx = Math.sin(car2.heading), hz = Math.cos(car2.heading);
    game.police.spawnRoadblock(car2.x, car2.z, car2.heading);
    drive(1);
    game.state = 'playing';
  } else {
    // Start screen over a slow orbit of Glass Row (attract mode).
    game.state = 'menu';
    game.menuOrbit = 0;
    game.hud.showMenu('start');
    for (let i = 0; i < 3 / step; i++) game.step(step);
  }
  game.frozen = true;
  game.render();
  game.render();
  window.__shotReady = true;
}
