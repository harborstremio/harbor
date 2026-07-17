import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import * as THREE from "three";
import { useSettings } from "@/lib/settings";

const POSTER_WIDTH = 2.6;
const POSTER_HEIGHT = 3.9;

type RenderTarget = {
  canvas: HTMLCanvasElement;
  posterSrc: string;
  opacity: number;
  rotationX: number;
  rotationY: number;
  onReady: () => void;
  onError: () => void;
};

function createRoundedRectShape(width: number, height: number, radius: number): THREE.Shape {
  const shape = new THREE.Shape();
  const x = -width / 2;
  const y = -height / 2;

  shape.moveTo(x, y + radius);
  shape.lineTo(x, y + height - radius);
  shape.quadraticCurveTo(x, y + height, x + radius, y + height);
  shape.lineTo(x + width - radius, y + height);
  shape.quadraticCurveTo(x + width, y + height, x + width, y + height - radius);
  shape.lineTo(x + width, y + radius);
  shape.quadraticCurveTo(x + width, y, x + width - radius, y);
  shape.lineTo(x + radius, y);
  shape.quadraticCurveTo(x, y, x, y + radius);

  return shape;
}

function createGlassFrameGeometry(
  width: number,
  height: number,
  depth: number,
  radius: number,
): THREE.ExtrudeGeometry {
  const shape = createRoundedRectShape(width, height, radius);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.04,
    bevelSegments: 6,
    curveSegments: 12,
  });

  geometry.center();

  return geometry;
}

function createEnvironmentTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");

  canvas.width = 16;
  canvas.height = 256;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Unable to create CineGlass environment.");
  }

  const gradient = context.createLinearGradient(0, 0, 0, canvas.height);

  /*
   * نفس البيئة الداكنة الموجودة في index.html.
   */
  gradient.addColorStop(0, "#000000");
  gradient.addColorStop(1, "#000000");

  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const texture = new THREE.CanvasTexture(canvas);

  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;

  return texture;
}

class SharedCineGlassPosterEngine {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly group: THREE.Group;

  private readonly glassGeometry: THREE.ExtrudeGeometry;
  private readonly glassMaterial: THREE.MeshPhysicalMaterial;
  private readonly glassFrame: THREE.Mesh<THREE.ExtrudeGeometry, THREE.MeshPhysicalMaterial>;

  private readonly posterGeometry: THREE.PlaneGeometry;
  private readonly posterMaterial: THREE.MeshBasicMaterial;
  private readonly posterMesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;

  private readonly shineGeometry: THREE.PlaneGeometry;
  private readonly shineMaterial: THREE.MeshPhysicalMaterial;
  private readonly shineMesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshPhysicalMaterial>;

  private readonly textureLoader: THREE.TextureLoader;
  private readonly textureCache = new Map<string, THREE.Texture>();
  private readonly pendingTextures = new Map<string, Promise<THREE.Texture>>();

