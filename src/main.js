const STORAGE_BEST = 'void_best';
const STORAGE_INSTANT = 'void_auto_restart';

class VoidRunnerScene extends Phaser.Scene {
  constructor() {
    super('VoidRunner');
  }

  create() {
    this.bgColor = 0x030303;
    this.playerColor = 0xffffff;
    this.obstacleColor = 0xff004c;
    this.gridColor = 0xffffff;
    this.groundColor = 0xffffff;

    this.best = Number(localStorage.getItem(STORAGE_BEST) || 0);
    this.instantRestart = localStorage.getItem(STORAGE_INSTANT) === 'true';

    this.score = 0;
    this.speed = 8;
    this.spawnTimer = 60;
    this.gameOver = false;
    this.pressHeld = false;
    this.mobile = false;
    this.runnerScale = 1;
    this.stars = [];

    this.obstacles = this.physics.add.group({ allowGravity: false, immovable: true });

    this.buildGraphics();
    this.buildPlayer();
    this.buildUI();
    this.bindInput();
    this.resizeGame();
    this.resetGame();

    this.scale.on('resize', this.resizeGame, this);
  }

  buildGraphics() {
    this.grid = this.add.graphics();
    this.starLayer = this.add.graphics();
    this.groundLine = this.add.graphics();
  }

  buildPlayer() {
    this.playerGlow = this.add.rectangle(0, 0, 42, 42, this.playerColor, 0.08).setOrigin(0, 0);
    this.player = this.add.rectangle(0, 0, 32, 32, this.playerColor).setOrigin(0, 0);
    this.physics.add.existing(this.player);
    this.playerBody = this.player.body;
    this.playerBody.setAllowGravity(false);
  }

  buildUI() {
    const hudStyle = { fontFamily: 'monospace', fontSize: '11px', color: '#d8d8d8', letterSpacing: 2 };
    this.scoreText = this.add.text(22, 22, '', hudStyle).setAlpha(0.78);
    this.bestText = this.add.text(22, 42, '', hudStyle).setAlpha(0.62);
    this.modeText = this.add.text(0, 22, 'FLOW', { fontFamily: 'monospace', fontSize: '11px', color: '#76d6ff' }).setOrigin(1, 0).setAlpha(0.72);
    this.hintText = this.add.text(0, 0, 'TAP · HOLD · DOUBLE', { fontFamily: 'monospace', fontSize: '10px', color: '#6f6f6f' }).setOrigin(0.5, 0).setAlpha(0.62);

    this.overlay = this.add.container(0, 0).setDepth(20).setVisible(false).setAlpha(0);
    this.overlayBg = this.add.rectangle(0, 0, 10, 10, 0x030303, 0.56).setOrigin(0, 0);
    this.overlayCard = this.add.rectangle(0, 0, 330, 210, 0x090909, 0.86).setStrokeStyle(1, 0xffffff, 0.18).setOrigin(0.5);
    this.overTitle = this.add.text(0, -64, '// GAME OVER', { fontFamily: 'monospace', fontSize: '16px', color: '#ff5c7f' }).setOrigin(0.5);
    this.finalText = this.add.text(0, -32, '', { fontFamily: 'monospace', fontSize: '12px', color: '#c9c9c9' }).setOrigin(0.5).setAlpha(0.82);

    this.restartBtn = this.makeButton('RESTART', 0, 8, () => this.resetGame());
    this.resetBestBtn = this.makeButton('RESET BEST', 0, 48, () => {
      this.best = 0;
      localStorage.setItem(STORAGE_BEST, '0');
      this.updateHud();
      this.finalText.setText(`SCORE ${Math.floor(this.score)} · BEST ${this.best}`);
    });
    this.instantBtn = this.makeButton('', 0, 88, () => {
      this.instantRestart = !this.instantRestart;
      localStorage.setItem(STORAGE_INSTANT, String(this.instantRestart));
      this.refreshInstantText();
    });

    this.overlay.add([this.overlayBg, this.overlayCard, this.overTitle, this.finalText, this.restartBtn.container, this.resetBestBtn.container, this.instantBtn.container]);
    this.refreshInstantText();
  }

