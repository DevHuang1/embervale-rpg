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

type HushlingPattern = "orbit" | "feint" | "lunge" | "recover";

type EmberParticle = {
  mesh: AbstractMesh;
  velocity: Vector3;
  life: number;
  maxLife: number;
  spin: number;
};

const color = (value: string) => Color3.FromHexString(value);

export class GameWorld {
  private readonly scene: Scene;
  private readonly canvas: HTMLCanvasElement;
  private readonly onStateChange: (state: GameState) => void;
  private readonly demoMode: boolean;
  private camera!: ArcRotateCamera;
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
  private cursorInnerRing!: AbstractMesh;
  private cursorOuterRing!: AbstractMesh;
  private cursorChevrons!: TransformNode;
  private enemyInnerRing!: AbstractMesh;
  private enemyOuterRing!: AbstractMesh;
  private playerBody!: TransformNode;
  private playerCape!: TransformNode;
  private playerHead!: TransformNode;
  private playerLanternArm!: TransformNode;
  private playerOffhandArm!: TransformNode;
  private playerLantern!: TransformNode;
  private playerAura!: AbstractMesh;
  private playerFlame!: AbstractMesh;
  private enemyBody!: TransformNode;
  private enemyEyes!: TransformNode;
  private enemyTendrils: TransformNode[] = [];
  private cinderImpactRing!: AbstractMesh;
  private cinderImpactFlash!: AbstractMesh;
  private emberParticles: EmberParticle[] = [];
  private moveTarget: Vector3 | null = null;
  private enemySelected = false;
  private autoStrikeCooldown = 0;
  private autoStrikeCount = 0;
  private hushlingPattern: HushlingPattern = "orbit";
  private hushlingPatternTimer = 0.9;
  private hushlingLungeCooldown = 2.7;
  private hushlingLungeHit = false;
  private hushlingOrbitDirection = 1;
  private readonly hushlingVelocity = new Vector3(0, 0, 0);
  private cinderImpactTimer = 0;
  private readonly playerVelocity = new Vector3(0, 0, 0);
  private readonly playerMoveDirection = new Vector3(0, 0, 1);
  private playerMotion = 0;
  private playerAttackTimer = 0;
  private playerCastTimer = 0;
  private playerHitTimer = 0;
  private playerVictoryTimer = 0;
  private enemyHitTimer = 0;
  private enemyAttackTimer = 0;
  private enemyDefeatTimer = 0;
  private cursorPulseTimer = 0;
  private targetPulseTimer = 0;
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

    this.updateCharacterMotion(delta);
    this.updateCinderLashImpact(delta);
    this.updateCommandMarkers(delta);