  constructor() {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
      preserveDrawingBuffer: true,
    });

    this.renderer.setClearColor(0x000000, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);

    this.camera = new THREE.PerspectiveCamera(45, POSTER_WIDTH / POSTER_HEIGHT, 0.1, 200);

    /*
     * نفس الكاميرا في الملف المرجعي، لكن نقربها بما يناسب
     * مساحة بطاقة واحدة بدل مشهد الشاشة الكاملة.
     */
    this.camera.position.set(0, 0.08, 5.35);
    this.camera.lookAt(0, 0, 0);

    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);

    pmremGenerator.compileEquirectangularShader();

    const environmentSource = createEnvironmentTexture();

    this.scene.environment = pmremGenerator.fromEquirectangular(environmentSource).texture;

    environmentSource.dispose();
    pmremGenerator.dispose();

    /*
     * نفس الإضاءة الموجودة في index.html.
     */
    const sunLight = new THREE.DirectionalLight(0xffffff, 2.2);

    sunLight.position.set(6, 12, 8);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(1024, 1024);

    this.scene.add(sunLight);

    this.scene.add(new THREE.HemisphereLight(0x334455, 0x0a0a0a, 0.4));

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.55));

    this.group = new THREE.Group();
    this.scene.add(this.group);

    /*
     * نفس هندسة إطار القزاز في المرجع:
     * posterW + 0.3
     * posterH + 0.3
     * depth 0.2
     * radius 0.24
     */
    this.glassGeometry = createGlassFrameGeometry(
      POSTER_WIDTH + 0.3,
      POSTER_HEIGHT + 0.3,
      0.2,
      0.24,
    );

    /*
     * هذه القيم من index.html حرفيًا.
     */
    this.glassMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transmission: 0.95,
      thickness: 1.5,
      roughness: 0.05,
      metalness: 0,
      ior: 1.5,
      iridescence: 0.3,
      iridescenceIOR: 1.3,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
      envMapIntensity: 1.4,
      transparent: true,
      opacity: 0.5,
    });

    this.glassFrame = new THREE.Mesh(this.glassGeometry, this.glassMaterial);

    this.glassFrame.castShadow = true;
    this.glassFrame.position.z = -0.06;

    this.group.add(this.glassFrame);

    /*
     * البوستر نفسه Mesh داخل المشهد، مثل المرجع.
     */
    this.posterGeometry = new THREE.PlaneGeometry(POSTER_WIDTH, POSTER_HEIGHT);

    this.posterMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      toneMapped: false,
    });

    this.posterMesh = new THREE.Mesh(this.posterGeometry, this.posterMaterial);

    this.posterMesh.position.z = 0.12;

    this.group.add(this.posterMesh);

    /*
     * طبقة الزجاج الأمامية في المرجع.
     */
    this.shineGeometry = new THREE.PlaneGeometry(POSTER_WIDTH, POSTER_HEIGHT);

    this.shineMaterial = new THREE.MeshPhysicalMaterial({
      transmission: 1,
      roughness: 0.15,
      thickness: 0.3,
      ior: 1.4,
      transparent: true,
      opacity: 0.12,
      color: 0xffffff,
      envMapIntensity: 1,
      depthWrite: false,
    });

    this.shineMesh = new THREE.Mesh(this.shineGeometry, this.shineMaterial);

    this.shineMesh.position.z = 0.14;

    this.group.add(this.shineMesh);

    this.textureLoader = new THREE.TextureLoader();
    this.textureLoader.setCrossOrigin("anonymous");
  }

  async render(target: RenderTarget): Promise<void> {
    try {
      const texture = await this.loadTexture(target.posterSrc);

      const rectangle = target.canvas.getBoundingClientRect();

      const cssWidth = Math.max(1, Math.round(rectangle.width));

      const cssHeight = Math.max(1, Math.round(rectangle.height));

      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

      const width = Math.max(1, Math.round(cssWidth * pixelRatio));

      const height = Math.max(1, Math.round(cssHeight * pixelRatio));

      target.canvas.width = width;
      target.canvas.height = height;

      this.renderer.setPixelRatio(1);
      this.renderer.setSize(width, height, false);

      this.camera.aspect = cssWidth / cssHeight;
      this.camera.updateProjectionMatrix();

      this.group.rotation.x = target.rotationX;
      this.group.rotation.y = target.rotationY;

      this.glassMaterial.opacity = 0.5 * target.opacity;

      this.shineMaterial.opacity = 0.12 * target.opacity;

      this.posterMaterial.map = texture;
      this.posterMaterial.needsUpdate = true;

      this.renderer.render(this.scene, this.camera);

      const context = target.canvas.getContext("2d");

      if (!context) {
        target.onError();
        return;
      }

      context.clearRect(0, 0, width, height);

      context.drawImage(this.renderer.domElement, 0, 0, width, height);

      target.onReady();
    } catch {
      target.onError();
    }
  }

  private loadTexture(posterSrc: string): Promise<THREE.Texture> {
    const cached = this.textureCache.get(posterSrc);

    if (cached) {
      return Promise.resolve(cached);
    }

    const pending = this.pendingTextures.get(posterSrc);

    if (pending) {
      return pending;
    }

    const request = new Promise<THREE.Texture>((resolve, reject) => {
      this.textureLoader.load(
        posterSrc,
        (texture) => {
          texture.colorSpace = THREE.SRGBColorSpace;

          texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();

          texture.minFilter = THREE.LinearMipmapLinearFilter;

          texture.magFilter = THREE.LinearFilter;

          texture.generateMipmaps = true;
          texture.needsUpdate = true;

          this.textureCache.set(posterSrc, texture);

          this.pendingTextures.delete(posterSrc);

          resolve(texture);
        },
        undefined,
        (error) => {
          this.pendingTextures.delete(posterSrc);

          reject(error);
        },
      );
    });

    this.pendingTextures.set(posterSrc, request);

    return request;
  }
}

