import Zdog, { type Anchor, type Illustration, type Shape } from "zdog"

/**
 * 首页主视觉的 Zdog 伪 3D 模型：Q 版初音（参考毛绒玩偶的比例）
 *
 * 造型要点：大头、短身、青绿双马尾、粉红耳机饰条、深色耳机壳、
 * 蓝色蝴蝶结、白色带青色花边的裙子、金色徽章。
 * Zdog 是伪 3D（平面形状在 3D 空间排序绘制），所以是几何化剪影，不是还原照片。
 *
 * 设计画布 240×240 单位，原点在中心，y 轴向下。
 */

/**
 * 模型整体倾角：构建时施加，billboard 反向旋转时要减掉。
 *
 * y 保持 0：之前给了 0.32（约 18°）的固定 3/4 侧倾，结果鼠标跟随绕 0 摆动，
 * 往右能转到 47°、往左只到 -10°，左右明显不对称。
 * 现在静止时正对镜头，跟随/拖拽绕 0 对称摆动，3/4 视角由跟随自然带出来。
 */
const MODEL_TILT = { x: -0.04, y: 0 }

/** 拖拽上限（弧度）：左右约 ±34°、俯仰约 ±11° */
const MAX_DRAG_Y = 0.55
const MAX_DRAG_X = 0.19

/** 鼠标跟随叠加后总旋转的上限 */
const MAX_TOTAL_Y = 0.55
const MAX_TOTAL_X = 0.3

/** 鼠标跟随的最大偏移量（弧度） */
const HOVER_Y = 0.5
const HOVER_X = 0.28

/** 脸在正面 ±70° 内可见，超出就当作转到了背面 */
const FACE_VISIBLE_LIMIT = (Math.PI * 70) / 180

/**
 * 设计画布边长（Zdog 单位）。
 *
 * 画布可见范围是 ±DESIGN_SIZE/2。模型纵向从耳尖约 -131 到脚底约 +102，
 * 所以取 300（±150）才留得下帽子耳朵与底部光环。
 */
const DESIGN_SIZE = 300

const C = {
  hairDeep: "#0f766e",
  hairSide: "#0d9488",
  hairMid: "#14b8a6",
  hairLight: "#5eead4",
  skin: "#fbe3d4",
  skinShade: "#f3cdb8",
  dark: "#3f3f46",
  darkSoft: "#52525b",
  pink: "#f472b6",
  mouth: "#f08d9e",
  navy: "#1e3a8a",
  dressSide: "#dbe4ee",
  navyLight: "#2b4a9e",
  hat: "#f4f0e6",
  hatShade: "#e4ddcc",
  white: "#f8fafc",
  gold: "#fbbf24",
  ring: "rgba(110, 231, 183, 0.5)",
  dustCool: "#bfdbfe",
  dustWarm: "#fde68a",
} as const

export interface HeroModelOptions {
  /** 是否自动自旋；`prefers-reduced-motion` 时应传 false */
  spin?: boolean
}

export interface HeroModelHandle {
  /** 是否真的建成了可渲染的实例；false 时页面应保留静态兜底 */
  readonly active: boolean
  destroy(): void
  setPaused(paused: boolean): void
  renderOnce(): void
}

type Point = { x: number; y: number; z?: number }

/** 圆弧采样，用来画嘴巴/花边之类的曲线 */
function arcPath(radius: number, from: number, to: number, steps = 10): Point[] {
  const path: Point[] = []
  for (let i = 0; i <= steps; i++) {
    const angle = from + ((to - from) * i) / steps
    path.push({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius })
  }
  return path
}

function seededRandom(seed: number): () => number {
  let value = seed
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296
    return value / 4294967296
  }
}

/**
 * 把平面轮廓挤成棱柱：前后两个面 + 沿轮廓的侧面四边形。
 *
 * 这是 Zdog 里做"真体积"的通用手法 —— 只有平面形状的话，转到侧面会退化成一张纸；
 * 补上侧面后，侧视得到的是连续的面。
 */