  makeButton(label, x, y, onClick) {
    const container = this.add.container(x, y);
    const bg = this.add.rectangle(0, 0, 170, 28, 0xffffff, 0.045).setStrokeStyle(1, 0xffffff, 0.18).setOrigin(0.5);
    const text = this.add.text(0, 0, label, { fontFamily: 'monospace', fontSize: '11px', color: '#ffffff' }).setOrigin(0.5).setAlpha(0.82);
    container.add([bg, text]);
    bg.setInteractive({ useHandCursor: true }).on('pointerdown', (pointer) => {
      pointer.event?.preventDefault?.();
      onClick();
    });
    return { container, bg, text };
  }

  refreshInstantText() {
    this.instantBtn.text.setText(this.instantRestart ? 'INSTANT: ON' : 'INSTANT: OFF');
    this.instantBtn.bg.setFillStyle(this.instantRestart ? 0xff004c : 0xffffff, this.instantRestart ? 0.22 : 0.045);
    this.instantBtn.bg.setStrokeStyle(1, this.instantRestart ? 0xff5c7f : 0xffffff, this.instantRestart ? 0.6 : 0.18);
  }

  bindInput() {
    this.input.keyboard.on('keydown-SPACE', (e) => {
      e.preventDefault();
      if (!e.repeat) this.startPress();
    });
    this.input.keyboard.on('keyup-SPACE', () => this.endPress());

    this.input.on('pointerdown', (pointer) => {
      pointer.event?.preventDefault?.();
      if (!this.gameOver) this.startPress();
    });
    this.input.on('pointerup', () => this.endPress());

    const blocker = (e) => e.preventDefault();
    ['selectstart', 'contextmenu', 'dragstart', 'dblclick', 'touchstart', 'touchmove', 'touchend'].forEach((type) => {
      document.addEventListener(type, blocker, { passive: false });
    });
  }

  resizeGame() {
    const w = this.scale.width;
    const h = this.scale.height;
    this.mobile = w < 700 && h > w;
    this.runnerScale = this.mobile ? 0.62 : 0.84;

    this.playerSize = this.mobile ? 24 : 30;
    this.playerX = this.mobile ? Math.max(58, w * 0.15) : 120;
    this.gravity = this.mobile ? 0.86 : 0.96;
    this.fallGravity = this.mobile ? 1.12 : 1.22;
    this.jumpPower = this.mobile ? -13.2 : -15.2;
    this.holdLift = this.mobile ? -0.42 : -0.5;
    this.maxHoldFrames = 15;
    this.groundY = this.mobile ? h * 0.66 : h - Math.max(110, h * 0.18);

    this.player.setSize(this.playerSize, this.playerSize);
    this.player.displayWidth = this.playerSize;
    this.player.displayHeight = this.playerSize;
    this.playerGlow.displayWidth = this.playerSize + 14;
    this.playerGlow.displayHeight = this.playerSize + 14;

    if (!this.gameOver) {
      this.player.x = this.playerX;
      this.player.y = this.groundY - this.playerSize;
    }

    this.scoreText.setPosition(22, this.mobile ? 30 : 22).setFontSize(this.mobile ? '10px' : '11px');
    this.bestText.setPosition(22, this.mobile ? 48 : 42).setFontSize(this.mobile ? '10px' : '11px');
    this.modeText.setPosition(w - 22, this.mobile ? 30 : 22).setFontSize(this.mobile ? '10px' : '11px');
    this.hintText.setPosition(w / 2, this.mobile ? Math.min(h - 90, this.groundY + 120) : h - 36).setFontSize(this.mobile ? '9px' : '10px');

    this.overlayBg.setSize(w, h);
    const cardW = Math.min(this.mobile ? 310 : 350, w - 36);
    const cardH = this.mobile ? 205 : 215;
    this.overlayCard.setPosition(w / 2, h / 2).setSize(cardW, cardH);
    this.overTitle.setPosition(w / 2, h / 2 - 64);
    this.finalText.setPosition(w / 2, h / 2 - 32);
    this.restartBtn.container.setPosition(w / 2, h / 2 + 8);
    this.resetBestBtn.container.setPosition(w / 2, h / 2 + 48);
    this.instantBtn.container.setPosition(w / 2, h / 2 + 88);

    this.makeStars();
    this.redrawStatic();
  }

