// Keyboard + mouse input, authored in this recorded build session.
// WASD move/drive, Shift sprint, Space brake/handbrake, E enter/exit car,
// F punch, mouse click (or G) shoot, M mute, P/Esc pause, T mission prompt.
export class Input {
  constructor() {
    this.keys = new Set();
    this.justPressed = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.mouseDown = false;
    this.mouseClicked = false;
    this._onKeyDown = (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.justPressed.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    };
    this._onKeyUp = (e) => this.keys.delete(e.code);
    this._onMouseMove = (e) => { this.mouseDX += e.movementX || 0; this.mouseDY += e.movementY || 0; };
    this._onMouseDown = (e) => { if (e.button === 0) { this.mouseDown = true; this.mouseClicked = true; } };
    this._onMouseUp = (e) => { if (e.button === 0) this.mouseDown = false; };
    this._onBlur = () => { this.keys.clear(); this.mouseDown = false; };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    window.addEventListener('blur', this._onBlur);
  }
  down(code) { return this.keys.has(code); }
  pressed(code) { return this.justPressed.has(code); }
  // Eat a press so a handler that already acted on it (the garage key) does
  // not also fire a second action (a pistol shot) in the same frame.
  consume(code) { this.justPressed.delete(code); }
  any(...codes) { for (const c of codes) if (this.keys.has(c)) return true; return false; }
  pressedAny(...codes) { for (const c of codes) if (this.justPressed.has(c)) return true; return false; }
  endFrame() {
    this.justPressed.clear();
    this.mouseDX = 0; this.mouseDY = 0;
    this.mouseClicked = false;
  }
}