function buildPrism(
  parent: Anchor,
  outline: Point[],
  zBack: number,
  zFront: number,
  faces: { front: string; back: string; side: string },
): void {
  // 侧面：每条轮廓边拉出一个四边形
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i]
    const b = outline[(i + 1) % outline.length]
    new Zdog.Shape({
      addTo: parent,
      path: [
        { x: a.x, y: a.y, z: zBack },
        { x: b.x, y: b.y, z: zBack },
        { x: b.x, y: b.y, z: zFront },
        { x: a.x, y: a.y, z: zFront },
      ],
      closed: true,
      fill: true,
      stroke: 0.5,
      color: faces.side,
    })
  }

  // 前后面
  new Zdog.Shape({
    addTo: parent,
    path: outline.map((point) => ({ x: point.x, y: point.y, z: zFront })),
    closed: true,
    fill: true,
    stroke: 1.5,
    color: faces.front,
  })
  new Zdog.Shape({
    addTo: parent,
    path: outline.map((point) => ({ x: point.x, y: point.y, z: zBack })),
    closed: true,
    fill: true,
    stroke: 1.5,
    color: faces.back,
  })
}

/** 双马尾：挤出成棱柱（深 42），侧视是连续的面而不是几条线 */
function buildTwintail(parent: Anchor, sign: number): void {
  // 外轮廓：从耳侧向下垂落，末端收细
  const outline: Point[] = [
    { x: 8, y: -14 },
    { x: 44, y: 4 },
    { x: 56, y: 52 },
    { x: 48, y: 104 },
    { x: 30, y: 140 },
    { x: 20, y: 118 },
    { x: 26, y: 66 },
    { x: 14, y: 8 },
  ].map((point) => ({ x: point.x * sign, y: point.y }))

  buildPrism(parent, outline, -34, 0, {
    front: C.hairMid,
    back: C.hairDeep,
    // 侧面压暗一档，转角处才有明暗交界
    side: C.hairSide,
  })
}
/**
 * 头部：直接用一个球
 *
 * Zdog 里"球"的画法是零长度路径 + 大描边（round cap），任何角度都是正圆，
 * 比原来的圆柱叠片干净得多，也不会在顶部露出前一层圆柱的边。
 */
