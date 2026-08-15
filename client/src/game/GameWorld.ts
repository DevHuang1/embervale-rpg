// Moss & Candlewax design reminder: build a readable miniature woodland where lantern light leads every interaction.

import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { GlowLayer } from "@babylonjs/core/Layers/glowLayer";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Scene } from "@babylonjs/core/scene";
import { palette } from "@/game/palette";
import {
  initialGameState,
  type GameState,
  type MoveIntent,
  type PlayerAction,
} from "@/game/types";

type WorldOptions = {
  scene: Scene;
  canvas: HTMLCanvasElement;
  onStateChange: (state: GameState) => void;
  demoMode: boolean;
};

const color = (value: string) => Color3.FromHexString(value);

export class GameWorld {
  private readonly scene: Scene;
  private readonly canvas: HTMLCanvasElement;
  private readonly onStateChange: (state: GameState) => void;
  private readonly demoMode: boolean;
  private state: GameState = { ...initialGameState };
  private player!: TransformNode;
  private enemy!: TransformNode;
  private shard!: TransformNode;
  private beacon!: TransformNode;
  private lanternLight!: PointLight;
  private beaconLight!: PointLight;
  private enemyLight!: PointLight;
  private heldMoves = new Set<MoveIntent>();
  private touchMove: MoveIntent | null = null;
  private readonly playerStart = new Vector3(-3.85, 0, 2.75);
  private readonly enemyPosition = new Vector3(-0.4, 0, 0.6);
  private readonly shardPosition = new Vector3(-0.2, 0, 0.9);
  private readonly beaconPosition = new Vector3(4.25, 0, -3.15);
  private time = 0;
  private demoActionCooldown = 0;
  private guarded = false;
  private readonly keyDown: (event: KeyboardEvent) => void;
  private readonly keyUp: (event: KeyboardEvent) => void;

  constructor(options: WorldOptions) {
    this.scene = options.scene;
    this.canvas = options.canvas;
    this.onStateChange = options.onStateChange;
    this.demoMode = options.demoMode;
    this.player = new TransformNode("lantern-bearer", this.scene);
    this.enemy = new TransformNode("hushling", this.scene);
    this.shard = new TransformNode("ember-shard", this.scene);
    this.beacon = new TransformNode("beacon", this.scene);

    this.keyDown = (event) => {
      if (this.state.combatState === "combat") {
        if (event.key === "1") {
          event.preventDefault();
          this.performAction("strike");
          return;
        }
        if (event.key === "2") {
          event.preventDefault();
          this.performAction("guard");
          return;
        }
        if (event.key === "3") {
          event.preventDefault();
          this.performAction("mend");
          return;
        }
      }
      const intent = this.keyToIntent(event.key);
      if (!intent || this.state.combatState === "combat") return;
      event.preventDefault();
      this.heldMoves.add(intent);
    };
    this.keyUp = (event) => {
      const intent = this.keyToIntent(event.key);
      if (!intent) return;
      event.preventDefault();
      this.heldMoves.delete(intent);
    };

    this.buildScene();
    window.addEventListener("keydown", this.keyDown, { passive: false });
    window.addEventListener("keyup", this.keyUp, { passive: false });
    this.onStateChange({ ...this.state });
  }

  update(delta: number) {
    this.time += delta;
    if (this.demoMode) this.runDemo(delta);
    else this.moveFromIntent(delta);

    const pulse = 0.86 + Math.sin(this.time * 4.2) * 0.14;
    this.lanternLight.intensity = 1.75 * pulse;
    this.enemyLight.intensity = 0.64 + Math.sin(this.time * 3.1) * 0.18;
    this.player.position.y = Math.sin(this.time * 3.2) * 0.035;
    this.enemy.position.y = Math.sin(this.time * 2.2 + 1) * 0.08;
    this.enemy.rotation.y += delta * 0.24;
    this.shard.rotation.y += delta * 1.3;

    if (this.state.combatState !== "combat") {
      this.checkQuestProgress();
    }
  }

