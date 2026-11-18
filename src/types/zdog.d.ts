/**
 * zdog 没有自带类型声明（包里只有 UMD 构建），这里按项目实际用到的 API 做最小声明，
 * 避免为一个渲染库引入大而全的第三方类型包。
 *
 * 坐标系：x 向右、y 向下、z 朝向观察者。
 */

declare module "zdog" {
  export interface Vector {
    x: number
    y: number
    z: number
  }

  export interface AnchorOptions {
    /** 挂到哪个父级下 */
    addTo?: Anchor
    translate?: Partial<Vector>
    rotate?: Partial<Vector>
    scale?: number | Partial<Vector>
    visible?: boolean
  }

  export class Anchor {
    constructor(options?: AnchorOptions)
    translate: Vector
    rotate: Vector
    scale: Vector
    /** 单个元素的可见性；Zdog 不会把不可见向下继承，需要逐层设置 */
    visible: boolean
    /** 直接子元素 */
    children: Anchor[]
    addChild(child: Anchor): void
    removeChild(child: Anchor): void
    remove(): void
  }

  /** 自定义路径上的一个点；`move: true` 表示从这里断笔 */
  export interface PathPoint extends Partial<Vector> {
    move?: boolean
  }

  export interface ShapeOptions extends AnchorOptions {
    path?: PathPoint[] | false
    /** 描边粗细；false 表示不描边 */
    stroke?: number | boolean
    color?: string
    fill?: boolean
    closed?: boolean
    front?: string
    back?: string
  }

  export class Shape extends Anchor {
    constructor(options?: ShapeOptions)
  }

  export interface EllipseOptions extends ShapeOptions {
    diameter?: number
    width?: number
    height?: number
  }

  export class Ellipse extends Shape {
    constructor(options?: EllipseOptions)
    diameter: number
    width: number
    height: number
  }

  export interface RoundedRectOptions extends ShapeOptions {
    width?: number
    height?: number
    cornerRadius?: number
  }

  export class RoundedRect extends Shape {
    constructor(options?: RoundedRectOptions)
  }

  export interface BoxOptions extends ShapeOptions {
    width?: number
    height?: number
    depth?: number
    frontFace?: string
    rearFace?: string
    leftFace?: string
    rightFace?: string
    topFace?: string
    bottomFace?: string
  }

  /** 真立体方块：侧视时有实际的面 */
  export class Box extends Shape {
    constructor(options?: BoxOptions)
  }

  export interface CylinderOptions extends ShapeOptions {
    diameter?: number
    /** 沿 z 轴的厚度 */
    length?: number
    frontFace?: string
    backface?: string
  }

  /** 真立体圆柱（圆盘）：侧视时能看到侧面 */
  export class Cylinder extends Shape {
    constructor(options?: CylinderOptions)
  }

  export interface PolygonOptions extends ShapeOptions {
    radius?: number
    sides?: number
  }

  export class Polygon extends Shape {
    constructor(options?: PolygonOptions)
  }

  export class Hemisphere extends Ellipse {
    constructor(options?: EllipseOptions)
  }

  export interface IllustrationOptions extends AnchorOptions {
    /** canvas / svg 元素或其选择器 */
    element?: string | Element
    /** 是否随窗口缩放自动调整 */
    resize?: boolean | "fullscreen"
    /** 允许拖拽旋转 */
    dragRotate?: boolean
    onDragStart?: () => void
    onDragEnd?: () => void
    onPrerender?: () => void
    zoom?: number
  }

  export class Illustration extends Anchor {
    constructor(options?: IllustrationOptions)
    element: HTMLCanvasElement | Element
    zoom: number
    /** 按当前旋转重绘一帧 */
    updateRenderGraph(): void
    /** 设置画布尺寸（同时设置 canvas 的 width/height 属性） */
    setSize(width: number, height: number): void
  }

  const Zdog: {
    Anchor: typeof Anchor
    Shape: typeof Shape
    Ellipse: typeof Ellipse
    RoundedRect: typeof RoundedRect
    Polygon: typeof Polygon
    Hemisphere: typeof Hemisphere
    Box: typeof Box
    Cylinder: typeof Cylinder
    Illustration: typeof Illustration
  }

  export default Zdog
}