function buildHead(head: Anchor, face: Anchor): void {
  const R = 56 // 头球半径
  // 脸片必须排在裙身正面（z=26）之前，否则会露出"裙子压住下巴"的效果。
  // 球是"点"（round cap），投影恒为 112 正圆，贴片放在 z=34 也不会凸出轮廓。
  const FACE_Z = 34

  // 头：球（跟着模型一起转 —— 球是各向同性的，转不转看不出来）
  new Zdog.Shape({
    addTo: head,
    stroke: R * 2,
    color: C.hairMid,
  })

  // 脸：贴在正面的皮肤色圆。挂在 face 锚点上，由渲染循环反向旋转抵消父级旋转
  new Zdog.Ellipse({
    addTo: face,
    diameter: 94,
    translate: { y: 6, z: FACE_Z },
    color: C.skin,
    fill: true,
    stroke: 0,
  })

  // 刘海：外缘走与头球同心的圆弧（这样不会和球形成一道直缝），
  // 内缘是三个尖角
  const capRadius = 52
  const crown = arcPath(capRadius, Math.PI, Math.PI * 2, 18)
  const fringe = [
    { x: 47, y: -16 },
    { x: 30, y: 6 },
    { x: 14, y: -16 },
    { x: 0, y: 10 },
    { x: -14, y: -16 },
    { x: -30, y: 6 },
    { x: -47, y: -16 },
  ]
  new Zdog.Shape({
    addTo: face,
    path: [...crown, ...fringe],
    closed: true,
    fill: true,
    stroke: 0,
    color: C.hairMid,
    translate: { z: FACE_Z + 1 },
  })

  // 五官
  const FEATURE_Z = FACE_Z + 3
  for (const sign of [-1, 1] as const) {
    new Zdog.Ellipse({
      addTo: face,
      diameter: 26,
      translate: { x: 24 * sign, y: 12, z: FEATURE_Z },
      color: C.dark,
      fill: true,
      stroke: 1,
    })
    new Zdog.Ellipse({
      addTo: face,
      diameter: 9,
      translate: { x: 28 * sign, y: 6, z: FEATURE_Z + 1 },
      color: C.white,
      fill: true,
      stroke: 0,
    })
    new Zdog.Ellipse({
      addTo: face,
      diameter: 13,
      translate: { x: 41 * sign, y: 26, z: FEATURE_Z - 1 },
      color: C.pink,
      fill: true,
      stroke: 0,
    })
  }

  // 嘴：两个小弧拼成的 ω（猫嘴）。比一整条大弧线收敛得多，
  // 半径小、线细、颜色偏粉，不会显得"咧到耳根"。
  const mouthHalf = 5.5
  for (const sign of [-1, 1] as const) {
    new Zdog.Shape({
      addTo: face,
      path: arcPath(mouthHalf, 0, Math.PI, 9).map((point) => ({
        x: point.x + mouthHalf * sign,
        y: point.y,
      })),
      closed: false,
      stroke: 3.4,
      color: C.mouth,
      translate: { y: 26, z: FEATURE_Z },
    })
  }
  /* ---------- 毛线帽：奶白色帽身 + 卷边 + 两根兔耳 ---------- */

  const HAT_BOTTOM = -13 // 帽口高度：压在额头上，但要留出眼睛和一点刘海

  // 帽身：上半圆填充，底边压平
  const dome = arcPath(60, Math.PI, Math.PI * 2, 20).map((point) => ({
    x: point.x,
    y: point.y + HAT_BOTTOM,
  }))
  new Zdog.Shape({
    addTo: face,
    path: dome,
    closed: true,
    fill: true,
    stroke: 0,
    color: C.hat,
    translate: { z: 36 },
  })

  // 卷边：一条粗横线，两端圆头
  new Zdog.Shape({
    addTo: face,
    path: [
      { x: -54, y: HAT_BOTTOM },
      { x: 54, y: HAT_BOTTOM },
    ],
    closed: false,
    stroke: 17,
    color: C.hatShade,
    translate: { z: 37 },
  })

  // 兔耳：两根竖直的胶囊，稍向外张
  for (const sign of [-1, 1] as const) {
    new Zdog.Shape({
      addTo: face,
      path: [
        { x: 14 * sign, y: HAT_BOTTOM - 30 },
        { x: 19 * sign, y: HAT_BOTTOM - 66 },
      ],
      closed: false,
      stroke: 25,
      color: C.hat,
      translate: { z: 30 },
    })
  }
  // 耳机：方块，贴在球的两侧
  for (const sign of [-1, 1] as const) {
    new Zdog.Box({
      addTo: head,
      width: 15,
      height: 50,
      depth: 20,
      translate: { x: 63 * sign, y: 10, z: -6 },
      color: C.dark,
      frontFace: C.darkSoft,
      rearFace: C.dark,
      leftFace: C.dark,
      rightFace: C.dark,
      topFace: C.darkSoft,
      bottomFace: C.dark,
      stroke: 1,
    })
    new Zdog.RoundedRect({
      addTo: head,
      width: 20,
      height: 11,
      cornerRadius: 6,
      translate: { x: 63 * sign, y: -4, z: 5 },
      color: C.pink,
      fill: true,
      stroke: 0,
    })
  }
}
/**
 * 身体：按轮廓挤出的裙身 + 若干锚点做塑形
 *
 * 不用方块：块状体只有四个直角面，肩线和裙摆都是硬的。
 * 这里用 `buildPrism` 把一条"肩 → 收腰 → 裙摆外扩 → 下摆微垂"的轮廓挤出厚度，
 * 再用肩头、领口、袖口、裙边这些锚点去圆掉棱角。
 */