  setMoveIntent(intent: MoveIntent, active: boolean) {
    this.touchMove = active ? intent : this.touchMove === intent ? null : this.touchMove;
  }

  performAction(action: PlayerAction) {
    if (this.state.combatState !== "combat") return;

    this.guarded = action === "guard";
    if (action === "strike") {
      const damage = this.state.level === 1 ? 11 : 15;
      this.state.enemyHp = Math.max(0, this.state.enemyHp - damage);
      this.state.log = `Your lantern-sabre scatters ${damage} knots of shadow.`;
    }
    if (action === "guard") {
      this.state.log = "You cup the lantern close. The flame holds steady.";
    }
    if (action === "mend") {
      const recovered = Math.min(9, this.state.maxHp - this.state.hp);
      this.state.hp += recovered;
      this.state.log = recovered ? `You mend ${recovered} warmth into your hands.` : "Your lantern is already burning bright.";
    }

    if (this.state.enemyHp <= 0) {
      this.defeatEnemy();
      return;
    }

    const retaliation = this.guarded ? 2 : 6;
    this.state.hp = Math.max(0, this.state.hp - retaliation);
    this.state.log += retaliation ? ` The Hushling answers for ${retaliation}.` : " The Hushling cannot pierce the glow.";
    if (this.state.hp <= 0) {
      this.state.combatState = "defeated";
      this.state.log = "The mist folds around your lantern. Take heart and begin again.";
    }
    this.emit();
  }

  restart() {
    this.state = { ...initialGameState };
    this.player.position.copyFrom(this.playerStart);
    this.enemy.position.copyFrom(this.enemyPosition);
    this.enemy.setEnabled(true);
    this.shard.setEnabled(false);
    this.beaconLight.intensity = 0;
    this.guarded = false;
    this.emit();
  }

  dispose() {
    window.removeEventListener("keydown", this.keyDown);
    window.removeEventListener("keyup", this.keyUp);
  }

  private buildScene() {
    this.scene.clearColor = new Color4(0.035, 0.09, 0.07, 1);
    this.scene.fogMode = Scene.FOGMODE_EXP2;
    this.scene.fogDensity = 0.032;
    this.scene.fogColor = color(palette.bottle);

    const camera = new ArcRotateCamera("storybook-camera", -1.04, 1.02, 19.8, new Vector3(0.1, 0, 0.15), this.scene);
    camera.lowerRadiusLimit = 16;
    camera.upperRadiusLimit = 23;
    camera.lowerBetaLimit = 0.82;
    camera.upperBetaLimit = 1.12;
    camera.fov = 0.78;
    camera.attachControl(this.canvas, false);

    const skyLight = new HemisphericLight("mist-light", new Vector3(0.3, 1, -0.3), this.scene);
    skyLight.intensity = 1.25;
    skyLight.diffuse = color("#b4d7ca");
    skyLight.groundColor = color("#07140e");

    new GlowLayer("lantern-bloom", this.scene, { blurKernelSize: 32 }).intensity = 0.55;

    const groundMat = this.material("grove-floor-mat", palette.bottle, { specular: "#000000" });
    const ground = MeshBuilder.CreateGround("whispergrove-floor", { width: 24, height: 20, subdivisions: 2 }, this.scene);
    ground.material = groundMat;
    ground.position.y = -0.04;

    const fringeMat = this.material("forest-fringe-mat", "#0a2117", { specular: "#000000" });
    const fringe = MeshBuilder.CreateGround("forest-fringe", { width: 34, height: 30 }, this.scene);
    fringe.material = fringeMat;
    fringe.position.y = -0.09;

    this.createPath();
    this.createForest();
    this.createRuinScatter();
    this.createPlayer();
    this.createEnemy();
    this.createShard();
    this.createBeacon();
    this.player.position.copyFrom(this.playerStart);
  }

