const STORAGE_BEST = 'void_best';
const STORAGE_INSTANT = 'void_auto_restart';

class VoidRunnerScene extends Phaser.Scene {
  constructor() {
    super('VoidRunner');
  }

  // ===== setup =====
  create() {
    this.palette = {
      bg: 0x050505,
      white: 0xffffff,
      red: 0xff004c,
      green: 0x7dffb1,
      blue: 0x7ec8ff
    };

    this.best = Number(localStorage.getItem(STORAGE_BEST) || 0);
    this.instantRestart = localStorage.getItem(STORAGE_INSTANT) === 'true';

    this.score = 0;
    this.speed = 8;
    this.spawnTimer = 60;
    this.gameOver = false;
    this.pressHeld = false;
    this.mobile = false;
    this.runnerScale = 1;

    this.obstacles = [];

    this.createBackground();
    this.createPlayer();
    this.createUI();
    this.resizeGame();
    this.bindInput();
    this.resetGame();

    this.scale.on('resize', this.resizeGame, this);
  }

  createBackground() {
    this.grid = this.add.graphics();
    this.groundLine = this.add.graphics();
    this.stars = this.add.graphics();
  }

  createPlayer() {
    this.playerGlow = this.add.rectangle(0, 0, 42, 42, this.palette.white, 0.2).setOrigin(0, 0);
    this.player = this.add.rectangle(0, 0, 40, 40, this.palette.white).setOrigin(0, 0);
  }

  createUI() {
    this.scoreText = this.add.text(14, 10, '', { fontFamily: 'monospace', fontSize: '14px', color: '#ffffff' });
    this.bestText = this.add.text(110, 10, '', { fontFamily: 'monospace', fontSize: '14px', color: '#7ec8ff' });
    this.modeText = this.add.text(0, 10, 'FLOW', { fontFamily: 'monospace', fontSize: '14px', color: '#7dffb1' }).setOrigin(1, 0);
    this.hintText = this.add.text(0, 0, 'TAP · HOLD · DOUBLE', { fontFamily: 'monospace', fontSize: '11px', color: '#8f8f8f' }).setOrigin(0.5, 1);

    this.overlay = this.add.container(0, 0).setDepth(30).setVisible(false);
    this.overlayBg = this.add.rectangle(0, 0, 10, 10, 0x040404, 0.84).setOrigin(0, 0);
    this.panel = this.add.rectangle(0, 0, 420, 300, 0x0b0b0b, 0.95).setStrokeStyle(1, 0x3a3a3a, 1).setOrigin(0.5);
    this.title = this.add.text(0, -98, 'GAME OVER', { fontFamily: 'monospace', fontSize: '32px', color: '#ffffff' }).setOrigin(0.5);
    this.finalScore = this.add.text(0, -52, '', { fontFamily: 'monospace', fontSize: '15px', color: '#7ec8ff' }).setOrigin(0.5);
    this.finalBest = this.add.text(0, -28, '', { fontFamily: 'monospace', fontSize: '15px', color: '#7dffb1' }).setOrigin(0.5);

    this.restartBtn = this.makeButton('RESTART', 0, 20, this.palette.white, () => this.resetGame());
    this.resetBestBtn = this.makeButton('RESET BEST', 0, 68, this.palette.blue, () => {
      this.best = 0;
      localStorage.setItem(STORAGE_BEST, '0');
      this.updateHud();
      this.updateGameOverText();
    });
    this.instantBtn = this.makeButton('', 0, 116, this.palette.red, () => {
      this.instantRestart = !this.instantRestart;
      localStorage.setItem(STORAGE_INSTANT, String(this.instantRestart));
      this.refreshInstantLabel();
    });

    this.overlay.add([
      this.overlayBg,
      this.panel,
      this.title,
      this.finalScore,
      this.finalBest,
      this.restartBtn.container,
      this.resetBestBtn.container,
      this.instantBtn.container
    ]);
    this.refreshInstantLabel();
  }