function buildBody(parent: Anchor): void {
  const DEPTH = 52
  const BACK = -DEPTH / 2
  const FRONT = DEPTH / 2

  // 裙身轮廓（正面看的样子，逆时针一圈）
  const torso: Point[] = [
    { x: -26, y: -42 },
    { x: -30, y: -16 },
    { x: -34, y: 6 },
    { x: -50, y: 34 },
    { x: -26, y: 44 },
    { x: 0, y: 47 },
    { x: 26, y: 44 },
    { x: 50, y: 34 },
    { x: 34, y: 6 },
    { x: 30, y: -16 },
    { x: 26, y: -42 },
  ]

  buildPrism(parent, torso, BACK, FRONT, {
    front: C.white,
    back: C.navy,
    // 侧面用浅灰蓝：白裙的转折有明暗，但不会像藏青那样被误读成另一件东西
    side: C.dressSide,
  })

  // 背面：贴一块浅色面板 + 一道腰线 + 小蝴蝶结。
  // 注意 z 要比 `back` 更负一层，否则会被背面本身挡住。
  new Zdog.Shape({
    addTo: parent,
    path: torso.map((point) => ({ x: point.x * 0.76, y: point.y * 0.8 })),
    closed: true,
    fill: true,
    stroke: 0,
    color: C.navyLight,
    translate: { z: BACK - 1 },
  })
  new Zdog.Shape({
    addTo: parent,
    path: [
      { x: -24, y: 6 },
      { x: 24, y: 6 },
    ],
    closed: false,
    stroke: 4,
    color: C.hairDeep,
    translate: { z: BACK - 2 },
  })
  for (const sign of [-1, 1] as const) {
    new Zdog.Shape({
      addTo: parent,
      path: [
        { x: 0, y: 0 },
        { x: 15 * sign, y: -7 },
        { x: 15 * sign, y: 7 },
      ],
      closed: true,
      fill: true,
      stroke: 0,
      color: C.navy,
      translate: { y: 6, z: BACK - 3 },
    })
  }

  // 肩头：两枚圆点把棱柱的肩角圆掉
  for (const sign of [-1, 1] as const) {
    new Zdog.Shape({
      addTo: parent,
      translate: { x: 26 * sign, y: -42, z: 0 },
      stroke: 16,
      color: C.navy,
    })
  }

  // 领口：青色三角
  new Zdog.Shape({
    addTo: parent,
    path: [
      { x: -14, y: -28 },
      { x: 14, y: -28 },
      { x: 0, y: -12 },
    ],
    closed: true,
    fill: true,
    stroke: 0,
    color: C.hairMid,
    translate: { z: FRONT + 1 },
  })

  // 裙摆花边：沿下摆排一排小圆点
  for (let i = -3; i <= 3; i++) {
    const x = i * 11
    // 跟着下摆的弧线走，中间略低
    const y = 39 - Math.abs(i) * 0.4
    new Zdog.Ellipse({
      addTo: parent,
      diameter: 9,
      translate: { x, y, z: FRONT + 1 },
      color: C.hairMid,
      fill: true,
      stroke: 0,
    })
  }

  // 腰部收束：一条稍暗的横带
  new Zdog.Shape({
    addTo: parent,
    path: [
      { x: -33, y: 6 },
      { x: 33, y: 6 },
    ],
    closed: false,
    stroke: 5,
    color: C.hairDeep,
    translate: { z: FRONT + 0.5 },
  })

  // 蓝色蝴蝶结
  for (const sign of [-1, 1] as const) {
    new Zdog.Shape({
      addTo: parent,
      path: [
        { x: 0, y: 0 },
        { x: 26 * sign, y: -11 },
        { x: 26 * sign, y: 11 },
      ],
      closed: true,
      fill: true,
      stroke: 1,
      color: C.navy,
      translate: { y: 4, z: FRONT + 5 },
    })
  }
  new Zdog.Ellipse({
    addTo: parent,
    diameter: 13,
    translate: { y: 4, z: FRONT + 6 },
    color: C.navy,
    fill: true,
    stroke: 0,
  })

  // 金色徽章
  new Zdog.Ellipse({
    addTo: parent,
    diameter: 15,
    translate: { y: 30, z: FRONT + 5 },
    color: C.gold,
    fill: true,
    stroke: 1,
  })

  // 手臂：胶囊轮廓挤出，肩头那枚圆点盖住接缝
  for (const sign of [-1, 1] as const) {
    const arm: Point[] = [
      { x: -9, y: -22 },
      { x: -10, y: -6 },
      { x: -9, y: 14 },
      { x: 0, y: 22 },
      { x: 9, y: 14 },
      { x: 10, y: -6 },
      { x: 9, y: -22 },
      { x: 0, y: -25 },
    ].map((point) => ({ x: point.x * sign + 40 * sign, y: point.y - 20 }))

    buildPrism(parent, arm, -10, 10, {
      front: C.skin,
      back: C.skinShade,
      side: C.skinShade,
    })

    // 袖口
    new Zdog.Shape({
      addTo: parent,
      translate: { x: 42 * sign, y: -2, z: 2 },
      stroke: 22,
      color: C.darkSoft,
    })
  }

  // 脚：有厚度的圆盘
  for (const sign of [-1, 1] as const) {
    new Zdog.Cylinder({
      addTo: parent,
      diameter: 26,
      length: 30,
      translate: { x: 22 * sign, y: 54, z: 6 },
      color: C.hairMid,
      frontFace: C.hairLight,
      backface: C.hairDeep,
      stroke: 1,
    })
  }
}