  private createPath() {
    const stone = this.material("pale-path", palette.path, { emissive: "#1b1a12", specular: "#4c4330" });
    const points = [
      [-3.85, 2.75], [-3.2, 2.0], [-2.45, 1.5], [-1.5, 1.05], [-0.65, 0.8],
      [0.15, 0.45], [1.25, -0.15], [2.1, -1.05], [3.0, -2.15], [4.15, -3.0],
    ];
    points.forEach(([x, z], index) => {
      const plate = MeshBuilder.CreateDisc(`path-stone-${index}`, { radius: 0.62 + (index % 3) * 0.07, tessellation: 7 }, this.scene);
      plate.material = stone;
      plate.rotation.x = Math.PI / 2;
      plate.rotation.z = (index % 2 ? 0.2 : -0.16) + index * 0.08;
      plate.position = new Vector3(x, 0.012 + (index % 2) * 0.008, z);
    });
  }

  private createForest() {
    const treePositions = [
      [-8, 6], [-7, 3.8], [-7.4, 0.5], [-6.8, -2.8], [-7.2, -5.1], [-5.4, 5.8],
      [-4.2, 5.4], [-2.3, 5.6], [0.3, 5.4], [2.7, 5.2], [5.5, 5.5], [7.4, 4.7],
      [8, 2.4], [7.3, 0.2], [7.7, -2.8], [6.5, -5.2], [4.5, -5.6], [1.7, -5.5],
      [-1.2, -5.3], [-3.7, -5.2], [-5.7, -4.8], [-5.8, 0.4], [-4.7, -0.3],
      [5.8, 2.1], [3.3, 3.8], [-2.8, -2.2], [0.4, -3.8], [4.8, 0.8],
    ];
    treePositions.forEach(([x, z], index) => this.createTree(index, x, z, 0.7 + (index % 4) * 0.09));
  }

  private createTree(index: number, x: number, z: number, scale: number) {
    const root = new TransformNode(`tree-${index}`, this.scene);
    root.position = new Vector3(x, 0, z);
    root.rotation.y = index * 0.58;
    const trunkMat = this.material(`trunk-mat-${index}`, index % 3 ? palette.cedar : "#3a2a22", { specular: "#000000" });
    const leafMat = this.material(`leaf-mat-${index}`, index % 3 ? palette.pine : "#1d4a31", { specular: "#000000" });
    const mossMat = this.material(`moss-mat-${index}`, palette.moss, { emissive: "#102514", specular: "#000000" });
    const trunk = MeshBuilder.CreateCylinder(`trunk-${index}`, { height: 2.8 * scale, diameterTop: 0.34 * scale, diameterBottom: 0.52 * scale, tessellation: 6 }, this.scene);
    trunk.material = trunkMat;
    trunk.position.y = 1.4 * scale;
    trunk.parent = root;
    [1.9, 2.65, 3.28].forEach((height, tier) => {
      const crown = MeshBuilder.CreateSphere(`crown-${index}-${tier}`, { diameter: (2.2 - tier * 0.34) * scale, segments: 6 }, this.scene);
      crown.material = tier === 2 && index % 2 ? mossMat : leafMat;
      crown.scaling.y = 0.72;
      crown.position = new Vector3((tier % 2 ? 0.12 : -0.08) * scale, height * scale, (tier % 2 ? -0.07 : 0.08) * scale);
      crown.parent = root;
    });
  }

