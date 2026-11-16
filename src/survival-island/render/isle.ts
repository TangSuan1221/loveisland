// Three.js 场景：WebGPURenderer（不可用时自动回退 WebGL2 后端）。
// 只读快照（SoA），不遍历对象、不写模拟状态（铁律 12）。
import {
  AmbientLight, BufferAttribute, BufferGeometry, CapsuleGeometry, Color, ConeGeometry, CylinderGeometry,
  DirectionalLight, DynamicDrawUsage, Fog, InstancedBufferAttribute, InstancedMesh, LineBasicNodeMaterial,
  LineDashedNodeMaterial, LineSegments, Matrix4, Mesh, MeshLambertNodeMaterial, MeshStandardNodeMaterial,
  Object3D, OctahedronGeometry, PerspectiveCamera, PlaneGeometry, Raycaster, RingGeometry, Scene,
  SpriteNodeMaterial, Vector2, Vector3, WebGPURenderer,
} from 'three/webgpu';
import { attribute, float, texture, uv, vec2 } from 'three/tsl';
import type { Snapshot } from '@cruel-isle/sim-core';
import { CAMP, siteWorld, targetPositions } from './layout.ts';
import { ATLAS_COLS, ATLAS_ROWS, TIER_COLORS, atlasFeeling, atlasNeed, buildAtlas } from './palette.ts';

const MAX_NPC = 64;           // 历史总人数上限 16，预留余量
const MAX_EDGES = MAX_NPC * 2;
const MAX_ICONS = MAX_NPC * 3;
const MAX_SITES = 16;
const RES_COLOR = [new Color('#f59e0b'), new Color('#38bdf8'), new Color('#a16207')];   // food water firewood
const SEASON_GROUND = ['#4d7c0f', '#3f6212', '#a16207', '#e2e8f0'].map(c => new Color(c));

export interface Pick { kind: 'npc' | 'site'; index: number }

export class IsleRenderer {
  readonly renderer: WebGPURenderer;
  readonly scene = new Scene();
  readonly camera: PerspectiveCamera;
  backendName = '…';

  private ground!: Mesh;
  private npcMesh!: InstancedMesh;
  private ringMesh!: InstancedMesh;
  private siteMesh!: InstancedMesh;
  private fogMesh!: InstancedMesh;
  private fire!: Mesh;
  private edgesSolid!: LineSegments;
  private edgesDashed!: LineSegments;
  private icons!: InstancedMesh;
  private iconUv!: InstancedBufferAttribute;

  private pos = new Float32Array(MAX_NPC * 2);       // 当前插值位置
  private target = new Float32Array(MAX_NPC * 2);    // 本快照目标位置
  private dummy = new Object3D();
  private raycaster = new Raycaster();
  private hoverNpc = -1;

  /** 相机轨道参数 */
  private orbit = { yaw: 0.6, pitch: 0.95, dist: 46, tx: 0, tz: 0 };

  constructor(private canvas: HTMLCanvasElement, forceWebGL: boolean) {
    this.renderer = new WebGPURenderer({ canvas, antialias: true, forceWebGL });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    this.camera = new PerspectiveCamera(42, 1, 0.5, 400);
    this.scene.background = new Color('#0b1d2e');
    this.scene.fog = new Fog('#0b1d2e', 70, 160);
    this.buildStatic();
    this.bindInput();
  }

  async init() {
    await this.renderer.init();
    // 后端探测：WebGPU 不可用时 three 会自动切到 WebGL2 后端
    const b = (this.renderer as unknown as { backend: { isWebGPUBackend?: boolean } }).backend;
    this.backendName = b?.isWebGPUBackend ? 'WebGPU' : 'WebGL2';
    this.resize();
  }