/** 星尘：固定种子，保证每次分布一致 */
function buildDust(parent: Anchor): Anchor {
  const anchor = new Zdog.Anchor({ addTo: parent })
  const random = seededRandom(20261118)

  for (let i = 0; i < 24; i++) {
    const radius = 66 + random() * 62
    const angle = random() * Math.PI * 2
    new Zdog.Shape({
      addTo: anchor,
      translate: {
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius * 0.8,
        z: (random() - 0.5) * 80,
      },
      stroke: 1.8 + random() * 2.6,
      color: random() > 0.78 ? C.dustWarm : C.dustCool,
    })
  }

  return anchor
}

/**
 * 把整个模型挂到给定 illustration 上。
 *
 * 抽出来是为了能让 canvas 与 SVG 两条渲染路径共用同一份场景
 * （构建期预览、回归检查都靠它）。
 */
export function buildScene(root: Illustration): { dust: Anchor; face: Anchor } {
  // 默认朝向略带 3/4 侧（约 18°）：一眼就能看出厚度，而不是正对镜头的平面画
  const model = new Zdog.Anchor({ addTo: root, rotate: { ...MODEL_TILT } })

  // 双马尾在头后面，先建
  for (const sign of [-1, 1] as const) {
    const tail = new Zdog.Anchor({
      addTo: model,
      // 挂在头两侧（x 贴着头缘）、只略微靠后，这样侧视是"头边的马尾"而不是"脑后的板子"
      translate: { x: 54 * sign, y: -44, z: -12 },
    })
    buildTwintail(tail, sign)
  }

  const head = new Zdog.Anchor({ addTo: model, translate: { y: -46 } })
  // 脸（含刘海、五官）挂在这个锚点上：渲染时把父级旋转反向抵消，
  // 于是无论模型转到什么角度，脸都正对镜头
  const face = new Zdog.Anchor({ addTo: head })
  buildHead(head, face)

  const body = new Zdog.Anchor({ addTo: model, translate: { y: 33 } })
  buildBody(body)

  // 地面光环
  new Zdog.Ellipse({
    addTo: model,
    diameter: 200,
    translate: { y: 108 },
    rotate: { x: Math.PI / 2 },
    stroke: 1.5,
    color: C.ring,
  })

  const dust = buildDust(model)
  return { dust, face }
}