  private createRuinScatter() {
    const stoneMat = this.material("ruin-stone", palette.stone, { emissive: "#0f2020", specular: "#000000" });
    const mossMat = this.material("ruin-lichen", palette.lichen, { emissive: "#16220d", specular: "#000000" });
    const rocks = [[-3.4, 0.1], [-2.6, -1.1], [1.2, 2.3], [2.5, 1.8], [4.7, -0.9], [5.1, -2.0], [-1.0, 3.1]];
    rocks.forEach(([x, z], index) => {
      const rock = MeshBuilder.CreatePolyhedron(`lichen-stone-${index}`, { type: index % 3 }, this.scene);
      rock.material = index % 3 === 1 ? mossMat : stoneMat;
      rock.scaling = new Vector3(0.38 + (index % 2) * 0.18, 0.28 + (index % 3) * 0.08, 0.46);
      rock.position = new Vector3(x, rock.scaling.y * 0.72, z);
      rock.rotation.y = index * 0.73;
    });
    [-4.4, -3.8, 1.9, 3.8, 5.4].forEach((x, index) => {
      const mushroom = MeshBuilder.CreateSphere(`mushroom-${index}`, { diameter: 0.18 + index * 0.018, segments: 6 }, this.scene);
      mushroom.material = this.material(`mushroom-mat-${index}`, index % 2 ? palette.ember : "#d6dfac", { emissive: index % 2 ? "#2a1602" : "#183013" });
      mushroom.scaling.y = 0.65;
      mushroom.position = new Vector3(x, 0.1, index % 2 ? 2.65 : -2.6);
    });
  }

  private createPlayer() {
    const cloak = this.material("hero-cloak", "#567846", { specular: "#000000" });
    const hood = this.material("hero-hood", "#274a32", { specular: "#000000" });
    const brass = this.material("hero-brass", "#c78732", { emissive: "#382104", specular: "#ffd575" });
    const flame = this.material("hero-flame", palette.ember, { emissive: palette.emberLight, specular: "#000000" });
    const body = MeshBuilder.CreateCylinder("hero-cloak", { height: 1.05, diameterTop: 0.52, diameterBottom: 0.9, tessellation: 8 }, this.scene);
    body.material = cloak;
    body.position.y = 0.57;
    body.parent = this.player;
    const head = MeshBuilder.CreateSphere("hero-hood", { diameter: 0.58, segments: 8 }, this.scene);
    head.material = hood;
    head.position = new Vector3(0, 1.16, 0.04);
    head.parent = this.player;
    const lantern = MeshBuilder.CreateBox("hero-lantern", { width: 0.28, height: 0.37, depth: 0.22 }, this.scene);
    lantern.material = brass;
    lantern.position = new Vector3(0.47, 0.65, 0.08);
    lantern.parent = this.player;
    const flameOrb = MeshBuilder.CreateSphere("hero-lantern-flame", { diameter: 0.2, segments: 8 }, this.scene);
    flameOrb.material = flame;
    flameOrb.position = new Vector3(0.47, 0.68, 0.08);
    flameOrb.parent = this.player;
    const lanternAuraMat = this.material("hero-lantern-aura", palette.ember, { emissive: palette.ember });
    lanternAuraMat.alpha = 0.18;
    const lanternAura = MeshBuilder.CreateDisc("hero-lantern-aura", { radius: 1.15, tessellation: 32 }, this.scene);
    lanternAura.material = lanternAuraMat;
    lanternAura.rotation.x = Math.PI / 2;
    lanternAura.position.y = 0.025;
    lanternAura.parent = this.player;
    this.lanternLight = new PointLight("hero-lantern-light", new Vector3(0, 1.1, 0), this.scene);
    this.lanternLight.diffuse = color(palette.ember);
    this.lanternLight.range = 5.7;
    this.lanternLight.intensity = 2.2;
    this.lanternLight.parent = this.player;
  }