  /* ───────────── 静态几何 ───────────── */
  private buildStatic() {
    const sc = this.scene;
    sc.add(new AmbientLight('#cbd5e1', 1.4));
    const sun = new DirectionalLight('#fff7ed', 2.2);
    sun.position.set(20, 40, 15);
    sc.add(sun);

    // 海
    const sea = new Mesh(new PlaneGeometry(400, 400), new MeshLambertNodeMaterial({ color: '#0e3a5b' }));
    sea.rotation.x = -Math.PI / 2; sea.position.y = -0.6;
    sc.add(sea);

    // 岛：一张带顶点色和起伏的网格（1 draw）
    const g = new PlaneGeometry(64, 52, 64, 52);
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position as BufferAttribute;
    const col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      const r = Math.hypot(x / 30, z / 24);
      const wobble = 0.08 * Math.sin(x * 0.35) * Math.cos(z * 0.42) + 0.05 * Math.sin(x * 0.9 + z * 0.7);
      const h = (1 - r + wobble) * 3.2;
      p.setY(i, Math.max(-1.2, h));
      const beach = h < 0.35;
      const c = beach ? new Color('#d6c08a') : new Color('#ffffff');
      col.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new BufferAttribute(col, 3));
    g.computeVertexNormals();
    this.ground = new Mesh(g, new MeshLambertNodeMaterial({ vertexColors: true, color: SEASON_GROUND[0] }));
    sc.add(this.ground);

    // 营火（冬季有柴时亮）
    this.fire = new Mesh(new ConeGeometry(0.6, 1.4, 8), new MeshStandardNodeMaterial({ color: '#f97316', emissive: '#f97316', emissiveIntensity: 2 }));
    this.fire.position.set(CAMP.x, this.heightAt(0, 0) + 0.7, CAMP.z);
    sc.add(this.fire);
    const campRing = new Mesh(new RingGeometry(2.2, 2.5, 32), new MeshLambertNodeMaterial({ color: '#78350f' }));
    campRing.rotation.x = -Math.PI / 2; campRing.position.set(CAMP.x, this.heightAt(0, 0) + 0.05, CAMP.z);
    sc.add(campRing);

    // NPC：胶囊体实例化（1 draw）；颜色 = 情绪；死者变灰
    this.npcMesh = new InstancedMesh(new CapsuleGeometry(0.32, 0.7, 4, 10), new MeshStandardNodeMaterial({ roughness: 0.7 }), MAX_NPC);
    this.npcMesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.npcMesh.count = 0;
    this.npcMesh.frustumCulled = false;
    sc.add(this.npcMesh);
    // 选中/悬停光圈（1 draw）
    this.ringMesh = new InstancedMesh(new RingGeometry(0.55, 0.7, 24).rotateX(-Math.PI / 2), new MeshLambertNodeMaterial({ color: '#ffffff' }), 2);
    this.ringMesh.count = 0; this.ringMesh.frustumCulled = false;
    sc.add(this.ringMesh);

    // 资源点位（已知：柱体，颜色=资源，高度=可采量）与未知（八面体「雾」）各 1 draw
    this.siteMesh = new InstancedMesh(new CylinderGeometry(1, 1, 1, 12), new MeshStandardNodeMaterial({ roughness: 0.5 }), MAX_SITES);
    this.siteMesh.count = 0; this.siteMesh.frustumCulled = false;
    sc.add(this.siteMesh);
    const fogMat = new MeshStandardNodeMaterial({ color: '#cbd5e1', transparent: true, opacity: 0.35, emissive: '#94a3b8', emissiveIntensity: 0.4 });
    this.fogMesh = new InstancedMesh(new OctahedronGeometry(1.2, 0), fogMat, MAX_SITES);
    this.fogMesh.count = 0; this.fogMesh.frustumCulled = false;
    sc.add(this.fogMesh);

    // 关系连线：实线（双向关系）+ 虚线（单向：对方没回应同档）。颜色 = Bond 档位；粗细 = Strain → 用多条平行线近似（WebGPU 线宽恒为 1px）
    const mkLines = (dashed: boolean) => {
      const geo = new BufferGeometry();
      const n = MAX_EDGES * 6 * 2;          // 每边最多 6 条平行线 × 2 顶点 + 箭头
      geo.setAttribute('position', new BufferAttribute(new Float32Array(n * 3 * 2), 3).setUsage(DynamicDrawUsage));
      geo.setAttribute('color', new BufferAttribute(new Float32Array(n * 3 * 2), 3).setUsage(DynamicDrawUsage));
      geo.setDrawRange(0, 0);
      const mat = dashed
        ? new LineDashedNodeMaterial({ vertexColors: true, dashSize: 0.5, gapSize: 0.35, transparent: true, opacity: 0.95 })
        : new LineBasicNodeMaterial({ vertexColors: true, transparent: true, opacity: 0.95 });
      const ls = new LineSegments(geo, mat);
      ls.frustumCulled = false;
      return ls;
    };
    this.edgesSolid = mkLines(false);
    this.edgesDashed = mkLines(true);
    sc.add(this.edgesSolid, this.edgesDashed);