/**
 * 让脸正对镜头（billboard）。
 *
 * 不能简单地把父级角度取负相加：Zdog 的每个锚点是按 `Rx·Ry·Rz` 顺序逐轴施加旋转的，
 * 两个轴同时不为零时，"角度相加"得不到单位旋转，残留的倾斜会把脸片从球体上掀起来
 * （俯仰 8° 就已经能看出脸被拉长）。
 *
 * 这里改为精确做法：把 illustration 与 model 两级的旋转矩阵乘起来，
 * 取逆（正交矩阵即转置），再分解回 Zdog 使用的 XYZ 欧拉角，赋给 face 锚点。
 */

type Mat3 = [[number, number, number], [number, number, number], [number, number, number]]

function rotX(angle: number): Mat3 {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return [
    [1, 0, 0],
    [0, c, -s],
    [0, s, c],
  ]
}

function rotY(angle: number): Mat3 {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return [
    [c, 0, s],
    [0, 1, 0],
    [-s, 0, c],
  ]
}

function mulMat(a: Mat3, b: Mat3): Mat3 {
  const out = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ] as Mat3
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      out[i][j] = a[i][0] * b[0][j] + a[i][1] * b[1][j] + a[i][2] * b[2][j]
    }
  }
  return out
}

function transpose(m: Mat3): Mat3 {
  return [
    [m[0][0], m[1][0], m[2][0]],
    [m[0][1], m[1][1], m[2][1]],
    [m[0][2], m[1][2], m[2][2]],
  ]
}

export function updateBillboard(illustration: Illustration, face: Anchor): void {
  const { x, y } = illustration.rotate

  // 顶点实际被按「先 illustration，再 model」的顺序旋转，
  // 所以累积矩阵是 model · illustration，取逆得 illustrationᵀ · modelᵀ
  const total = mulMat(
    mulMat(rotX(MODEL_TILT.x), rotY(MODEL_TILT.y)),
    mulMat(rotX(x), rotY(y)),
  )
  // 正交矩阵的逆就是转置
  const inv = transpose(total)

  // 分解回 Zdog 的 XYZ 顺序：R = Rx(a)·Ry(b)·Rz(c)
  const beta = Math.asin(Math.max(-1, Math.min(1, inv[0][2])))
  const alpha = Math.atan2(-inv[1][2], inv[2][2])
  const gamma = Math.atan2(-inv[0][1], inv[0][0])

  face.rotate.x = alpha
  face.rotate.y = beta
  face.rotate.z = gamma

  // 脸是"永远朝镜头"的贴片，转到背面时必须整组藏起来，
  // 否则从后脑勺还能看到一张正脸。Zdog 的 visible 不会继承，
  // 所以要逐个设到 face 的每个子形状上。
  const facing = Math.atan2(Math.sin(y + MODEL_TILT.y), Math.cos(y + MODEL_TILT.y))
  const show = Math.abs(facing) <= FACE_VISIBLE_LIMIT
  face.visible = show
  for (const child of face.children) {
    ;(child as Shape).visible = show
  }
}
/**
 * 在 canvas 上创建可交互模型。
 *
 * 顶层不访问 `document`，只在调用时触碰 DOM，服务端构建期可以安全导入。
 */