  private createEnemy() {
    this.enemy.position.copyFrom(this.enemyPosition);
    const bark = this.material("hushling-bark", "#234c50", { emissive: "#0e2427", specular: "#000000" });
    const glow = this.material("hushling-glow", palette.teal, { emissive: "#78f3e7", specular: "#000000" });
    const body = MeshBuilder.CreateSphere("hushling-body", { diameter: 1.15, segments: 7 }, this.scene);
    body.material = bark;
    body.scaling.y = 1.25;
    body.position.y = 0.75;
    body.parent = this.enemy;
    [0, 1, 2].forEach((index) => {
      const eye = MeshBuilder.CreateSphere(`hushling-eye-${index}`, { diameter: 0.13, segments: 6 }, this.scene);
      eye.material = glow;
      eye.position = new Vector3((index - 1) * 0.2, 0.88 + (index % 2) * 0.07, -0.48);
      eye.parent = this.enemy;
    });
    [0, 1, 2].forEach((index) => {
      const bramble = MeshBuilder.CreateCylinder(`hushling-bramble-${index}`, { height: 0.85, diameterTop: 0.06, diameterBottom: 0.14, tessellation: 5 }, this.scene);
      bramble.material = bark;
      bramble.position = new Vector3((index - 1) * 0.45, 1.26, 0.03);
      bramble.rotation.z = (index - 1) * 0.42;
      bramble.parent = this.enemy;
    });
    this.enemyLight = new PointLight("hushling-mist-light", new Vector3(0, 1.1, 0), this.scene);
    this.enemyLight.diffuse = color(palette.teal);
    this.enemyLight.range = 3.3;
    this.enemyLight.intensity = 0.72;
    this.enemyLight.parent = this.enemy;
  }

  private createShard() {
    this.shard.position.copyFrom(this.shardPosition);
    this.shard.setEnabled(false);
    const shardMat = this.material("ember-shard-mat", palette.ember, { emissive: palette.emberLight, specular: "#fff0a5" });
    const crystal = MeshBuilder.CreatePolyhedron("ember-shard", { type: 1, size: 0.68 }, this.scene);
    crystal.material = shardMat;
    crystal.position.y = 0.75;
    crystal.parent = this.shard;
    const light = new PointLight("ember-shard-light", new Vector3(0, 0.65, 0), this.scene);
    light.diffuse = color(palette.ember);
    light.intensity = 1.1;
    light.range = 2.6;
    light.parent = this.shard;
  }

  private createBeacon() {
    this.beacon.position.copyFrom(this.beaconPosition);
    const stone = this.material("beacon-stone", palette.stone, { emissive: "#0d2420", specular: "#000000" });
    const brass = this.material("beacon-brass", "#a57532", { emissive: "#221300", specular: "#ffd878" });
    const flame = this.material("beacon-flame", palette.ember, { emissive: palette.emberLight, specular: "#000000" });
    const plinth = MeshBuilder.CreateCylinder("beacon-plinth", { height: 0.42, diameter: 2.05, tessellation: 8 }, this.scene);
    plinth.material = stone;
    plinth.position.y = 0.21;
    plinth.parent = this.beacon;
    const pillar = MeshBuilder.CreateCylinder("beacon-pillar", { height: 1.55, diameterTop: 0.44, diameterBottom: 0.64, tessellation: 6 }, this.scene);
    pillar.material = stone;
    pillar.position.y = 1.0;
    pillar.parent = this.beacon;
    const cage = MeshBuilder.CreateBox("beacon-cage", { width: 0.72, height: 0.85, depth: 0.72 }, this.scene);
    cage.material = brass;
    cage.position.y = 2.05;
    cage.scaling = new Vector3(0.76, 0.76, 0.76);
    cage.parent = this.beacon;
    const beaconRoof = MeshBuilder.CreateCylinder("beacon-roof", { height: 0.34, diameterTop: 0.1, diameterBottom: 0.72, tessellation: 6 }, this.scene);
    beaconRoof.material = brass;
    beaconRoof.position.y = 2.53;
    beaconRoof.parent = this.beacon;
    const flameOrb = MeshBuilder.CreateSphere("beacon-flame-orb", { diameter: 0.45, segments: 8 }, this.scene);
    flameOrb.material = flame;
    flameOrb.position.y = 2.04;
    flameOrb.scaling = new Vector3(0.75, 0.75, 0.75);
    flameOrb.parent = this.beacon;
    this.beaconLight = new PointLight("restored-beacon-light", new Vector3(0, 2.2, 0), this.scene);
    this.beaconLight.diffuse = color(palette.ember);
    this.beaconLight.range = 6.2;
    this.beaconLight.intensity = 0;
    this.beaconLight.parent = this.beacon;
  }

