const STORAGE_BEST = 'void_best';
const STORAGE_INSTANT = 'void_auto_restart';

class VoidRunnerScene extends Phaser.Scene {
  constructor() {
    super('VoidRunner');
  }

  create() {
    this.bgColor = 0x050505;
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
    this.groundLine = this.add.graphics();
  }

  buildPlayer() {
    this.player = this.add.rectangle(0, 0, 40, 40, this.playerColor).setOrigin(0, 0);
    this.physics.add.existing(this.player);
    this.playerBody = this.player.body;
    this.playerBody.setAllowGravity(false);
  }

  buildUI() {
    this.scoreText = this.add.text(14, 12, '', { fontFamily: 'monospace', fontSize: '14px', color: '#ffffff' });
    this.bestText = this.add.text(14, 32, '', { fontFamily: 'monospace', fontSize: '14px', color: '#ffffff' });
    this.hintText = this.add.text(0, 0, 'hold = longer jump · release = fall · second tap = double jump', { fontFamily: 'monospace', fontSize: '12px', color: '#7f7f7f' }).setOrigin(0.5, 0);

    this.overlay = this.add.container(0, 0).setDepth(20).setVisible(false);
    this.overlayBg = this.add.rectangle(0, 0, 10, 10, 0x050505, 0.78).setOrigin(0, 0);
    this.overlayCard = this.add.rectangle(0, 0, 420, 280, 0x111111, 0.92).setStrokeStyle(1, 0x2e2e2e).setOrigin(0.5);
    this.overTitle = this.add.text(0, -86, 'Game Over', { fontFamily: 'monospace', fontSize: '34px', color: '#ffffff' }).setOrigin(0.5);
    this.finalText = this.add.text(0, -38, '', { fontFamily: 'monospace', fontSize: '16px', color: '#c4c4c4' }).setOrigin(0.5);

    this.restartBtn = this.makeButton('Restart', 0, 8, () => this.resetGame());
    this.resetBestBtn = this.makeButton('Reset Best', 0, 58, () => {
      this.best = 0;
      localStorage.setItem(STORAGE_BEST, '0');
      this.updateHud();
      this.finalText.setText(`Score ${Math.floor(this.score)} · Best ${this.best}`);
    });
    this.instantBtn = this.makeButton('', 0, 108, () => {
      this.instantRestart = !this.instantRestart;
      localStorage.setItem(STORAGE_INSTANT, String(this.instantRestart));
      this.refreshInstantText();
    });

    this.overlay.add([this.overlayBg, this.overlayCard, this.overTitle, this.finalText, this.restartBtn.container, this.resetBestBtn.container, this.instantBtn.container]);
    this.refreshInstantText();
  }

  makeButton(label, x, y, onClick) {
    const container = this.add.container(x, y);
    const bg = this.add.rectangle(0, 0, 180, 34, 0xffffff, 0.08).setStrokeStyle(1, 0xffffff, 0.2).setOrigin(0.5);
    const text = this.add.text(0, 0, label, { fontFamily: 'monospace', fontSize: '14px', color: '#ffffff' }).setOrigin(0.5);
    container.add([bg, text]);
    bg.setInteractive({ useHandCursor: true }).on('pointerdown', (pointer) => {
      pointer.event?.preventDefault?.();
      onClick();
    });
    return { container, bg, text };
  }

  refreshInstantText() {
    this.instantBtn.text.setText(this.instantRestart ? 'Instant: On' : 'Instant: Off');
    this.instantBtn.bg.setFillStyle(this.instantRestart ? 0xff004c : 0xffffff, this.instantRestart ? 0.35 : 0.08);
    this.instantBtn.bg.setStrokeStyle(1, this.instantRestart ? 0xff4b83 : 0xffffff, this.instantRestart ? 0.8 : 0.2);
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
    this.runnerScale = this.mobile ? 0.72 : 1;

    this.playerSize = this.mobile ? 30 : 40;
    this.playerX = this.mobile ? 72 : 120;
    this.gravity = this.mobile ? 0.82 : 0.92;
    this.fallGravity = this.mobile ? 1.06 : 1.18;
    this.jumpPower = this.mobile ? -13.5 : -15.5;
    this.holdLift = this.mobile ? -0.45 : -0.55;
    this.maxHoldFrames = 16;
    this.groundY = h - (this.mobile ? Math.max(145, h * 0.24) : Math.max(95, h * 0.16));

    this.player.setSize(this.playerSize, this.playerSize);
    this.player.displayWidth = this.playerSize;
    this.player.displayHeight = this.playerSize;

    if (!this.gameOver) {
      this.player.x = this.playerX;
      this.player.y = this.groundY - this.playerSize;
    }

    this.scoreText.setFontSize(this.mobile ? '12px' : '14px');
    this.bestText.setPosition(14, this.mobile ? 30 : 32).setFontSize(this.mobile ? '12px' : '14px');
    this.hintText.setPosition(w / 2, h - (this.mobile ? 22 : 26)).setFontSize(this.mobile ? '10px' : '12px');

    this.overlayBg.setSize(w, h);
    this.overlayCard.setPosition(w / 2, h / 2).setSize(Math.min(420, w - 32), 280);
    this.overTitle.setPosition(w / 2, h / 2 - 86);
    this.finalText.setPosition(w / 2, h / 2 - 38);
    this.restartBtn.container.setPosition(w / 2, h / 2 + 8);
    this.resetBestBtn.container.setPosition(w / 2, h / 2 + 58);
    this.instantBtn.container.setPosition(w / 2, h / 2 + 108);

    this.redrawStatic();
  }

  redrawStatic() {
    const w = this.scale.width;
    const h = this.scale.height;

    this.grid.clear();
    this.grid.fillStyle(this.gridColor, 0.035);
    for (let x = 0; x < w; x += 42) this.grid.fillRect(x, 0, 1, h);

    this.groundLine.clear();
    this.groundLine.fillStyle(this.groundColor, 0.12);
    this.groundLine.fillRect(0, this.groundY, w, 2);
  }

  resetGame() {
    this.obstacles.clear(true, true);
    this.score = 0;
    this.speed = this.mobile ? 6.4 : 8;
    this.spawnTimer = this.mobile ? 90 : 60;
    this.gameOver = false;
    this.pressHeld = false;
    this.player.x = this.playerX;
    this.player.y = this.groundY - this.playerSize;
    this.playerVelY = 0;
    this.jumpsLeft = 2;
    this.holdFrames = 0;
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

  spawnObstacle() {
    const h = (35 + Math.random() * 62) * this.runnerScale;
    const w = (22 + Math.random() * 30) * this.runnerScale;
    const obstacle = this.add.rectangle(this.scale.width + (this.mobile ? 160 : 60), this.groundY - h / 2, w, h, this.obstacleColor);
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
    this.finalText.setText(`Score ${s} · Best ${this.best}`);
    this.overlay.setVisible(true);
    this.updateHud();
  }

  updateHud() {
    this.scoreText.setText(`SCORE ${Math.floor(this.score)}`);
    this.bestText.setText(`BEST ${this.best}`);
  }

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

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnObstacle();
      this.spawnTimer = (this.mobile ? Math.max(72, 140 - this.speed * 3) : Math.max(48, 105 - this.speed * 2)) + Math.random() * (this.mobile ? 58 : 42);
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
  backgroundColor: '#050505',
  physics: { default: 'arcade', arcade: { debug: false, gravity: { y: 0 } } },
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: window.innerWidth,
    height: window.innerHeight
  },
  scene: [VoidRunnerScene]
});