export function createHeroModel(
  canvas: HTMLCanvasElement,
  options: HeroModelOptions = {},
): HeroModelHandle {
  // 默认静态：首页模型不自转，只在用户拖拽时按需重绘
  const spin = options.spin ?? false

  const noop: HeroModelHandle = {
    active: false,
    destroy: () => {},
    setPaused: () => {},
    renderOnce: () => {},
  }

  let dragging = false
  let paused = false
  let destroyed = false
  let frame = 0

  let illustration: Illustration
  try {
    const context = canvas.getContext("2d")
    if (!context) return noop

    // 拖拽自己接管：Zdog 内置的 dragRotate 不设上限，转过 45° 近侧马尾会压住脸、
    // 整个人形也散开。这里只允许小幅摆动，够看出立体感即可。
    illustration = new Zdog.Illustration({
      element: canvas,
      dragRotate: false,
      resize: false,
    })
  } catch {
    return noop
  }

  const { dust, face } = buildScene(illustration)

  /* ---------- 姿态：拖拽（带限位）+ 鼠标跟随 ---------- */

  let pointerId: number | null = null
  let startX = 0
  let startY = 0
  /** 拖拽累积的姿态 */
  let baseY = 0
  let baseX = 0
  let dragStartY = 0
  let dragStartX = 0

  /** 鼠标跟随的当前值与目标值（用缓动逼近，避免跟手时抖） */
  let followY = 0
  let followX = 0
  let targetY = 0
  let targetX = 0
  let hovering = false

  const clamp = (value: number, limit: number): number =>
    Math.max(-limit, Math.min(limit, value))

  const applyPose = (): void => {
    illustration.rotate.y = clamp(baseY + followY, MAX_TOTAL_Y)
    illustration.rotate.x = clamp(baseX + followX, MAX_TOTAL_X)
  }

  const endDrag = (): void => {
    if (pointerId === null) return
    pointerId = null
    dragging = false
    // 松手后若鼠标还在元素上，跟随重新接管
    if (!hovering) {
      targetY = 0
      targetX = 0
    }
  }

  const onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 && event.pointerType === "mouse") return
    pointerId = event.pointerId
    startX = event.clientX
    startY = event.clientY
    dragStartY = baseY
    dragStartX = baseX
    // 开始拖拽时把跟随量收掉，避免和拖拽叠加
    followY = 0
    followX = 0
    targetY = 0
    targetX = 0
    dragging = true
    canvas.setPointerCapture?.(event.pointerId)
    if (!spin) startLoop()
  }

  const onPointerMove = (event: PointerEvent): void => {
    const host = canvas.parentElement ?? canvas
    const rect = host.getBoundingClientRect()
    const size = rect.width || DESIGN_SIZE

    if (pointerId !== null && event.pointerId === pointerId) {
      // 拖拽：整幅宽度约转 0.9 弧度，再夹到上限。
      // 取负号 —— 让"往右拖，模型的正面往右转"，与直觉一致
      const ratio = 0.9 / size
      baseY = clamp(dragStartY - (event.clientX - startX) * ratio, MAX_DRAG_Y)
      baseX = clamp(dragStartX - (event.clientY - startY) * ratio * 0.5, MAX_DRAG_X)
      if (!spin) startLoop()
      return
    }

    // 悬停跟随：以模型中心为原点，但按"到视口边缘"的范围归一化，
    // 这样鼠标在页面任何位置都会持续带动模型，而不是走到画布外面就停住
    const centerX = rect.left + size / 2
    const centerY = rect.top + size / 2
    const halfW = Math.max(size / 2, window.innerWidth * 0.42)
    const halfH = Math.max(size / 2, window.innerHeight * 0.42)

    // 取负号与拖拽保持同一套方向约定：鼠标偏左 → 模型朝左看
    targetY = clamp(-(event.clientX - centerX) / halfW, 1) * HOVER_Y
    // 竖直方向保持正号：鼠标偏下 → 模型向下俯视
    targetX = clamp((event.clientY - centerY) / halfH, 1) * HOVER_X
    hovering = true
    if (!spin) startLoop()
  }

  canvas.addEventListener("pointerdown", onPointerDown)
  window.addEventListener("pointermove", onPointerMove, { passive: true })
  canvas.addEventListener("pointerup", endDrag)
  canvas.addEventListener("pointercancel", endDrag)
  canvas.addEventListener("lostpointercapture", endDrag)
  /**
   * 设置画布尺寸。
   *
   * Zdog 内部自己处理 devicePixelRatio（`setSize` 收 CSS 像素，内部把 backing store
   * 乘上 pixelRatio，渲染时再 `ctx.scale(pixelRatio × zoom)`），所以这里传 CSS 尺寸，
   * 多乘一次会得到 4 倍画布。
   *
   * 尺寸优先取 getBoundingClientRect（布局阶段比 clientWidth 更可靠），
   * 全为 0 时退回设计尺寸，避免画布塌成 0。
   */
  const resize = (): void => {
    const host = canvas.parentElement ?? canvas
    const rect = host.getBoundingClientRect()
    const size = Math.round(rect.width || host.clientWidth || DESIGN_SIZE) || DESIGN_SIZE

    illustration.setSize(size, size)
    illustration.zoom = size / DESIGN_SIZE
  }

  /**
   * 让脸正对镜头（billboard）。
   *
   * face 是 head 的子锚点，会继承 illustration 与 model 的旋转；
   * 这里把这两级的旋转反着设回去，累加后约等于单位旋转，
   * 脸片就始终朝向镜头，不会随模型转动而滑到一侧。
   * 两级都只有 x/y 旋转且 x 很小，用角度相加近似已经足够。
   */
  const render = (): void => {
    updateBillboard(illustration, face)
    illustration.updateRenderGraph()
  }

  const startLoop = (): void => {
    if (frame || destroyed) return
    frame = requestAnimationFrame(tick)
  }

  const stopLoop = (): void => {
    if (!frame) return
    cancelAnimationFrame(frame)
    frame = 0
  }

  const tick = (): void => {
    if (destroyed) return
    if (paused) {
      frame = 0
      return
    }
    frame = requestAnimationFrame(tick)

    if (spin) {
      illustration.rotate.y += 0.004
      dust.rotate.y -= 0.0016
      render()
      return
    }

    // 平滑逼近跟随目标
    followY += (targetY - followY) * 0.14
    followX += (targetX - followX) * 0.14
    applyPose()
    render()

    // 跟随量已经追上目标（鼠标停下）→ 收工，省掉常驻 rAF
    const settled =
      !dragging &&
      Math.abs(targetY - followY) < 0.0015 &&
      Math.abs(targetX - followX) < 0.0015
    if (settled) {
      followY = targetY
      followX = targetX
      applyPose()
      render()
      stopLoop()
    }
  }

  const observer =
    typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(() => {
          resize()
          render()
        })
      : null
  observer?.observe(canvas.parentElement ?? canvas)

  window.addEventListener("resize", resize)

  // 首次尺寸等一帧再量：DOMContentLoaded 时字体/网格可能还没定稿
  resize()
  render()
  requestAnimationFrame(() => {
    if (destroyed) return
    resize()
    render()
  })

  if (spin) startLoop()

  return {
    active: true,
    destroy() {
      destroyed = true
      stopLoop()
      canvas.removeEventListener("pointerdown", onPointerDown)
      window.removeEventListener("pointermove", onPointerMove)
      canvas.removeEventListener("pointerup", endDrag)
      canvas.removeEventListener("pointercancel", endDrag)
      canvas.removeEventListener("lostpointercapture", endDrag)
        observer?.disconnect()
      window.removeEventListener("resize", resize)
    },
    setPaused(next: boolean) {
      paused = next
      if (next) {
        if (!spin) stopLoop()
      } else {
        render()
        if (spin) startLoop()
      }
    },
    renderOnce() {
      resize()
      render()
    },
  }
}
