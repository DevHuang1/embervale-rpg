// Moss & Candlewax design reminder: build a readable miniature woodland where lantern light leads every interaction.

import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import "@babylonjs/core/Meshes/Builders/boxBuilder";
import "@babylonjs/core/Meshes/Builders/cylinderBuilder";
import "@babylonjs/core/Meshes/Builders/discBuilder";
import "@babylonjs/core/Meshes/Builders/groundBuilder";
import "@babylonjs/core/Meshes/Builders/polyhedronBuilder";
import "@babylonjs/core/Meshes/Builders/sphereBuilder";
import "@babylonjs/core/Meshes/Builders/torusBuilder";
import { Scene } from "@babylonjs/core/scene";
import { palette } from "@/game/palette";
import {
  createInitialGameState,
  type GameState,
  type ItemId,
  type SkillId,
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
  private state: GameState = createInitialGameState();
  private player!: TransformNode;
  private enemy!: TransformNode;
  private shard!: TransformNode;
  private beacon!: TransformNode;
  private lanternLight!: PointLight;
  private beaconLight!: PointLight;
  private enemyLight!: PointLight;
  private cursorMarker!: TransformNode;
  private enemyMarker!: TransformNode;
  private moveTarget: Vector3 | null = null;
  private enemySelected = false;
  private autoStrikeCooldown = 0;
  private autoStrikeCount = 0;
  private cooldownUiTimer = 0;
  private minimapUiTimer = 0;
  private readonly canvasPointerDown: (event: PointerEvent) => void;
  private readonly playerStart = new Vector3(-16, 0, 10);
  private readonly enemyPosition = new Vector3(-6.4, 0, 3.15);
  private readonly shardPosition = new Vector3(1.25, 0, -4.1);
  private readonly beaconPosition = new Vector3(14.2, 0, -10.4);
  private time = 0;

  constructor(options: WorldOptions) {
    this.scene = options.scene;
    this.canvas = options.canvas;
    this.onStateChange = options.onStateChange;
    this.demoMode = options.demoMode;
    this.player = new TransformNode("lantern-bearer", this.scene);
    this.enemy = new TransformNode("hushling", this.scene);
    this.shard = new TransformNode("ember-shard", this.scene);
    this.beacon = new TransformNode("beacon", this.scene);
    this.canvasPointerDown = (event) => this.handleCanvasPointerDown(event);

    this.buildScene();
    this.canvas.addEventListener("pointerdown", this.canvasPointerDown);
    this.onStateChange({ ...this.state });
  }

  update(delta: number) {
    this.time += delta;
    this.updateSkillCooldowns(delta);
    if (this.demoMode) this.runDemo(delta);
    else if (this.enemySelected) this.updateAutoStrike(delta);
    else this.moveToCursorTarget(delta);

    if (this.demoMode || this.enemySelected || this.moveTarget) {
      this.minimapUiTimer += delta;
      if (this.minimapUiTimer >= 0.1) {
        this.minimapUiTimer = 0;
        this.syncPlayerPosition();
        this.emit();
      }
    }

    const pulse = 0.86 + Math.sin(this.time * 4.2) * 0.14;
    this.lanternLight.intensity = 1.75 * pulse;
    this.enemyLight.intensity = 0.64 + Math.sin(this.time * 3.1) * 0.18;
    this.player.position.y = Math.sin(this.time * 3.2) * 0.035;
    this.enemy.position.y = Math.sin(this.time * 2.2 + 1) * 0.08;
    this.enemy.rotation.y += delta * 0.24;
    this.shard.rotation.y += delta * 1.3;

    if (this.state.stage !== "seekSprite" && this.state.combatState !== "combat") {
      this.checkQuestProgress();
    }
  }

  restart() {
    this.state = createInitialGameState();
    this.player.position.copyFrom(this.playerStart);
    this.enemy.position.copyFrom(this.enemyPosition);
    this.enemy.setEnabled(true);
    this.shard.setEnabled(false);
    this.beaconLight.intensity = 0;
    this.moveTarget = null;
    this.enemySelected = false;
    this.autoStrikeCooldown = 0;
    this.autoStrikeCount = 0;
    this.minimapUiTimer = 0;
    this.cursorMarker.setEnabled(false);
    this.enemyMarker.setEnabled(false);
    this.syncPlayerPosition();
    this.emit();
  }

  moveToMapPoint(normalizedX: number, normalizedY: number) {
    const mapTarget = new Vector3((normalizedX - 0.5) * 44, 0, (normalizedY - 0.5) * 32);
    this.setMoveTarget(mapTarget);
  }

  engageEnemy() {
    this.selectEnemy();
  }

  useInventoryItem(itemId: ItemId) {
    const item = this.state.inventory.find((entry) => entry.id === itemId);
    if (!item || item.kind !== "consumable" || item.quantity < 1) {
      this.state.log = "That satchel pocket holds nothing usable right now.";
      this.emit();
      return;
    }
    const restored = Math.min(12, this.state.maxHp - this.state.hp);
    if (!restored) {
      this.state.log = "You save the Moss Tonic; your lantern is already at full warmth.";
      this.emit();
      return;
    }
    item.quantity -= 1;
    this.state.hp += restored;
    this.state.lootNotice = null;
    this.state.lootCount = 0;
    this.state.log = `You drink a Moss Tonic and recover ${restored} warmth.`;
    this.emit();
  }

  useSkill(skillId: SkillId) {
    const remaining = this.state.skillCooldowns[skillId];
    if (remaining > 0) {
      this.state.log = "That lantern rite is still gathering itself.";
      this.emit();
      return;
    }
    if (skillId === "mend-flame") {
      const restored = Math.min(10, this.state.maxHp - this.state.hp);
      this.state.hp += restored;
      this.state.skillCooldowns[skillId] = 9;
      this.state.lootNotice = null;
      this.state.log = restored ? `Mend Flame returns ${restored} warmth to your lantern.` : "Mend Flame settles into a calm, full lantern.";
      this.emit();
      return;
    }
    if (!this.enemySelected || !this.enemy.isEnabled()) {
      this.state.log = "Cinder Lash needs a Hushling marked by your lantern.";
      this.emit();
      return;
    }
    const damage = 16;
    this.state.skillCooldowns[skillId] = 6;
    this.state.enemyHp = Math.max(0, this.state.enemyHp - damage);
    this.state.log = `Cinder Lash arcs through the bramble for ${damage} ember damage.`;
    if (this.state.enemyHp <= 0) {
      this.defeatEnemy();
      return;
    }
    this.emit();
  }

  dispose() {
    this.canvas.removeEventListener("pointerdown", this.canvasPointerDown);
  }

  private buildScene() {
    this.scene.clearColor = new Color4(0.035, 0.09, 0.07, 1);
    this.scene.fogMode = Scene.FOGMODE_EXP2;
    this.scene.fogDensity = 0.018;
    this.scene.fogColor = color(palette.bottle);

    const camera = new ArcRotateCamera("storybook-camera", -1.04, 1.02, 31, new Vector3(-1, 0, 0), this.scene);
    this.scene.activeCamera = camera;
    camera.lowerRadiusLimit = 24;
    camera.upperRadiusLimit = 39;
    camera.lowerBetaLimit = 0.82;
    camera.upperBetaLimit = 1.12;
    camera.fov = 0.78;
    camera.attachControl(this.canvas, false);

    const skyLight = new HemisphericLight("mist-light", new Vector3(0.3, 1, -0.3), this.scene);
    skyLight.intensity = 1.25;
    skyLight.diffuse = color("#b4d7ca");
    skyLight.groundColor = color("#07140e");

    const groundMat = this.material("grove-floor-mat", palette.bottle, { specular: "#000000" });
    const ground = MeshBuilder.CreateGround("whispergrove-floor", { width: 52, height: 40, subdivisions: 4 }, this.scene);
    ground.material = groundMat;
    ground.isPickable = true;
    ground.position.y = -0.04;

    const fringeMat = this.material("forest-fringe-mat", "#0a2117", { specular: "#000000" });
    const fringe = MeshBuilder.CreateGround("forest-fringe", { width: 66, height: 54 }, this.scene);
    fringe.material = fringeMat;
    fringe.position.y = -0.09;

    this.createPointerMarkers();
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
      [-16, 10], [-14.3, 8.7], [-12.3, 7.45], [-10.2, 6.1], [-8.1, 4.65],
      [-6.4, 3.15], [-4.5, 1.65], [-2.4, -0.5], [-0.6, -2.55], [1.25, -4.1],
      [3.7, -5.1], [6.15, -6.45], [8.6, -7.8], [11.2, -9.15], [14.2, -10.4],
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
      [-23, 15], [-20, 12.5], [-21, 8], [-22, 3], [-21, -2], [-22, -7], [-20, -12], [-18, -15],
      [-16.5, 14.5], [-13.5, 14], [-10, 15], [-6, 14.5], [-2, 14], [2, 15.2], [6, 14], [10, 15], [14, 14.3], [18, 13.8], [22, 12],
      [22, 8], [21, 3], [22, -2], [21, -7], [20, -12], [17, -15], [13, -14.5], [9, -15.2], [5, -14.7], [1, -15.5], [-3, -14.5], [-7, -15], [-11, -14.2],
      [-18, 10], [-15, 12], [-12, 10.5], [-10.5, 8.5], [-8.8, 7.8], [-4, 8.8], [-1.5, 10.5], [3.2, 11], [7.2, 10.4], [11.8, 10], [16, 10.8], [19.2, 8.5],
      [-18, 5.6], [-15.2, 4], [-12.2, 3.4], [-9.2, 1.1], [-7.4, -0.5], [-4.2, -2.6], [-1.8, -4.4], [4.8, -4.1], [7.8, -4.5], [10.2, -6.2], [13.2, -7.5], [17.2, -8.5],
      [-18, -1], [-15.4, -2.9], [-12.6, -4.8], [-10, -7], [-7.8, -8.8], [-4.8, -9.2], [-2, -10.8], [3.4, -9.7], [6.1, -10.4], [9.1, -11.6], [12.4, -12.8], [16.1, -11.5],
      [18.6, 4.5], [17.3, 1.1], [18.8, -3.5], [14.8, 4.1], [12.2, 2.4], [9.4, 1.2], [5.8, 2.5], [2.4, 4.2], [-1.2, 5.3], [-5.3, 4.8],
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
    const rocks = [[-14.8, 7.2], [-11.6, 5.5], [-7.2, 2.2], [-3.5, -1.5], [0.2, -3.1], [4.4, -5.2], [8.3, -7.1], [11.7, -9.4], [15.5, -10.1], [-1.0, 8.1], [6.7, 7.4], [17.2, 3.5]];
    rocks.forEach(([x, z], index) => {
      const rock = MeshBuilder.CreatePolyhedron(`lichen-stone-${index}`, { type: index % 3 }, this.scene);
      rock.material = index % 3 === 1 ? mossMat : stoneMat;
      rock.scaling = new Vector3(0.38 + (index % 2) * 0.18, 0.28 + (index % 3) * 0.08, 0.46);
      rock.position = new Vector3(x, rock.scaling.y * 0.72, z);
      rock.rotation.y = index * 0.73;
    });
    [-15.2, -11.4, -7.9, -2.6, 1.5, 5.4, 9.2, 13.6].forEach((x, index) => {
      const mushroom = MeshBuilder.CreateSphere(`mushroom-${index}`, { diameter: 0.18 + index * 0.018, segments: 6 }, this.scene);
      mushroom.material = this.material(`mushroom-mat-${index}`, index % 2 ? palette.ember : "#d6dfac", { emissive: index % 2 ? "#2a1602" : "#183013" });
      mushroom.scaling.y = 0.65;
      mushroom.position = new Vector3(x, 0.1, index % 2 ? 6.65 - index * 0.7 : -4.8 - index * 0.5);
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
    const body = this.markEnemy(MeshBuilder.CreateSphere("hushling-body", { diameter: 1.15, segments: 7 }, this.scene));
    body.material = bark;
    body.scaling.y = 1.25;
    body.position.y = 0.75;
    body.parent = this.enemy;
    [0, 1, 2].forEach((index) => {
      const eye = this.markEnemy(MeshBuilder.CreateSphere(`hushling-eye-${index}`, { diameter: 0.13, segments: 6 }, this.scene));
      eye.material = glow;
      eye.position = new Vector3((index - 1) * 0.2, 0.88 + (index % 2) * 0.07, -0.48);
      eye.parent = this.enemy;
    });
    [0, 1, 2].forEach((index) => {
      const bramble = this.markEnemy(MeshBuilder.CreateCylinder(`hushling-bramble-${index}`, { height: 0.85, diameterTop: 0.06, diameterBottom: 0.14, tessellation: 5 }, this.scene));
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

  private createPointerMarkers() {
    const movementMat = this.material("movement-rune", palette.ember, { emissive: palette.emberLight, specular: "#000000" });
    const targetMat = this.material("target-rune", palette.teal, { emissive: "#73e5d7", specular: "#000000" });
    this.cursorMarker = new TransformNode("cursor-rune", this.scene);
    const cursorRing = MeshBuilder.CreateTorus("cursor-rune-ring", { diameter: 0.85, thickness: 0.042, tessellation: 28 }, this.scene);
    cursorRing.material = movementMat;
    cursorRing.rotation.x = Math.PI / 2;
    cursorRing.parent = this.cursorMarker;
    this.cursorMarker.setEnabled(false);

    this.enemyMarker = new TransformNode("enemy-rune", this.scene);
    const targetRing = MeshBuilder.CreateTorus("enemy-rune-ring", { diameter: 1.5, thickness: 0.055, tessellation: 28 }, this.scene);
    targetRing.material = targetMat;
    targetRing.rotation.x = Math.PI / 2;
    targetRing.parent = this.enemyMarker;
    const targetPoint = MeshBuilder.CreateCylinder("enemy-rune-point", { height: 0.05, diameter: 0.18, tessellation: 8 }, this.scene);
    targetPoint.material = targetMat;
    targetPoint.position.y = 0.06;
    targetPoint.parent = this.enemyMarker;
    this.enemyMarker.setEnabled(false);
  }

  private setMoveTarget(point: Vector3) {
    if (this.state.combatState === "defeated" || this.state.stage === "complete") return;
    this.enemySelected = false;
    this.enemyMarker.setEnabled(false);
    this.moveTarget = new Vector3(
      Math.max(-22, Math.min(22, point.x)),
      0,
      Math.max(-16, Math.min(16, point.z)),
    );
    this.cursorMarker.position.copyFrom(this.moveTarget);
    this.cursorMarker.position.y = 0.032;
    this.cursorMarker.setEnabled(true);
    this.state.combatState = "exploring";
    this.state.lootNotice = null;
    this.state.log = "The lantern answers your mark. Walking the old road.";
    this.emit();
  }

  private selectEnemy() {
    if (this.state.stage !== "seekSprite" || !this.enemy.isEnabled() || this.state.combatState === "defeated") return;
    this.moveTarget = null;
    this.cursorMarker.setEnabled(false);
    this.enemySelected = true;
    this.autoStrikeCooldown = 0;
    this.enemyMarker.position.copyFrom(this.enemy.position);
    this.enemyMarker.position.y = 0.035;
    this.enemyMarker.setEnabled(true);
    this.state.combatState = "combat";
    this.state.log = "Target marked: the Hushling. Closing the distance with lantern raised.";
    this.emit();
  }

  private moveToCursorTarget(delta: number) {
    if (!this.moveTarget || this.state.combatState === "defeated" || this.state.stage === "complete") return;
    const route = this.moveTarget.subtract(this.player.position);
    if (route.lengthSquared() < 0.06) {
      this.moveTarget = null;
      this.cursorMarker.setEnabled(false);
      this.state.log = "You reach the place your lantern marked.";
      this.emit();
      return;
    }
    this.movePlayer(route.normalize(), delta);
  }

  private updateAutoStrike(delta: number) {
    if (!this.enemySelected || !this.enemy.isEnabled()) return;
    const route = this.enemy.position.subtract(this.player.position);
    const distance = route.length();
    this.enemyMarker.position.copyFrom(this.enemy.position);
    if (distance > 1.42) {
      this.movePlayer(route.normalize(), delta);
      return;
    }
    this.autoStrikeCooldown -= delta;
    if (this.autoStrikeCooldown > 0) return;
    this.autoStrikeCooldown = 0.92;
    this.autoStrikeCount += 1;
    const passiveStrike = this.autoStrikeCount % 3 === 0;
    const damage = (this.state.level === 1 ? 8 : 11) + (passiveStrike ? 4 : 0);
    this.state.enemyHp = Math.max(0, this.state.enemyHp - damage);
    this.state.log = passiveStrike
      ? `Ember Circuit blooms: your third auto-strike lands for ${damage}.`
      : `Your lantern-sabre strikes automatically for ${damage}.`;
    if (this.state.enemyHp <= 0) {
      this.defeatEnemy();
      return;
    }
    const retaliation = 4;
    this.state.hp = Math.max(0, this.state.hp - retaliation);
    this.state.log += ` The Hushling answers for ${retaliation}.`;
    if (this.state.hp <= 0) {
      this.state.combatState = "defeated";
      this.enemySelected = false;
      this.enemyMarker.setEnabled(false);
      this.state.log = "The mist folds around your lantern. Select the path again when you are ready.";
    }
    this.emit();
  }

  private movePlayer(direction: Vector3, delta: number) {
    const speed = 5.2;
    this.player.position.addInPlace(direction.scale(speed * delta));
    this.player.position.x = Math.max(-22, Math.min(22, this.player.position.x));
    this.player.position.z = Math.max(-16, Math.min(16, this.player.position.z));
    this.player.rotation.y = Math.atan2(direction.x, direction.z);
  }

  private checkQuestProgress() {
    if (this.state.stage === "claimShard" && Vector3.Distance(this.player.position, this.shard.position) < 1.1) {
      this.state.stage = "lightBeacon";
      this.state.shardCollected = true;
      this.shard.setEnabled(false);
      this.addLoot("ember-shard", 1, "Ember Shard secured in the satchel.");
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
    this.enemySelected = false;
    this.enemyMarker.setEnabled(false);
    this.shard.setEnabled(true);
    this.addLoot("hushling-thorn", 1);
    this.addLoot("moss-tonic", 1, "Hushling cache secured — Thorn and Moss Tonic added.", 2);
    this.state.log = "The Hushling loosens its thorns. An Ember Shard falls into the grass.";
    this.emit();
  }

  private runDemo(delta: number) {
    if (this.state.combatState === "defeated" || this.state.stage === "complete") return;
    if (this.state.stage === "seekSprite") {
      if (!this.enemySelected) this.selectEnemy();
      this.updateAutoStrike(delta);
      return;
    }
    const target = this.state.stage === "claimShard" ? this.shardPosition : this.beaconPosition;
    const route = target.subtract(this.player.position);
    if (route.lengthSquared() > 0.05) this.movePlayer(route.normalize(), delta);
  }

  private emit() {
    this.onStateChange({
      ...this.state,
      skillCooldowns: { ...this.state.skillCooldowns },
      inventory: this.state.inventory.map((item) => ({ ...item })),
      playerPosition: { ...this.state.playerPosition },
    });
  }

  private syncPlayerPosition() {
    this.state.playerPosition = { x: this.player.position.x, z: this.player.position.z };
  }

  private updateSkillCooldowns(delta: number) {
    const cooldowns = this.state.skillCooldowns;
    const wasActive = cooldowns["cinder-lash"] > 0 || cooldowns["mend-flame"] > 0;
    if (!wasActive) return;
    cooldowns["cinder-lash"] = Math.max(0, cooldowns["cinder-lash"] - delta);
    cooldowns["mend-flame"] = Math.max(0, cooldowns["mend-flame"] - delta);
    this.cooldownUiTimer += delta;
    if (this.cooldownUiTimer >= 0.2 || (!cooldowns["cinder-lash"] && !cooldowns["mend-flame"])) {
      this.cooldownUiTimer = 0;
      this.emit();
    }
  }

  private addLoot(itemId: ItemId, amount: number, notice?: string, displayCount = amount) {
    const item = this.state.inventory.find((entry) => entry.id === itemId);
    if (item) item.quantity += amount;
    if (notice) {
      this.state.lootNotice = notice;
      this.state.lootCount = displayCount;
      this.state.lootPulse += 1;
    }
  }

  private handleCanvasPointerDown(event: PointerEvent) {
    if (event.button !== 0) return;
    const rect = this.canvas.getBoundingClientRect();
    const pick = this.scene.pick(event.clientX - rect.left, event.clientY - rect.top);
    if (!pick?.hit || !pick.pickedPoint) return;
    const hitPosition = new Vector3(pick.pickedPoint.x, 0, pick.pickedPoint.z);
    const hitEnemyArea = this.state.stage === "seekSprite" && Vector3.Distance(hitPosition, this.enemy.position) < 1.18;
    if (this.isEnemyPart(pick.pickedMesh) || hitEnemyArea) {
      this.selectEnemy();
      return;
    }
    this.setMoveTarget(pick.pickedPoint);
  }

  private markEnemy<T extends AbstractMesh>(mesh: T): T {
    mesh.isPickable = true;
    mesh.metadata = { enemyTarget: true };
    return mesh;
  }

  private isEnemyPart(mesh: AbstractMesh | null | undefined) {
    return Boolean(mesh?.metadata?.enemyTarget);
  }
}