  makeButton(label, x, y, accentColor, onPress) {
    const container = this.add.container(x, y);
    const bg = this.add.rectangle(0, 0, 204, 34, 0xffffff, 0.06).setStrokeStyle(1, accentColor, 0.8).setOrigin(0.5);
    const text = this.add.text(0, 0, label, { fontFamily: 'monospace', fontSize: '14px', color: '#ffffff' }).setOrigin(0.5);
    container.add([bg, text]);
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerdown', (pointer) => {
      pointer.event?.preventDefault?.();
      onPress();
    });
    return { container, bg, text };
  }

  refreshInstantLabel() {
    this.instantBtn.text.setText(this.instantRestart ? 'INSTANT: ON' : 'INSTANT: OFF');
    this.instantBtn.bg.setFillStyle(this.instantRestart ? this.palette.red : 0xffffff, this.instantRestart ? 0.2 : 0.06);
  }

  // ===== input =====
  bindInput() {
    this.input.keyboard.on('keydown-SPACE', (e) => {
      e.preventDefault();
      if (!e.repeat) this.startPress();
    });
    this.input.keyboard.on('keyup-SPACE', () => this.endPress());

    this.input.on('pointerdown', (pointer) => {
      pointer.event?.preventDefault?.();
      if (!this.overlay.visible) this.startPress();
    });
    this.input.on('pointerup', () => this.endPress());

    const blocker = (e) => e.preventDefault();
    ['selectstart', 'contextmenu', 'dragstart', 'dblclick', 'touchstart', 'touchmove', 'touchend'].forEach((type) => {
      document.addEventListener(type, blocker, { passive: false });
    });
  }

  // ===== setup/layout =====
  resizeGame() {
    const w = this.scale.width;
    const h = this.scale.height;

    this.mobile = w < 720 && h > w;
    this.runnerScale = this.mobile ? 0.72 : 1;

    this.playerSize = this.mobile ? 30 : 40;
    this.playerX = this.mobile ? 76 : 122;
    this.gravity = this.mobile ? 0.82 : 0.92;
    this.fallGravity = this.mobile ? 1.06 : 1.18;
    this.jumpPower = this.mobile ? -13.5 : -15.5;
    this.holdLift = this.mobile ? -0.45 : -0.55;
    this.maxHoldFrames = 16;

    // raise ground on mobile for less cramped feel
    this.groundY = h - (this.mobile ? Math.max(210, h * 0.33) : Math.max(110, h * 0.19));

    this.player.setSize(this.playerSize, this.playerSize);
    this.playerGlow.setSize(this.playerSize + 8, this.playerSize + 8);

    if (!this.gameOver) {
      this.player.x = this.playerX;
      this.player.y = this.groundY - this.playerSize;
      this.playerGlow.x = this.player.x - 4;
      this.playerGlow.y = this.player.y - 4;
    }

    this.scoreText.setFontSize(this.mobile ? '12px' : '14px').setPosition(12, 10);
    this.bestText.setFontSize(this.mobile ? '12px' : '14px').setPosition(this.mobile ? 88 : 96, 10);
    this.modeText.setFontSize(this.mobile ? '12px' : '14px').setPosition(w - 12, 10);
    this.hintText.setFontSize(this.mobile ? '10px' : '11px').setPosition(w / 2, h - 10);

    this.overlayBg.setSize(w, h);
    this.panel.setSize(Math.min(420, w - 24), 300).setPosition(w / 2, h / 2);
    this.title.setPosition(w / 2, h / 2 - 98);
    this.finalScore.setPosition(w / 2, h / 2 - 52);
    this.finalBest.setPosition(w / 2, h / 2 - 28);
    this.restartBtn.container.setPosition(w / 2, h / 2 + 20);
    this.resetBestBtn.container.setPosition(w / 2, h / 2 + 68);
    this.instantBtn.container.setPosition(w / 2, h / 2 + 116);

    this.redrawWorld();
  }

  // ===== drawing/UI =====
  redrawWorld() {
    const w = this.scale.width;
    const h = this.scale.height;

    this.grid.clear();
    this.grid.fillStyle(this.palette.white, 0.03);
    for (let x = 0; x < w; x += 44) this.grid.fillRect(x, 0, 1, h);

    this.stars.clear();
    this.stars.fillStyle(this.palette.blue, 0.22);
    const starCount = this.mobile ? 40 : 64;
    for (let i = 0; i < starCount; i += 1) {
      const sx = (i * 67) % w;
      const sy = (i * 41) % (this.groundY - 30);
      this.stars.fillRect(sx, sy, 1, 1);
    }

    this.groundLine.clear();
    this.groundLine.fillStyle(this.palette.white, 0.8);
    this.groundLine.fillRect(0, this.groundY, w, 1.5);
  }

  updateHud() {
    this.scoreText.setText(`SCORE ${Math.floor(this.score)}`);
    this.bestText.setText(`BEST ${this.best}`);
  }

  // ===== game over logic =====
  updateGameOverText() {
    this.finalScore.setText(`SCORE ${Math.floor(this.score)}`);
    this.finalBest.setText(`BEST ${this.best}`);
  }

  die() {
    const s = Math.floor(this.score);
    if (s > this.best) {
      this.best = s;
      localStorage.setItem(STORAGE_BEST, String(this.best));
    }

    if (this.instantRestart) {
      this.resetGame();
      return;
    }

    this.gameOver = true;
    this.updateHud();
    this.updateGameOverText();
    this.overlay.setVisible(true);
  }

  resetGame() {
    this.obstacles.forEach((o) => o.destroy());
    this.obstacles = [];
    this.score = 0;
    this.speed = this.mobile ? 6.4 : 8;
    this.spawnTimer = this.mobile ? 94 : 62;
    this.gameOver = false;
    this.pressHeld = false;
    this.playerVelY = 0;
    this.jumpsLeft = 2;
    this.holdFrames = 0;

    this.player.x = this.playerX;
    this.player.y = this.groundY - this.playerSize;
    this.playerGlow.x = this.player.x - 4;
    this.playerGlow.y = this.player.y - 4;

    this.overlay.setVisible(false);
    this.updateHud();
  }

  startPress() {
    if (this.gameOver) {
      this.resetGame();
      return;
    }

    if (!this.pressHeld && this.jumpsLeft > 0) {
      this.playerVelY = this.jumpPower;
      this.jumpsLeft -= 1;
      this.holdFrames = 0;
      this.player.y -= 1;
    }

    this.pressHeld = true;
  }

  endPress() {
    this.pressHeld = false;
    if (this.playerVelY < -4) this.playerVelY *= 0.55;
  }

  // ===== obstacle spawning =====
  spawnObstacle() {
    const h = (34 + Math.random() * 58) * this.runnerScale;
    const w = (20 + Math.random() * 28) * this.runnerScale;
    const obstacle = this.add.container(this.scale.width + (this.mobile ? 164 : 72), this.groundY - h);

    const block = this.mobile ? 5 : 6;
    for (let y = 0; y < h; y += block) {
      for (let x = 0; x < w; x += block) {
        if ((x + y) % (block * 2) === 0 || Math.random() > 0.2) {
          const px = this.add.rectangle(x, y, block - 1, block - 1, this.palette.red, 0.95).setOrigin(0, 0);
          obstacle.add(px);
        }
      }
    }

    obstacle.setSize(w, h);
    this.obstacles.push(obstacle);
  }

  // ===== physics =====
  update(_time, deltaMs) {
    const dt = Math.min(deltaMs / 16.67, 2);
    if (this.gameOver) return;

    const onGround = this.player.y >= this.groundY - this.playerSize - 0.5 && this.playerVelY >= 0;

    if (onGround) {
      this.player.y = this.groundY - this.playerSize;
      this.playerVelY = 0;
      this.jumpsLeft = 2;
      this.holdFrames = 0;
    } else if (this.pressHeld && this.holdFrames < this.maxHoldFrames && this.playerVelY < 0) {
      this.playerVelY += this.holdLift * dt;
      this.holdFrames += dt;
    }

    const g = this.pressHeld && this.playerVelY < 0 ? this.gravity : this.fallGravity;
    this.playerVelY += g * dt;
    this.player.y += this.playerVelY * dt;

    if (this.player.y > this.groundY - this.playerSize) this.player.y = this.groundY - this.playerSize;

    this.playerGlow.x = this.player.x - 4;
    this.playerGlow.y = this.player.y - 4;

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnObstacle();
      this.spawnTimer = (this.mobile ? Math.max(76, 146 - this.speed * 3) : Math.max(50, 108 - this.speed * 2)) + Math.random() * (this.mobile ? 56 : 40);
    }

    this.obstacles = this.obstacles.filter((o) => {
      o.x -= this.speed * dt;
      if (o.x + o.width < 0) {
        o.destroy();
        return false;
      }

      const hit = this.player.x < o.x + o.width && this.player.x + this.playerSize > o.x && this.player.y < o.y + o.height && this.player.y + this.playerSize > o.y;
      if (hit) this.die();
      return true;
    });

    this.score += 0.06 * dt;
    this.speed += (this.mobile ? 0.00072 : 0.00112) * dt;
    this.updateHud();
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#050505',
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: window.innerWidth,
    height: window.innerHeight
  },
  scene: [VoidRunnerScene]
});