  private material(name: string, diffuse: string, options?: { emissive?: string; specular?: string }) {
    const material = new StandardMaterial(name, this.scene);
    material.diffuseColor = color(diffuse);
    material.emissiveColor = color(options?.emissive ?? "#000000");
    material.specularColor = color(options?.specular ?? "#000000");
    return material;
  }

  private moveFromIntent(delta: number) {
    if (this.state.combatState === "combat" || this.state.combatState === "defeated" || this.state.stage === "complete") return;
    const direction = new Vector3(0, 0, 0);
    const active = this.touchMove ?? Array.from(this.heldMoves).pop();
    if (active === "up") direction.z -= 1;
    if (active === "down") direction.z += 1;
    if (active === "left") direction.x -= 1;
    if (active === "right") direction.x += 1;
    if (direction.lengthSquared() > 0) this.movePlayer(direction.normalize(), delta);
  }

  private movePlayer(direction: Vector3, delta: number) {
    const speed = 3.25;
    this.player.position.addInPlace(direction.scale(speed * delta));
    this.player.position.x = Math.max(-7.1, Math.min(7.1, this.player.position.x));
    this.player.position.z = Math.max(-5.3, Math.min(5.2, this.player.position.z));
    this.player.rotation.y = Math.atan2(direction.x, direction.z);
  }

  private checkQuestProgress() {
    if (this.state.stage === "seekSprite" && Vector3.Distance(this.player.position, this.enemy.position) < 1.55) {
      this.state.combatState = "combat";
      this.state.log = "A Hushling reaches for your flame. Choose your answer.";
      this.emit();
    }
    if (this.state.stage === "claimShard" && Vector3.Distance(this.player.position, this.shard.position) < 1.1) {
      this.state.stage = "lightBeacon";
      this.state.shardCollected = true;
      this.shard.setEnabled(false);
      this.state.log = "The Ember Shard is warm in your palm. The beacon answers from the ridge.";
      this.emit();
    }
    if (this.state.stage === "lightBeacon" && Vector3.Distance(this.player.position, this.beacon.position) < 1.45) {
      this.state.stage = "complete";
      this.state.beaconLit = true;
      this.beaconLight.intensity = 3.4;
      this.state.log = "The grove remembers the way home.";
      this.emit();
    }
  }

  private defeatEnemy() {
    this.state.combatState = "victory";
    this.state.stage = "claimShard";
    this.state.xp += 35;
    this.state.level = 2;
    this.state.enemyHp = 0;
    this.enemy.setEnabled(false);
    this.shard.setEnabled(true);
    this.state.log = "The Hushling loosens its thorns. An Ember Shard falls into the grass.";
    this.emit();
  }

  private runDemo(delta: number) {
    if (this.state.combatState === "defeated" || this.state.stage === "complete") return;
    if (this.state.combatState === "combat") {
      this.demoActionCooldown -= delta;
      if (this.demoActionCooldown <= 0) {
        this.demoActionCooldown = 1.35;
        this.performAction(this.state.hp < 15 ? "mend" : "strike");
      }
      return;
    }
    const target = this.state.stage === "seekSprite" ? this.enemyPosition : this.state.stage === "claimShard" ? this.shardPosition : this.beaconPosition;
    const route = target.subtract(this.player.position);
    if (route.lengthSquared() > 0.05) this.movePlayer(route.normalize(), delta);
  }

  private emit() {
    this.onStateChange({ ...this.state });
  }

  private keyToIntent(key: string): MoveIntent | null {
    const normalized = key.toLowerCase();
    if (normalized === "w" || key === "ArrowUp") return "up";
    if (normalized === "s" || key === "ArrowDown") return "down";
    if (normalized === "a" || key === "ArrowLeft") return "left";
    if (normalized === "d" || key === "ArrowRight") return "right";
    return null;
  }
}