let sharedEngine: SharedCineGlassPosterEngine | null = null;

function getEngine(): SharedCineGlassPosterEngine {
  sharedEngine ??= new SharedCineGlassPosterEngine();

  return sharedEngine;
}

export function PosterGlassFrame({
  posterSrc,
  children,
  radius = "var(--poster-radius,12px)",
  className = "",
}: {
  posterSrc?: string;
  children: ReactNode;
  radius?: CSSProperties["borderRadius"];
  className?: string;
}) {
  const { settings } = useSettings();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  const enabled =
    (settings.liquidGlassEnabled ?? true) && (settings.posterGlassFrameEnabled ?? false);

  const opacity = Math.min(1, Math.max(0, (settings.liquidGlassOpacity ?? 100) / 100));

  const renderScene = (rotationX = 0, rotationY = 0) => {
    const canvas = canvasRef.current;

    if (!enabled || !canvas || !posterSrc) {
      return;
    }

    void getEngine().render({
      canvas,
      posterSrc,
      opacity,
      rotationX,
      rotationY,
      onReady: () => {
        setFailed(false);
        setReady(true);
      },
      onError: () => {
        setReady(false);
        setFailed(true);
      },
    });
  };

  useEffect(() => {
    setReady(false);
    setFailed(false);

    if (!enabled || !posterSrc) return;

    const wrapper = wrapperRef.current;

    if (!wrapper) return;

    renderScene();

    const resizeObserver = new ResizeObserver(() => renderScene());

    resizeObserver.observe(wrapper);

    return () => {
      resizeObserver.disconnect();
    };
  }, [enabled, opacity, posterSrc]);

  if (!enabled || !posterSrc || failed) {
    return <>{children}</>;
  }

  return (
    <div
      ref={wrapperRef}
      className={`relative w-full ${className}`}
      style={{
        borderRadius: radius,
      }}
      onPointerMove={(event) => {
        const wrapper = wrapperRef.current;

        if (!wrapper) return;

        const rectangle = wrapper.getBoundingClientRect();

        const normalizedX =
          ((event.clientX - rectangle.left) / Math.max(rectangle.width, 1)) * 2 - 1;

        const normalizedY =
          ((event.clientY - rectangle.top) / Math.max(rectangle.height, 1)) * 2 - 1;

        /*
         * يحاكي دوران الكروت في animate() بالمرجع.
         */
        renderScene(-normalizedY * 0.035, -normalizedX * 0.11);
      }}
      onPointerLeave={() => {
        renderScene(0, 0);
      }}
    >
      <div
        className={`relative w-full transition-opacity duration-200 ${
          ready ? "opacity-0" : "opacity-100"
        }`}
      >
        {children}
      </div>

      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 block h-full w-full transition-opacity duration-200 ${
          ready ? "opacity-100" : "opacity-0"
        }`}
        style={{
          borderRadius: radius,
        }}
      />
    </div>
  );
}