    const pulse = 0.86 + Math.sin(this.time * 4.2) * 0.14;
    this.lanternLight.intensity = 1.75 * pulse;
    this.enemyLight.intensity = 0.64 + Math.sin(this.time * 3.1) * 0.18;
    this.shard.rotation.y += delta * 1.3;
    const cameraTarget = this.camera.getTarget();
    this.camera.setTarget(Vector3.Lerp(cameraTarget, new Vector3(this.player.position.x, 0, this.player.position.z), Math.min(1, delta * 1.15)));

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
    this.playerVelocity.set(0, 0, 0);
    this.playerMotion = 0;
    this.playerAttackTimer = 0;
    this.playerCastTimer = 0;
    this.playerHitTimer = 0;
    this.playerVictoryTimer = 0;
    this.enemyHitTimer = 0;
    this.enemyAttackTimer = 0;
    this.enemyDefeatTimer = 0;
    this.resetHushlingPattern();
    this.cinderImpactTimer = 0;
    this.cinderImpactRing.setEnabled(false);
    this.cinderImpactFlash.setEnabled(false);
    this.emberParticles.forEach((particle) => particle.mesh.setEnabled(false));
    this.resetMotionRig();
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
      this.playerCastTimer = 0.48;
      this.emit();
      return;
    }
    if (!this.enemySelected || !this.enemy.isEnabled()) {
      this.state.log = "Cinder Lash needs a Hushling marked by your lantern.";
      this.emit();
      return;
    }
    const damage = 16;
    this.playerCastTimer = 0.52;
    this.enemyHitTimer = 0.42;
    this.spawnCinderLashImpact();
    this.hushlingPattern = "recover";
    this.hushlingPatternTimer = 0.46;
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

    this.camera = new ArcRotateCamera("storybook-camera", -1.04, 1.02, 31, this.playerStart.clone(), this.scene);
    this.scene.activeCamera = this.camera;
    this.camera.lowerRadiusLimit = 24;
    this.camera.upperRadiusLimit = 40;
    this.camera.lowerBetaLimit = 0.8;
    this.camera.upperBetaLimit = 1.14;
    this.camera.fov = 0.74;
    this.camera.attachControl(this.canvas, false);

    const skyLight = new HemisphericLight("mist-light", new Vector3(0.3, 1, -0.3), this.scene);
    skyLight.intensity = 1.55;
    skyLight.diffuse = color("#bfd8c4");
    skyLight.groundColor = color("#06150f");
    const moonLight = new HemisphericLight("moonwash", new Vector3(-0.55, 0.35, 0.65), this.scene);
    moonLight.intensity = 0.36;
    moonLight.diffuse = color("#789bb1");
    moonLight.groundColor = color("#123022");

    const groundMat = this.material("grove-floor-mat", "#153b2a", { emissive: "#07170f", specular: "#1d4631" });
    const ground = MeshBuilder.CreateGround("whispergrove-floor", { width: 52, height: 40, subdivisions: 4 }, this.scene);
    ground.material = groundMat;
    ground.isPickable = true;
    ground.position.y = -0.04;

    const fringeMat = this.material("forest-fringe-mat", "#091f17", { emissive: "#06130e", specular: "#000000" });
    const fringe = MeshBuilder.CreateGround("forest-fringe", { width: 66, height: 54 }, this.scene);
    fringe.material = fringeMat;
    fringe.position.y = -0.09;

    this.createTerrainLayers();
    this.createPointerMarkers();
    this.createPath();
    this.createForest();
    this.createRuinScatter();
    this.createLandmarks();
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
      const plate = MeshBuilder.CreateDisc(`path-stone-${index}`, { radius: 0.78 + (index % 3) * 0.09, tessellation: 7 }, this.scene);
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
    treePositions.forEach(([x, z], index) => {
      this.createTree(index, x, z, 0.78 + (index % 5) * 0.1);
      if (index % 5 === 0) this.createFernCluster(index, x + 0.7, z - 0.45);
    });
  }

  private createTree(index: number, x: number, z: number, scale: number) {
    const root = new TransformNode(`tree-${index}`, this.scene);
    root.position = new Vector3(x, 0, z);
    root.rotation.y = index * 0.58;
    const trunkMat = this.material(`trunk-mat-${index}`, index % 3 ? palette.cedar : "#453229", { emissive: "#090603", specular: "#1b130f" });
    const leafMat = this.material(`leaf-mat-${index}`, index % 4 ? palette.pine : "#28553c", { emissive: index % 4 ? "#081c11" : "#102a19", specular: "#000000" });
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

  private createTerrainLayers() {
    const meadowMat = this.material("meadow-island", "#2c6540", { emissive: "#0c2616", specular: "#1c5434" });
    const ridgeMat = this.material("mossy-ridge", "#1d4c34", { emissive: "#0d2517", specular: "#000000" });
    const waterMat = this.material("moonrun-water", "#2d7080", { emissive: "#0c3340", specular: "#8fd5d5" });
    waterMat.alpha = 0.78;
    [[-15, 7, 4.6, 2.7], [-5, 4, 3.8, 2.1], [3, -2, 4.5, 2.5], [12, -8, 5.7, 3.1]].forEach(([x, z, sx, sz], index) => {
      const meadow = MeshBuilder.CreateDisc(`moss-meadow-${index}`, { radius: 1.2, tessellation: 32 }, this.scene);
      meadow.material = meadowMat;
      meadow.rotation.x = Math.PI / 2;
      meadow.scaling = new Vector3(sx, sz, 1);
      meadow.position = new Vector3(x, -0.018, z);
    });
    [[-20, 8], [-18, -8], [-1, 13], [8, 11], [20, -5], [10, -14]].forEach(([x, z], index) => {
      const ridge = MeshBuilder.CreateSphere(`soft-ridge-${index}`, { diameter: 3.8 + (index % 2) * 1.1, segments: 7 }, this.scene);
      ridge.material = ridgeMat;
      ridge.scaling = new Vector3(1.25, 0.26, 0.72);
      ridge.position = new Vector3(x, 0.22, z);
    });
    const stream = MeshBuilder.CreateGround("moonrun-stream", { width: 3.7, height: 28, subdivisions: 2 }, this.scene);
    stream.material = waterMat;
    stream.position = new Vector3(17.7, -0.025, -1.7);
    stream.rotation.y = -0.24;
  }

  private createFernCluster(index: number, x: number, z: number) {
    const fernMat = this.material(`fern-mat-${index}`, index % 2 ? "#4f8749" : "#699b54", { emissive: "#0d3017", specular: "#000000" });
    for (let blade = 0; blade < 4; blade += 1) {
      const leaf = MeshBuilder.CreateDisc(`fern-${index}-${blade}`, { radius: 0.3 + blade * 0.025, tessellation: 5 }, this.scene);
      leaf.material = fernMat;
      leaf.rotation.x = Math.PI / 2;
      leaf.rotation.z = blade * 1.58;
      leaf.scaling = new Vector3(1.75, 0.55, 1);
      leaf.position = new Vector3(x + Math.cos(blade) * 0.18, 0.03 + blade * 0.005, z + Math.sin(blade) * 0.18);
    }
  }

  private createLandmarks() {
    const stone = this.material("landmark-stone", "#49645f", { emissive: "#102421", specular: "#73968a" });
    const rune = this.material("landmark-rune", palette.teal, { emissive: "#5fe0d0", specular: "#000000" });
    [[-12, 11.8], [-2.8, 8.6], [7.4, -1.2], [10.8, -7.4]].forEach(([x, z], index) => {
      const monolith = MeshBuilder.CreateCylinder(`waystone-${index}`, { height: 2.1 + (index % 2) * 0.3, diameterTop: 0.42, diameterBottom: 0.7, tessellation: 6 }, this.scene);
      monolith.material = stone;
      monolith.position = new Vector3(x, 1.05, z);
      monolith.rotation.y = index * 0.6;
      const runeFace = MeshBuilder.CreateDisc(`waystone-rune-${index}`, { radius: 0.18, tessellation: 12 }, this.scene);
      runeFace.material = rune;
      runeFace.position = new Vector3(x + 0.02, 1.2, z - 0.36);
      runeFace.rotation.x = Math.PI / 2;
      runeFace.rotation.z = index * 0.4;
    });
    const bridgeMat = this.material("stream-bridge", "#6d5031", { emissive: "#1e1207", specular: "#9d7641" });
    [-7.7, -6.5, -5.3].forEach((z, index) => {
      const plank = MeshBuilder.CreateBox(`stream-plank-${index}`, { width: 4.9, height: 0.18, depth: 0.44 }, this.scene);
      plank.material = bridgeMat;
      plank.position = new Vector3(17.7, 0.11, z);
      plank.rotation.y = -0.24;
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
    const cloakTrim = this.material("hero-cloak-trim", "#b4833a", { emissive: "#1d1002", specular: "#e6c86a" });
    const hood = this.material("hero-hood", "#274a32", { specular: "#000000" });
    const skin = this.material("hero-skin", "#d5ad81", { emissive: "#20110a", specular: "#6e4731" });
    const brass = this.material("hero-brass", "#c78732", { emissive: "#382104", specular: "#ffd575" });
    const flame = this.material("hero-flame", palette.ember, { emissive: palette.emberLight, specular: "#000000" });
    const sabre = this.material("hero-sabre", "#b7d7ca", { emissive: "#173d38", specular: "#e1fff4" });

    this.playerBody = new TransformNode("hero-body-rig", this.scene);
    this.playerBody.parent = this.player;
    const body = MeshBuilder.CreateCylinder("hero-cloak", { height: 1.04, diameterTop: 0.54, diameterBottom: 0.88, tessellation: 8 }, this.scene);
    body.material = cloak;
    body.position.y = 0.57;
    body.parent = this.playerBody;
    const hem = MeshBuilder.CreateTorus("hero-cloak-hem", { diameter: 0.83, thickness: 0.045, tessellation: 8 }, this.scene);
    hem.material = cloakTrim;
    hem.position.y = 0.08;
    hem.rotation.x = Math.PI / 2;
    hem.parent = this.playerBody;
    this.playerCape = new TransformNode("hero-cape-rig", this.scene);
    this.playerCape.parent = this.playerBody;
    const cape = MeshBuilder.CreateCylinder("hero-cape", { height: 0.86, diameterTop: 0.44, diameterBottom: 0.98, tessellation: 7 }, this.scene);
    cape.material = cloak;
    cape.position = new Vector3(0, 0.48, 0.23);
    cape.scaling.z = 0.72;
    cape.parent = this.playerCape;
    const head = MeshBuilder.CreateSphere("hero-hood", { diameter: 0.58, segments: 8 }, this.scene);
    head.material = hood;
    head.position = new Vector3(0, 1.16, 0.04);
    head.parent = this.playerBody;
    this.playerHead = new TransformNode("hero-head-rig", this.scene);
    this.playerHead.parent = this.playerBody;
    const face = MeshBuilder.CreateSphere("hero-face", { diameter: 0.27, segments: 7 }, this.scene);
    face.material = skin;
    face.position = new Vector3(0, 1.12, -0.24);
    face.scaling.y = 0.78;
    face.parent = this.playerHead;
    const hoodRim = MeshBuilder.CreateTorus("hero-hood-rim", { diameter: 0.55, thickness: 0.05, tessellation: 10 }, this.scene);
    hoodRim.material = cloakTrim;
    hoodRim.position = new Vector3(0, 1.08, 0.02);
    hoodRim.rotation.x = Math.PI / 2;
    hoodRim.parent = this.playerBody;

    this.playerLanternArm = new TransformNode("hero-lantern-arm", this.scene);
    this.playerLanternArm.position = new Vector3(0.29, 0.9, 0.05);
    this.playerLanternArm.parent = this.playerBody;
    const lanternSleeve = MeshBuilder.CreateCylinder("hero-lantern-sleeve", { height: 0.58, diameter: 0.19, tessellation: 6 }, this.scene);
    lanternSleeve.material = cloak;
    lanternSleeve.position.y = -0.27;
    lanternSleeve.rotation.z = -0.36;
    lanternSleeve.parent = this.playerLanternArm;
    this.playerLantern = new TransformNode("hero-lantern-rig", this.scene);
    this.playerLantern.position = new Vector3(0.16, -0.49, 0.06);
    this.playerLantern.parent = this.playerLanternArm;
    const lantern = MeshBuilder.CreateBox("hero-lantern", { width: 0.3, height: 0.39, depth: 0.24 }, this.scene);
    lantern.material = brass;
    lantern.parent = this.playerLantern;
    const lanternCrown = MeshBuilder.CreateCylinder("hero-lantern-crown", { height: 0.1, diameterTop: 0.09, diameterBottom: 0.26, tessellation: 6 }, this.scene);
    lanternCrown.material = brass;
    lanternCrown.position.y = 0.25;
    lanternCrown.parent = this.playerLantern;
    const flameOrb = MeshBuilder.CreateSphere("hero-lantern-flame", { diameter: 0.2, segments: 8 }, this.scene);
    flameOrb.material = flame;
    flameOrb.position.y = 0.03;
    flameOrb.parent = this.playerLantern;
    this.playerFlame = flameOrb;
    this.playerOffhandArm = new TransformNode("hero-sabre-arm", this.scene);
    this.playerOffhandArm.position = new Vector3(-0.28, 0.9, 0.02);
    this.playerOffhandArm.parent = this.playerBody;
    const sabreSleeve = MeshBuilder.CreateCylinder("hero-sabre-sleeve", { height: 0.56, diameter: 0.19, tessellation: 6 }, this.scene);
    sabreSleeve.material = cloak;
    sabreSleeve.position.y = -0.25;
    sabreSleeve.rotation.z = 0.33;
    sabreSleeve.parent = this.playerOffhandArm;
    const sabreBlade = MeshBuilder.CreateCylinder("hero-lantern-sabre", { height: 0.63, diameterTop: 0.035, diameterBottom: 0.065, tessellation: 5 }, this.scene);
    sabreBlade.material = sabre;
    sabreBlade.position = new Vector3(-0.1, -0.5, 0.08);
    sabreBlade.rotation.z = 0.29;
    sabreBlade.parent = this.playerOffhandArm;
    const lanternAuraMat = this.material("hero-lantern-aura", palette.ember, { emissive: palette.ember });
    lanternAuraMat.alpha = 0.18;
    const lanternAura = MeshBuilder.CreateDisc("hero-lantern-aura", { radius: 1.15, tessellation: 32 }, this.scene);
    lanternAura.material = lanternAuraMat;
    lanternAura.rotation.x = Math.PI / 2;
    lanternAura.position.y = 0.025;
    lanternAura.parent = this.player;
    this.playerAura = lanternAura;
    this.lanternLight = new PointLight("hero-lantern-light", new Vector3(0, 0.04, 0), this.scene);
    this.lanternLight.diffuse = color(palette.ember);
    this.lanternLight.range = 5.7;
    this.lanternLight.intensity = 2.2;
    this.lanternLight.parent = this.playerLantern;
  }

  private createEnemy() {
    this.enemy.position.copyFrom(this.enemyPosition);
    const bark = this.material("hushling-bark", "#234c50", { emissive: "#0e2427", specular: "#000000" });
    const barkDark = this.material("hushling-deep-bark", "#102d32", { emissive: "#071416", specular: "#000000" });
    const glow = this.material("hushling-glow", palette.teal, { emissive: "#78f3e7", specular: "#000000" });
    this.enemyBody = new TransformNode("hushling-body-rig", this.scene);
    this.enemyBody.parent = this.enemy;
    const body = this.markEnemy(MeshBuilder.CreateSphere("hushling-body", { diameter: 1.15, segments: 7 }, this.scene));
    body.material = bark;
    body.scaling.y = 1.25;
    body.position.y = 0.75;
    body.parent = this.enemyBody;
    const belly = this.markEnemy(MeshBuilder.CreateSphere("hushling-belly", { diameter: 0.86, segments: 7 }, this.scene));
    belly.material = barkDark;
    belly.position = new Vector3(0, 0.52, 0.08);
    belly.scaling = new Vector3(1.08, 0.84, 0.86);
    belly.parent = this.enemyBody;
    this.enemyEyes = new TransformNode("hushling-eye-rig", this.scene);
    this.enemyEyes.parent = this.enemyBody;
    [0, 1, 2].forEach((index) => {
      const eye = this.markEnemy(MeshBuilder.CreateSphere(`hushling-eye-${index}`, { diameter: 0.13, segments: 6 }, this.scene));
      eye.material = glow;
      eye.position = new Vector3((index - 1) * 0.2, 0.88 + (index % 2) * 0.07, -0.48);
      eye.parent = this.enemyEyes;
    });
    [0, 1, 2, 3, 4].forEach((index) => {
      const tendril = new TransformNode(`hushling-tendril-rig-${index}`, this.scene);
      tendril.position = new Vector3(0, 0.32, 0);
      tendril.rotation.y = (index / 5) * Math.PI * 2;
      tendril.parent = this.enemyBody;
      const bramble = this.markEnemy(MeshBuilder.CreateCylinder(`hushling-bramble-${index}`, { height: 0.92 + (index % 2) * 0.12, diameterTop: 0.055, diameterBottom: 0.16, tessellation: 5 }, this.scene));
      bramble.material = bark;
      bramble.position = new Vector3(0, 0.08, 0.52 + (index % 2) * 0.08);
      bramble.rotation.x = Math.PI / 2.45;
      bramble.parent = tendril;
      const thorn = this.markEnemy(MeshBuilder.CreateSphere(`hushling-thorn-${index}`, { diameter: 0.16, segments: 5 }, this.scene));
      thorn.material = index % 2 ? barkDark : glow;
      thorn.position = new Vector3(0, 0.08, 0.92 + (index % 2) * 0.08);
      thorn.scaling.y = 1.55;
      thorn.parent = tendril;
      this.enemyTendrils.push(tendril);
    });
    this.enemyLight = new PointLight("hushling-mist-light", new Vector3(0, 1.1, 0), this.scene);
    this.enemyLight.diffuse = color(palette.teal);
    this.enemyLight.range = 3.3;
    this.enemyLight.intensity = 0.72;
    this.enemyLight.parent = this.enemy;
    this.createCinderLashImpactEffect();
  }

  private createCinderLashImpactEffect() {
    const ember = this.material("cinder-impact-ember", palette.ember, { emissive: palette.emberLight, specular: "#fff2ad" });
    const emberSoft = this.material("cinder-impact-soft", "#f9cf69", { emissive: "#f4a62f", specular: "#fff7c8" });
    emberSoft.alpha = 0.7;

    const ring = MeshBuilder.CreateTorus("cinder-lash-impact-ring", { diameter: 0.92, thickness: 0.045, tessellation: 28 }, this.scene);
    ring.material = ember;
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.08;
    ring.parent = this.enemy;
    ring.setEnabled(false);
    this.cinderImpactRing = ring;

    const flash = MeshBuilder.CreateSphere("cinder-lash-impact-flash", { diameter: 0.46, segments: 8 }, this.scene);
    flash.material = emberSoft;
    flash.position.y = 0.72;
    flash.parent = this.enemy;
    flash.setEnabled(false);
    this.cinderImpactFlash = flash;

    for (let index = 0; index < 16; index += 1) {
      const shard = MeshBuilder.CreatePolyhedron(`cinder-lash-ember-${index}`, { type: index % 3, size: 0.09 + (index % 4) * 0.012 }, this.scene);
      shard.material = index % 3 === 0 ? emberSoft : ember;
      shard.parent = this.enemy;
      shard.setEnabled(false);
      this.emberParticles.push({ mesh: shard, velocity: Vector3.Zero(), life: 0, maxLife: 0, spin: 0 });
    }
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
    this.cursorInnerRing = cursorRing;
    const cursorOuter = MeshBuilder.CreateTorus("cursor-rune-outer-ring", { diameter: 1.28, thickness: 0.024, tessellation: 28 }, this.scene);
    cursorOuter.material = movementMat;
    cursorOuter.rotation.x = Math.PI / 2;
    cursorOuter.parent = this.cursorMarker;
    this.cursorOuterRing = cursorOuter;
    this.cursorChevrons = new TransformNode("cursor-rune-chevrons", this.scene);
    this.cursorChevrons.position.y = 0.045;
    this.cursorChevrons.parent = this.cursorMarker;
    [0.34, 0.49, 0.64].forEach((z, index) => {
      const chevron = MeshBuilder.CreateBox(`cursor-rune-chevron-${index}`, { width: 0.13, height: 0.025, depth: 0.075 }, this.scene);
      chevron.material = movementMat;
      chevron.position = new Vector3(0, 0, z);
      chevron.rotation.y = Math.PI / 4;
      chevron.parent = this.cursorChevrons;
    });
    this.cursorMarker.setEnabled(false);

    this.enemyMarker = new TransformNode("enemy-rune", this.scene);
    const targetRing = MeshBuilder.CreateTorus("enemy-rune-ring", { diameter: 1.5, thickness: 0.055, tessellation: 28 }, this.scene);
    targetRing.material = targetMat;
    targetRing.rotation.x = Math.PI / 2;
    targetRing.parent = this.enemyMarker;
    this.enemyInnerRing = targetRing;
    const targetOuter = MeshBuilder.CreateTorus("enemy-rune-outer-ring", { diameter: 1.92, thickness: 0.025, tessellation: 28 }, this.scene);
    targetOuter.material = targetMat;
    targetOuter.rotation.x = Math.PI / 2;
    targetOuter.parent = this.enemyMarker;
    this.enemyOuterRing = targetOuter;
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
    const commandDirection = this.moveTarget.subtract(this.player.position);
    this.cursorChevrons.rotation.y = Math.atan2(commandDirection.x, commandDirection.z);
    this.cursorPulseTimer = 0.72;
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
    this.resetHushlingPattern();
    this.enemyMarker.position.copyFrom(this.enemy.position);
    this.enemyMarker.position.y = 0.035;
    this.targetPulseTimer = 0.72;
    this.enemyMarker.setEnabled(true);
    this.state.combatState = "combat";
    this.state.log = "Target marked: the Hushling. Closing the distance with lantern raised.";
    this.emit();
  }

  private moveToCursorTarget(delta: number) {
    if (!this.moveTarget || this.state.combatState === "defeated" || this.state.stage === "complete") {
      this.slowPlayer(delta);
      return;
    }
    const route = this.moveTarget.subtract(this.player.position);
    const distance = route.length();
    if (distance < 0.16 && this.playerVelocity.lengthSquared() < 0.1) {
      this.moveTarget = null;
      this.cursorMarker.setEnabled(false);
      this.state.log = "You reach the place your lantern marked.";
      this.emit();
      return;
    }
    this.movePlayer(route.normalize(), delta, 6.4 * Math.max(0.28, Math.min(1, distance / 1.25)));
  }

  private updateAutoStrike(delta: number) {
    if (!this.enemySelected || !this.enemy.isEnabled()) return;
    this.updateHushlingPattern(delta);
    const route = this.enemy.position.subtract(this.player.position);
    const distance = route.length();
    this.enemyMarker.position.copyFrom(this.enemy.position);
    if (distance > 1.42) {
      this.movePlayer(route.normalize(), delta, 6.55 * Math.max(0.34, Math.min(1, distance / 2.4)));
      return;
    }
    this.slowPlayer(delta);
    this.autoStrikeCooldown -= delta;
    if (this.autoStrikeCooldown > 0) return;
    this.autoStrikeCooldown = 0.92;
    this.autoStrikeCount += 1;
    const passiveStrike = this.autoStrikeCount % 3 === 0;
    const damage = (this.state.level === 1 ? 8 : 11) + (passiveStrike ? 4 : 0);
    this.playerAttackTimer = passiveStrike ? 0.52 : 0.4;
    this.enemyHitTimer = passiveStrike ? 0.42 : 0.3;
    this.state.enemyHp = Math.max(0, this.state.enemyHp - damage);
    this.state.log = passiveStrike
      ? `Ember Circuit blooms: your third auto-strike lands for ${damage}.`
      : `Your lantern-sabre strikes automatically for ${damage}.`;
    if (this.state.enemyHp <= 0) {
      this.defeatEnemy();
      return;
    }
    this.hushlingPattern = passiveStrike ? "recover" : "feint";
    this.hushlingPatternTimer = passiveStrike ? 0.56 : 0.36;
    const retaliation = 4;
    this.state.hp = Math.max(0, this.state.hp - retaliation);
    this.enemyAttackTimer = 0.34;
    this.playerHitTimer = 0.26;
    this.state.log += ` The Hushling answers for ${retaliation}.`;
    if (this.state.hp <= 0) {
      this.state.combatState = "defeated";
      this.enemySelected = false;
      this.enemyMarker.setEnabled(false);
      this.state.log = "The mist folds around your lantern. Select the path again when you are ready.";
    }
    this.emit();
  }

  private movePlayer(direction: Vector3, delta: number, targetSpeed = 6.4) {
    const steer = 1 - Math.exp(-delta * 13);
    const desiredVelocity = direction.scale(targetSpeed);
    this.playerVelocity.x += (desiredVelocity.x - this.playerVelocity.x) * steer;
    this.playerVelocity.z += (desiredVelocity.z - this.playerVelocity.z) * steer;
    this.player.position.addInPlace(this.playerVelocity.scale(delta));
    this.player.position.x = Math.max(-22, Math.min(22, this.player.position.x));
    this.player.position.z = Math.max(-16, Math.min(16, this.player.position.z));
    this.playerMoveDirection.copyFrom(direction);
    const facing = Math.atan2(direction.x, direction.z);
    this.player.rotation.y = this.lerpAngle(this.player.rotation.y, facing, 1 - Math.exp(-delta * 15));
    this.playerMotion += this.playerVelocity.length() * delta;
  }

  private slowPlayer(delta: number) {
    const braking = Math.exp(-delta * 10);
    this.playerVelocity.scaleInPlace(braking);
    if (this.playerVelocity.lengthSquared() < 0.001) {
      this.playerVelocity.set(0, 0, 0);
      return;
    }
    this.player.position.addInPlace(this.playerVelocity.scale(delta));
    this.player.position.x = Math.max(-22, Math.min(22, this.player.position.x));
    this.player.position.z = Math.max(-16, Math.min(16, this.player.position.z));
    this.playerMotion += this.playerVelocity.length() * delta;
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
    this.enemyDefeatTimer = 0.72;
    this.playerVictoryTimer = 0.85;
    this.hushlingVelocity.set(0, 0, 0);
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

  private updateHushlingPattern(delta: number) {
    if (!this.enemySelected || this.state.combatState !== "combat" || !this.enemy.isEnabled()) return;
    const playerOffset = this.player.position.subtract(this.enemy.position);
    playerOffset.y = 0;
    const distance = Math.max(0.001, playerOffset.length());
    const towardPlayer = playerOffset.scale(1 / distance);
    const sideways = new Vector3(-towardPlayer.z, 0, towardPlayer.x).scale(this.hushlingOrbitDirection);
    this.hushlingPatternTimer -= delta;
    this.hushlingLungeCooldown = Math.max(0, this.hushlingLungeCooldown - delta);

    if (this.hushlingPatternTimer <= 0) {
      if (this.hushlingPattern === "orbit") {
        this.hushlingPattern = distance < 2.3 && this.hushlingLungeCooldown <= 0 ? "lunge" : "feint";
        this.hushlingPatternTimer = this.hushlingPattern === "lunge" ? 0.34 : 0.42;
        this.hushlingLungeHit = false;
        if (this.hushlingPattern === "lunge") {
          this.hushlingLungeCooldown = 3.2;
          this.state.log = "The Hushling folds its roots and lashes through the mist.";
          this.emit();
        }
      } else if (this.hushlingPattern === "feint" || this.hushlingPattern === "lunge") {
        this.hushlingPattern = "recover";
        this.hushlingPatternTimer = 0.56;
      } else {
        this.hushlingPattern = "orbit";
        this.hushlingPatternTimer = 0.9;
        this.hushlingOrbitDirection *= -1;
      }
    }

    let direction = sideways;
    let speed = 1.32;
    if (this.hushlingPattern === "orbit") {
      direction = sideways.scale(0.8).add(towardPlayer.scale((distance - 2.05) * 0.72));
      speed = 1.45;
    } else if (this.hushlingPattern === "feint") {
      direction = sideways.scale(0.9).add(towardPlayer.scale(-0.72));
      speed = 4.15;
    } else if (this.hushlingPattern === "lunge") {
      direction = towardPlayer;
      speed = 6.1;
      if (!this.hushlingLungeHit && distance < 1.25) {
        this.hushlingLungeHit = true;
        this.state.hp = Math.max(0, this.state.hp - 3);
        this.enemyAttackTimer = 0.36;
        this.playerHitTimer = 0.22;
        this.state.log = "Bramble Skitter catches your flank for 3 warmth.";
        if (this.state.hp <= 0) {
          this.state.combatState = "defeated";
          this.enemySelected = false;
          this.enemyMarker.setEnabled(false);
          this.state.log = "The Hushling’s roots close in. Return to the old road when your lantern is ready.";
        }
        this.emit();
      }
    } else {
      direction = sideways.scale(0.45).add(towardPlayer.scale((distance - 2.12) * 0.95));
      speed = 1.8;
    }

    if (direction.lengthSquared() > 0.0001) direction.normalize();
    const steer = 1 - Math.exp(-delta * 10);
    this.hushlingVelocity.x += (direction.x * speed - this.hushlingVelocity.x) * steer;
    this.hushlingVelocity.z += (direction.z * speed - this.hushlingVelocity.z) * steer;
    this.enemy.position.addInPlace(this.hushlingVelocity.scale(delta));
    this.enemy.position.x = Math.max(-21.3, Math.min(21.3, this.enemy.position.x));
    this.enemy.position.z = Math.max(-15.3, Math.min(15.3, this.enemy.position.z));
    const facing = Math.atan2(towardPlayer.x, towardPlayer.z);
    this.enemy.rotation.y = this.lerpAngle(this.enemy.rotation.y, facing, 1 - Math.exp(-delta * 12));
  }

  private resetHushlingPattern() {
    this.hushlingPattern = "orbit";
    this.hushlingPatternTimer = 0.88;
    this.hushlingLungeCooldown = 2.5;
    this.hushlingLungeHit = false;
    this.hushlingOrbitDirection = 1;
    this.hushlingVelocity.set(0, 0, 0);
  }

  private spawnCinderLashImpact() {
    this.cinderImpactTimer = 0.62;
    this.cinderImpactRing.setEnabled(true);
    this.cinderImpactFlash.setEnabled(true);
    this.emberParticles.forEach((particle, index) => {
      const angle = (index / this.emberParticles.length) * Math.PI * 2 + this.time * 0.75;
      const speed = 1.25 + (index % 4) * 0.22;
      particle.maxLife = 0.34 + (index % 5) * 0.045;
      particle.life = particle.maxLife;
      particle.spin = (index % 2 ? -1 : 1) * (4.5 + (index % 3));
      particle.velocity.set(Math.cos(angle) * speed, 1.35 + (index % 3) * 0.24, Math.sin(angle) * speed);
      particle.mesh.position.set(0, 0.76, 0);
      particle.mesh.rotation.set(angle, angle * 0.5, -angle);
      particle.mesh.scaling.set(1, 1, 1);
      particle.mesh.setEnabled(true);
    });
  }

  private updateCinderLashImpact(delta: number) {
    if (this.cinderImpactTimer > 0) {
      this.cinderImpactTimer = Math.max(0, this.cinderImpactTimer - delta);
      const progress = 1 - this.cinderImpactTimer / 0.62;
      const ringScale = 0.75 + progress * 2.65;
      this.cinderImpactRing.scaling.set(ringScale, ringScale, ringScale);
      this.cinderImpactRing.rotation.y += delta * 8.5;
      const flashScale = 1 + Math.sin(Math.min(1, progress * 2.2) * Math.PI) * 1.55;
      this.cinderImpactFlash.scaling.set(flashScale, flashScale, flashScale);
      if (this.cinderImpactTimer === 0) {
        this.cinderImpactRing.setEnabled(false);
        this.cinderImpactFlash.setEnabled(false);
      }
    }
    this.emberParticles.forEach((particle) => {
      if (particle.life <= 0) return;
      particle.life = Math.max(0, particle.life - delta);
      particle.mesh.position.addInPlace(particle.velocity.scale(delta));
      particle.velocity.y -= delta * 4.6;
      particle.mesh.rotation.x += particle.spin * delta;
      particle.mesh.rotation.z += particle.spin * 0.62 * delta;
      const fade = particle.life / particle.maxLife;
      const scale = 0.35 + fade * 0.9;
      particle.mesh.scaling.set(scale, scale, scale);
      if (particle.life === 0) particle.mesh.setEnabled(false);
    });
  }

  private updateCharacterMotion(delta: number) {
    this.playerAttackTimer = Math.max(0, this.playerAttackTimer - delta);
    this.playerCastTimer = Math.max(0, this.playerCastTimer - delta);
    this.playerHitTimer = Math.max(0, this.playerHitTimer - delta);
    this.playerVictoryTimer = Math.max(0, this.playerVictoryTimer - delta);
    this.enemyHitTimer = Math.max(0, this.enemyHitTimer - delta);
    this.enemyAttackTimer = Math.max(0, this.enemyAttackTimer - delta);
    this.enemyDefeatTimer = Math.max(0, this.enemyDefeatTimer - delta);

    const playerSpeed = this.playerVelocity.length();
    const walkBlend = Math.min(1, playerSpeed / 6.4);
    const walkPhase = this.playerMotion * 10.5;
    const idleSway = Math.sin(this.time * 2.3) * 0.018;
    const walkBob = Math.abs(Math.sin(walkPhase)) * 0.052 * walkBlend;
    const attackProgress = this.playerAttackTimer ? 1 - this.playerAttackTimer / 0.52 : 0;
    const attackCurve = Math.sin(attackProgress * Math.PI) * (this.playerAttackTimer ? 1 : 0);
    const castProgress = this.playerCastTimer ? 1 - this.playerCastTimer / 0.52 : 0;
    const castCurve = Math.sin(castProgress * Math.PI) * (this.playerCastTimer ? 1 : 0);
    const hitCurve = Math.sin((1 - this.playerHitTimer / 0.26) * Math.PI) * (this.playerHitTimer ? 1 : 0);
    const victoryProgress = this.playerVictoryTimer ? 1 - this.playerVictoryTimer / 0.85 : 0;
    const victoryCurve = Math.sin(victoryProgress * Math.PI) * (this.playerVictoryTimer ? 1 : 0);

    this.playerBody.position.y = idleSway + walkBob + victoryCurve * 0.18;
    this.playerBody.position.z = attackCurve * 0.2 + castCurve * 0.08 - hitCurve * 0.06;
    this.playerBody.rotation.x = -walkBlend * 0.1 + attackCurve * 0.16 - hitCurve * 0.13;
    this.playerBody.rotation.z = Math.sin(this.time * 2.3) * 0.025 + hitCurve * 0.11;
    this.playerCape.rotation.x = -0.08 + Math.sin(walkPhase + 0.9) * 0.14 * walkBlend - attackCurve * 0.12;
    this.playerCape.rotation.z = Math.sin(this.time * 2.1) * 0.035;
    this.playerHead.rotation.z = Math.sin(this.time * 2.3 + 0.6) * 0.025 - hitCurve * 0.08;
    this.playerLanternArm.rotation.x = Math.sin(walkPhase) * 0.42 * walkBlend - attackCurve * 0.5 - castCurve * 0.44;
    this.playerLanternArm.rotation.z = -castCurve * 0.22;
    this.playerOffhandArm.rotation.x = -Math.sin(walkPhase) * 0.48 * walkBlend + attackCurve * 0.7;
    this.playerOffhandArm.rotation.z = attackCurve * 0.26;
    this.playerLantern.rotation.z = Math.sin(this.time * 4.2) * 0.04 - castCurve * 0.12;
    const auraScale = 1 + Math.sin(this.time * 4.2) * 0.025 + castCurve * 0.36 + victoryCurve * 0.18;
    this.playerAura.scaling.x = auraScale;
    this.playerAura.scaling.y = auraScale;
    this.playerAura.scaling.z = auraScale;
    const flameScale = 1 + Math.sin(this.time * 5.2) * 0.14 + castCurve * 0.58;
    this.playerFlame.scaling.set(flameScale, flameScale * 1.18, flameScale);
    this.player.rotation.y += victoryCurve * delta * 9;

    if (this.enemy.isEnabled()) {
      const hover = Math.sin(this.time * 2.45 + 1) * 0.075;
      const hitProgress = this.enemyHitTimer ? 1 - this.enemyHitTimer / 0.42 : 0;
      const enemyHitCurve = Math.sin(hitProgress * Math.PI) * (this.enemyHitTimer ? 1 : 0);
      const enemyAttackProgress = this.enemyAttackTimer ? 1 - this.enemyAttackTimer / 0.34 : 0;
      const enemyAttackCurve = Math.sin(enemyAttackProgress * Math.PI) * (this.enemyAttackTimer ? 1 : 0);
      const defeatProgress = this.enemyDefeatTimer ? 1 - this.enemyDefeatTimer / 0.72 : 0;
      const defeatCurve = this.enemyDefeatTimer ? defeatProgress : 0;
      this.enemy.position.y = hover - defeatCurve * 0.32;
      this.enemyBody.position.z = enemyAttackCurve * -0.24 + enemyHitCurve * 0.1;
      this.enemyBody.rotation.z = Math.sin(this.time * 2.2) * 0.06 + enemyHitCurve * 0.18 + defeatCurve * 0.62;
      this.enemyBody.rotation.y = Math.sin(this.time * 1.7) * 0.11;
      const enemyScale = 1 + enemyHitCurve * 0.15;
      this.enemyBody.scaling.set(enemyScale + defeatCurve * 0.2, 1 - defeatCurve * 0.62, enemyScale + defeatCurve * 0.2);
      this.enemyEyes.scaling.set(1 + enemyHitCurve * 0.42, 1 + enemyHitCurve * 0.42, 1 + enemyHitCurve * 0.42);
      this.enemyEyes.position.y = Math.sin(this.time * 6.2) * 0.018;
      this.enemyTendrils.forEach((tendril, index) => {
        tendril.rotation.z = Math.sin(this.time * 3.1 + index * 1.22) * 0.23 + enemyAttackCurve * (index % 2 ? -0.3 : 0.3);
        tendril.rotation.x = Math.sin(this.time * 2.2 + index) * 0.08;
      });
      if (this.enemyDefeatTimer === 0 && this.state.combatState === "victory") this.enemy.setEnabled(false);
    }
  }

  private updateCommandMarkers(delta: number) {
    if (this.cursorMarker.isEnabled()) {
      this.cursorPulseTimer = Math.max(0, this.cursorPulseTimer - delta);
      const pulse = 1 + Math.sin(this.time * 5.4) * 0.08 + (this.cursorPulseTimer > 0 ? this.cursorPulseTimer * 0.32 : 0);
      this.cursorInnerRing.rotation.y += delta * 1.2;
      this.cursorOuterRing.rotation.y -= delta * 0.78;
      this.cursorInnerRing.scaling.set(pulse, pulse, pulse);
      this.cursorOuterRing.scaling.set(pulse * 1.06, pulse * 1.06, pulse * 1.06);
      this.cursorChevrons.position.y = 0.045 + Math.sin(this.time * 6.2) * 0.018;
    }
    if (this.enemyMarker.isEnabled()) {
      this.targetPulseTimer = Math.max(0, this.targetPulseTimer - delta);
      const pulse = 1 + Math.sin(this.time * 4.6) * 0.06 + (this.targetPulseTimer > 0 ? this.targetPulseTimer * 0.22 : 0);
      this.enemyInnerRing.rotation.y += delta * 0.85;
      this.enemyOuterRing.rotation.y -= delta * 0.56;
      this.enemyInnerRing.scaling.set(pulse, pulse, pulse);
      this.enemyOuterRing.scaling.set(pulse * 1.08, pulse * 1.08, pulse * 1.08);
    }
  }

  private resetMotionRig() {
    this.playerBody.position.set(0, 0, 0);
    this.playerBody.rotation.set(0, 0, 0);
    this.playerCape.rotation.set(0, 0, 0);
    this.playerHead.rotation.set(0, 0, 0);
    this.playerLanternArm.rotation.set(0, 0, 0);
    this.playerOffhandArm.rotation.set(0, 0, 0);
    this.playerLantern.rotation.set(0, 0, 0);
    this.playerAura.scaling.set(1, 1, 1);
    this.playerFlame.scaling.set(1, 1, 1);
    this.enemy.position.y = 0;
    this.enemyBody.position.set(0, 0, 0);
    this.enemyBody.rotation.set(0, 0, 0);
    this.enemyBody.scaling.set(1, 1, 1);
    this.enemyEyes.position.set(0, 0, 0);
    this.enemyEyes.scaling.set(1, 1, 1);
    this.enemyTendrils.forEach((tendril) => tendril.rotation.set(0, tendril.rotation.y, 0));
  }

  private lerpAngle(current: number, target: number, amount: number) {
    const difference = ((target - current + Math.PI) % (Math.PI * 2)) - Math.PI;
    return current + difference * amount;
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