    // 头顶图标：图集 + 实例化 sprite（1 draw）。每实例一个 uv 偏移
    const atlas = buildAtlas();
    this.iconUv = new InstancedBufferAttribute(new Float32Array(MAX_ICONS * 2), 2);
    this.iconUv.setUsage(DynamicDrawUsage);
    const mat = new SpriteNodeMaterial({ transparent: true, depthTest: false });
    const cell = vec2(1 / ATLAS_COLS, 1 / ATLAS_ROWS);
    const off = attribute('iconUv', 'vec2');
    mat.colorNode = texture(atlas, uv().mul(cell).add(off));
    mat.scaleNode = float(0.9);
    const quad = new PlaneGeometry(1, 1);
    quad.setAttribute('iconUv', this.iconUv);
    this.icons = new InstancedMesh(quad, mat, MAX_ICONS);
    this.icons.count = 0; this.icons.frustumCulled = false; this.icons.renderOrder = 10;
    sc.add(this.icons);
  }

  /** 与岛网格同一公式的高度（放置物体用） */
  heightAt(x: number, z: number) {
    const r = Math.hypot(x / 30, z / 24);
    const wobble = 0.08 * Math.sin(x * 0.35) * Math.cos(z * 0.42) + 0.05 * Math.sin(x * 0.9 + z * 0.7);
    return Math.max(-1.2, (1 - r + wobble) * 3.2);
  }

  /* ───────────── 输入：拖拽旋转、滚轮缩放、右键平移 ───────────── */
  private bindInput() {
    let drag: { x: number; y: number; btn: number } | null = null;
    const c = this.canvas;
    c.addEventListener('contextmenu', e => e.preventDefault());
    c.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, btn: e.button }; c.setPointerCapture(e.pointerId); });
    c.addEventListener('pointerup', () => { drag = null; });
    c.addEventListener('pointermove', e => {
      this.pointer.set((e.offsetX / c.clientWidth) * 2 - 1, -(e.offsetY / c.clientHeight) * 2 + 1);
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      drag.x = e.clientX; drag.y = e.clientY;
      if (drag.btn === 2 || e.shiftKey) {
        const s = this.orbit.dist * 0.0018;
        const cy = Math.cos(this.orbit.yaw), sy = Math.sin(this.orbit.yaw);
        this.orbit.tx -= (dx * cy + dy * sy) * s * 1.6;
        this.orbit.tz -= (-dx * sy + dy * cy) * s * 1.6;
      } else {
        this.orbit.yaw -= dx * 0.006;
        this.orbit.pitch = Math.min(1.45, Math.max(0.25, this.orbit.pitch + dy * 0.005));
      }
      this.dragged = true;
    });
    c.addEventListener('wheel', e => {
      e.preventDefault();
      this.orbit.dist = Math.min(110, Math.max(14, this.orbit.dist * (1 + Math.sign(e.deltaY) * 0.1)));
    }, { passive: false });
  }
  readonly pointer = new Vector2(9, 9);
  dragged = false;

  focusOn(x: number, z: number) { this.orbit.tx = x; this.orbit.tz = z; this.orbit.dist = Math.min(this.orbit.dist, 34); }
  npcWorldPos(i: number) { return { x: this.pos[2 * i], z: this.pos[2 * i + 1] }; }

  resize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
  }

  /** 拾取：NPC 优先，其次点位 */
  pick(s: Snapshot | null): Pick | null {
    if (!s) return null;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObject(this.npcMesh, false)[0];
    if (hit?.instanceId != null) return { kind: 'npc', index: this.npcOrder[hit.instanceId] };
    const hs = this.raycaster.intersectObjects([this.siteMesh, this.fogMesh], false)[0];
    if (hs?.instanceId != null) return { kind: 'site', index: hs.object === this.siteMesh ? this.siteKnown[hs.instanceId] : this.siteUnknown[hs.instanceId] };
    return null;
  }
  private npcOrder: number[] = [];
  private siteKnown: number[] = [];
  private siteUnknown: number[] = [];

  /* ───────────── 每帧 ───────────── */
  frame(s: Snapshot | null, dtSec: number, selected: number, hover: number, showLines: boolean) {
    const o = this.orbit;
    this.camera.position.set(
      o.tx + o.dist * Math.cos(o.pitch) * Math.sin(o.yaw),
      o.dist * Math.sin(o.pitch),
      o.tz + o.dist * Math.cos(o.pitch) * Math.cos(o.yaw),
    );
    this.camera.lookAt(o.tx, 0, o.tz);

    if (s) this.applySnapshot(s, dtSec, selected, hover, showLines);
    this.renderer.render(this.scene, this.camera);
  }

  private applySnapshot(s: Snapshot, dtSec: number, selected: number, hover: number, showLines: boolean) {
    // 季节：地面色、营火
    (this.ground.material as MeshLambertNodeMaterial).color.copy(SEASON_GROUND[s.seasonIdx]);
    this.fire.visible = s.fireActive;
    const night = s.hour >= 20 || s.hour < 6;
    (this.scene.background as Color).set(night ? '#050d18' : '#0b1d2e');

    // NPC 位置：向布局目标平滑趋近（插值；位置不来自模拟状态，只是可视化）
    targetPositions(s, this.target);
    const k = 1 - Math.exp(-dtSec * 3);
    let shown = 0;
    this.npcOrder.length = 0;
    const c = new Color();
    for (let i = 0; i < s.count; i++) {
      if (this.pos[2 * i] === 0 && this.pos[2 * i + 1] === 0) { this.pos[2 * i] = this.target[2 * i]; this.pos[2 * i + 1] = this.target[2 * i + 1]; }
      this.pos[2 * i] += (this.target[2 * i] - this.pos[2 * i]) * k;
      this.pos[2 * i + 1] += (this.target[2 * i + 1] - this.pos[2 * i + 1]) * k;
      const x = this.pos[2 * i], z = this.pos[2 * i + 1];
      const y = this.heightAt(x, z);
      const alive = s.alive[i] === 1;
      const scale = (s.age[i] < 16 ? 0.6 + s.age[i] / 40 : 1) * (s.elder[i] ? 0.92 : 1);
      this.dummy.position.set(x, y + (alive ? 0.68 * scale : 0.2), z);
      this.dummy.rotation.set(alive ? 0 : Math.PI / 2, 0, 0);
      this.dummy.scale.setScalar(scale);
      this.dummy.updateMatrix();
      this.npcMesh.setMatrixAt(shown, this.dummy.matrix);
      if (!alive) c.set('#334155');
      else c.set(['#e5e7eb', '#86efac', '#a5b4fc', '#fde68a', '#fdba74', '#f87171', '#93c5fd', '#64748b', '#ef4444', '#b45309'][s.feeling[i]] ?? '#e5e7eb');
      if (alive && s.elder[i]) c.lerp(new Color('#ffffff'), 0.35);
      this.npcMesh.setColorAt(shown, c);
      this.npcOrder.push(i);
      shown++;
    }
    this.npcMesh.count = shown;
    this.npcMesh.instanceMatrix.needsUpdate = true;
    if (this.npcMesh.instanceColor) this.npcMesh.instanceColor.needsUpdate = true;

    // 选中/悬停光圈
    let rings = 0;
    for (const [idx, col] of [[selected, '#facc15'], [hover, '#ffffff']] as const) {
      if (idx < 0 || idx >= s.count || (idx === hover && idx === selected && rings > 0)) continue;
      const x = this.pos[2 * idx], z = this.pos[2 * idx + 1];
      this.dummy.position.set(x, this.heightAt(x, z) + 0.06, z);
      this.dummy.rotation.set(0, 0, 0); this.dummy.scale.setScalar(1);
      this.dummy.updateMatrix();
      this.ringMesh.setMatrixAt(rings, this.dummy.matrix);
      this.ringMesh.setColorAt(rings, new Color(col));
      rings++;
    }
    this.ringMesh.count = rings;
    this.ringMesh.instanceMatrix.needsUpdate = true;
    if (this.ringMesh.instanceColor) this.ringMesh.instanceColor.needsUpdate = true;

    this.applySites(s);
    this.applyEdges(s, selected, showLines);
    this.applyIcons(s);
  }

  private applySites(s: Snapshot) {
    let kn = 0, un = 0;
    this.siteKnown.length = 0; this.siteUnknown.length = 0;
    for (let k = 0; k < s.siteCount; k++) {
      const p = siteWorld(s.siteX[k], s.siteY[k]);
      const y = this.heightAt(p.x, p.z);
      if (s.siteState[k] === 0) {
        // 未知点位：模糊提示（一团缓慢旋转的雾），不透露资源类型
        this.dummy.position.set(p.x, y + 1.6 + 0.2 * Math.sin(performance.now() / 700 + k), p.z);
        this.dummy.rotation.set(0, performance.now() / 2000 + k, 0);
        this.dummy.scale.setScalar(1);
        this.dummy.updateMatrix();
        this.fogMesh.setMatrixAt(un++, this.dummy.matrix);
        this.siteUnknown.push(k);
      } else {
        const fill = Math.max(0.06, s.siteFill[k]);
        this.dummy.position.set(p.x, y + fill * 1.2, p.z);
        this.dummy.rotation.set(0, 0, 0);
        this.dummy.scale.set(0.9, fill * 2.4, 0.9);
        this.dummy.updateMatrix();
        this.siteMesh.setMatrixAt(kn, this.dummy.matrix);
        const c = RES_COLOR[s.siteResource[k]].clone();
        if (s.siteState[k] === 2) c.multiplyScalar(0.35);       // 采空
        this.siteMesh.setColorAt(kn, c);
        this.siteKnown.push(k);
        kn++;
      }
    }
    this.siteMesh.count = kn; this.fogMesh.count = un;
    this.siteMesh.instanceMatrix.needsUpdate = true; this.fogMesh.instanceMatrix.needsUpdate = true;
    if (this.siteMesh.instanceColor) this.siteMesh.instanceColor.needsUpdate = true;
  }

  /**
   * 选中 NPC → 展开其所有出边（SPEC §11.3）
   *   颜色 = Bond 12 档；粗细 = Strain 0→100 映射 1→6 条平行线（WebGPU 线宽固定 1px，用平行线近似线宽）
   *   虚线 = 单向（对方回看我的档位与我看他的不同）；箭头 = 方向
   *   Strain 数值永不显示
   */
  private applyEdges(s: Snapshot, selected: number, show: boolean) {
    const solidPos = this.edgesSolid.geometry.attributes.position as BufferAttribute;
    const solidCol = this.edgesSolid.geometry.attributes.color as BufferAttribute;
    const dashPos = this.edgesDashed.geometry.attributes.position as BufferAttribute;
    const dashCol = this.edgesDashed.geometry.attributes.color as BufferAttribute;
    let ns = 0, nd = 0;
    if (show && selected >= 0 && selected < s.count && s.alive[selected]) {
      // 反向档位表：tierOf[to] = to→selected 的档位
      const back = new Int16Array(s.count).fill(-1);
      for (let e = 0; e < s.edgeCount; e++) if (s.edgeTo[e] === selected) back[s.edgeFrom[e]] = s.edgeTier[e];
      const ax = this.pos[2 * selected], az = this.pos[2 * selected + 1];
      const ay = this.heightAt(ax, az) + 1.0;
      const up = new Vector3(0, 1, 0);
      for (let e = 0; e < s.edgeCount; e++) {
        if (s.edgeFrom[e] !== selected) continue;
        const to = s.edgeTo[e];
        const bx = this.pos[2 * to], bz = this.pos[2 * to + 1];
        const by = this.heightAt(bx, bz) + 1.0;
        const tier = s.edgeTier[e];
        const col = TIER_COLORS[tier];
        const oneWay = back[to] !== tier;
        const lines = 1 + Math.round(Math.min(100, s.edgeStrain[e]) / 100 * 5);   // 1..6
        const dir = new Vector3(bx - ax, 0, bz - az);
        const len = dir.length();
        if (len < 0.01) continue;
        dir.normalize();
        const side = new Vector3().crossVectors(dir, up).normalize();
        const pa = oneWay ? dashPos : solidPos, ca = oneWay ? dashCol : solidCol;
        let n = oneWay ? nd : ns;
        const push = (x1: number, y1: number, z1: number, x2: number, y2: number, z2: number) => {
          pa.setXYZ(n, x1, y1, z1); ca.setXYZ(n, col.r, col.g, col.b); n++;
          pa.setXYZ(n, x2, y2, z2); ca.setXYZ(n, col.r, col.g, col.b); n++;
        };
        for (let l = 0; l < lines; l++) {
          const o = (l - (lines - 1) / 2) * 0.05;
          push(ax + side.x * o, ay, az + side.z * o, bx + side.x * o, by, bz + side.z * o);
        }
        // 箭头：在终点前 0.9m 处画两条短斜线
        const tip = new Vector3(bx - dir.x * 0.75, by, bz - dir.z * 0.75);
        for (const sgn of [1, -1]) push(tip.x, tip.y, tip.z, tip.x - dir.x * 0.5 + side.x * 0.3 * sgn, tip.y, tip.z - dir.z * 0.5 + side.z * 0.3 * sgn);
        if (oneWay) nd = n; else ns = n;
      }
    }
    this.edgesSolid.geometry.setDrawRange(0, ns);
    this.edgesDashed.geometry.setDrawRange(0, nd);
    solidPos.needsUpdate = solidCol.needsUpdate = dashPos.needsUpdate = dashCol.needsUpdate = true;
    if (nd) this.edgesDashed.computeLineDistances();
  }

  /** 头顶图标：情绪 1 个 + 最紧急的需求 1 个（仅低于警戒线时显示，颜色按缺口黄→橙→红） */
  warn = { satiety: 40, hydration: 35, rest: 30, warmth: 45, health: 60 };
  private applyIcons(s: Snapshot) {
    let n = 0;
    const m = new Matrix4();
    for (let i = 0; i < s.count; i++) {
      if (!s.alive[i]) continue;
      const x = this.pos[2 * i], z = this.pos[2 * i + 1];
      const y = this.heightAt(x, z) + 2.0;
      // 情绪（Normal 不画，减少噪声）
      if (s.feeling[i] !== 0) {
        m.makeTranslation(x - 0.35, y, z);
        this.icons.setMatrixAt(n, m);
        this.setIconCell(n, atlasFeeling(s.feeling[i]));
        n++;
      }
      // 需求：取缺口比例最大的一项
      const vals = [s.satiety[i], s.hydration[i], s.rest[i], s.warmth[i], s.health[i]];
      const warns = [this.warn.satiety, this.warn.hydration, this.warn.rest, this.warn.warmth, this.warn.health];
      let best = -1, gap = 0;
      for (let k = 0; k < 5; k++) {
        if (vals[k] >= warns[k]) continue;
        const g = 1 - vals[k] / warns[k];
        if (g > gap) { gap = g; best = k; }
      }
      if (best >= 0) {
        m.makeTranslation(x + 0.35, y, z);
        this.icons.setMatrixAt(n, m);
        this.setIconCell(n, atlasNeed(best, gap > 0.66 ? 2 : gap > 0.33 ? 1 : 0));
        n++;
      }
    }
    this.icons.count = n;
    this.icons.instanceMatrix.needsUpdate = true;
    this.iconUv.needsUpdate = true;
  }

  private setIconCell(i: number, cell: number) {
    const cx = cell % ATLAS_COLS, cy = Math.floor(cell / ATLAS_COLS);
    // 纹理 v 轴向上：第 0 行在图集顶部
    this.iconUv.setXY(i, cx / ATLAS_COLS, 1 - (cy + 1) / ATLAS_ROWS);
  }

  /** 屏幕坐标（像素）——给 HTML 名牌/弹层定位用 */
  toScreen(x: number, y: number, z: number) {
    const v = new Vector3(x, y, z).project(this.camera);
    return { x: (v.x + 1) / 2 * this.canvas.clientWidth, y: (1 - v.y) / 2 * this.canvas.clientHeight, behind: v.z > 1 };
  }
}