  makeStars() {
    const w = this.scale.width;
    const h = this.scale.height;
    const count = this.mobile ? 22 : 44;
    this.stars = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      a: 0.08 + Math.random() * 0.22,
      s: 0.6 + Math.random() * 1.2,
      v: 0.02 + Math.random() * 0.04
    }));
  }

  redrawStatic() {
    const w = this.scale.width;
    const h = this.scale.height;

    this.grid.clear();
    this.grid.fillStyle(this.gridColor, 0.018);
    for (let x = 0; x < w; x += this.mobile ? 52 : 48) this.grid.fillRect(x, 0, 1, h);

    this.groundLine.clear();
    this.groundLine.fillStyle(this.groundColor, 0.18);
    this.groundLine.fillRect(0, this.groundY, w, 1);
  }

  resetGame() {
    this.obstacles.clear(true, true);
    this.score = 0;
    this.speed = this.mobile ? 6.35 : 8;
    this.spawnTimer = this.mobile ? 96 : 68;
    this.gameOver = false;
    this.pressHeld = false;
    this.player.x = this.playerX;
    this.player.y = this.groundY - this.playerSize;
    this.playerVelY = 0;
    this.jumpsLeft = 2;
    this.holdFrames = 0;
    this.overlay.setVisible(false).setAlpha(0);
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

  spawnObstacle() {
    const h = (32 + Math.random() * 48) * this.runnerScale;
    const w = (18 + Math.random() * 22) * this.runnerScale;
    const obstacle = this.add.rectangle(this.scale.width + (this.mobile ? 160 : 70), this.groundY - h / 2, w, h, this.obstacleColor, 0.95);
    obstacle.scaleX = 0.72;
    this.tweens.add({ targets: obstacle, scaleX: 1, duration: 180, ease: 'Quad.Out' });
    this.physics.add.existing(obstacle);
    obstacle.body.setAllowGravity(false).setImmovable(true);
    this.obstacles.add(obstacle);
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
    this.finalText.setText(`SCORE ${s} · BEST ${this.best}`);
    this.overlay.setVisible(true).setAlpha(0);
    this.tweens.add({ targets: this.overlay, alpha: 1, duration: 180, ease: 'Quad.Out' });
    this.updateHud();
  }

  updateHud() {
    this.scoreText.setText(`SCORE ${Math.floor(this.score)}`);
    this.bestText.setText(`BEST ${this.best}`);
  }

  updateStars(dt) {
    const w = this.scale.width;
    this.starLayer.clear();
    this.stars.forEach((star) => {
      star.x -= star.v * dt;
      if (star.x < 0) star.x = w;
      this.starLayer.fillStyle(0xffffff, star.a);
      this.starLayer.fillRect(star.x, star.y, star.s, star.s);
    });
  }

  update(_time, deltaMs) {
    const dt = Math.min(deltaMs / 16.67, 2);
    this.updateStars(dt);
    const pulse = 0.08 + Math.sin(_time / 240) * 0.035;
    this.playerGlow.setFillStyle(0xffffff, pulse);
    this.playerGlow.x = this.player.x - 7;
    this.playerGlow.y = this.player.y - 7;

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

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnObstacle();
      this.spawnTimer = (this.mobile ? Math.max(76, 148 - this.speed * 3) : Math.max(54, 112 - this.speed * 2)) + Math.random() * (this.mobile ? 62 : 46);
    }

    this.obstacles.getChildren().forEach((o) => {
      o.x -= this.speed * dt;
      if (o.x + o.width / 2 < 0) {
        o.destroy();
        return;
      }
      const hit = this.player.x < o.x + o.width / 2 && this.player.x + this.playerSize > o.x - o.width / 2 && this.player.y < o.y + o.height / 2 && this.player.y + this.playerSize > o.y - o.height / 2;
      if (hit) this.die();
    });

    this.score += 0.06 * dt;
    this.speed += (this.mobile ? 0.00075 : 0.0012) * dt;
    this.updateHud();
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#030303',
  physics: { default: 'arcade', arcade: { debug: false, gravity: { y: 0 } } },
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: window.innerWidth,
    height: window.innerHeight
  },
  scene: [VoidRunnerScene]
});
