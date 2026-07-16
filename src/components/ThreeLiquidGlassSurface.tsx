import {
  useCallback,
  useEffect,
  useRef,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import * as THREE from "three";

type ThreeLiquidGlassSurfaceProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;

  /**
   * نصف قطر الزوايا في CSS.
   * أمثلة:
   * "9999px" للدائرة
   * "24px" للكروت
   * "16px" للأزرار
   */
  radius?: CSSProperties["borderRadius"];

  /**
   * استدارة الشكل داخل Shader:
   * 1 = دائري
   * 0.5 = زر مستطيل ناعم
   * 0.25 = كرت
   */
  shaderRadius?: number;

  /**
   * تشغيل تأثير Three.js عند الضغط أو التركيز.
   * المرور بالماوس وحده لا يشغّل التأثير.
   */
  interactive?: boolean;

  /**
   * إبقاء الحركة مفعّلة دائمًا.
   * يفضّل استخدامه مع عنصر واحد فقط لأن المحرك مشترك.
   */
  alwaysActive?: boolean;

  /**
   * قوة التأثير كاملة.
   */
  intensity?: number;

  /**
   * قوة الانكسار السائل الداخلي.
   */
  refractionStrength?: number;

  /**
   * قوة الطيف اللوني والانفصال اللوني.
   */
  spectralStrength?: number;

  /**
   * قوة إحساس العدسة المحدبة والحلقة الداخلية.
   * ملاحظة: هذا يحاكي العدسة بصريًا، لكنه لا يكبّر
   * بكسلات DOM الخلفية تكبيرًا حقيقيًا.
   */
  lensStrength?: number;

  /**
   * كلاس المحتوى الداخلي.
   */
  contentClassName?: string;
};

type GlassUniforms = {
  uTime: { value: number };
  uActive: { value: number };
  uPressed: { value: number };
  uAspect: { value: number };
  uRadius: { value: number };
  uIntensity: { value: number };
  uRefraction: { value: number };
  uSpectrum: { value: number };
  uLens: { value: number };
};

type AttachOptions = {
  radius: number;
  intensity: number;
  refractionStrength: number;
  spectralStrength: number;
  lensStrength: number;
};

class SharedLiquidGlassEngine {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.OrthographicCamera;
  private readonly geometry: THREE.PlaneGeometry;
  private readonly material: THREE.ShaderMaterial;
  private readonly uniforms: GlassUniforms;

  private targetCanvas: HTMLCanvasElement | null = null;
  private targetContext: CanvasRenderingContext2D | null = null;

  private frameId: number | null = null;
  private lastFrameTime = 0;
  private detaching = false;

  private active = 0;
  private activeTarget = 0;
  private pressed = 0;
  private pressedTarget = 0;

  constructor() {
    this.renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      premultipliedAlpha: true,
      powerPreference: "high-performance",
    });

    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    this.uniforms = {
      uTime: { value: 0 },
      uActive: { value: 0 },
      uPressed: { value: 0 },
      uAspect: { value: 1 },
      uRadius: { value: 1 },
      uIntensity: { value: 1.08 },
      uRefraction: { value: 1.42 },
      uSpectrum: { value: 1.48 },
      uLens: { value: 1.2 },
    };

    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      vertexShader: `
        varying vec2 vUv;

        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;

        varying vec2 vUv;

        uniform float uTime;
        uniform float uActive;
        uniform float uPressed;
        uniform float uAspect;
        uniform float uRadius;
        uniform float uIntensity;
        uniform float uRefraction;
        uniform float uSpectrum;
        uniform float uLens;

        const float TAU = 6.283185307179586;

        float saturateFloat(float value) {
          return clamp(value, 0.0, 1.0);
        }

        float roundedBoxSdf(
          vec2 point,
          vec2 halfSize,
          float radius
        ) {
          vec2 q = abs(point) - halfSize + radius;

          return min(max(q.x, q.y), 0.0) +
            length(max(q, 0.0)) -
            radius;
        }

        vec3 spectralPalette(float value) {
          return 0.5 + 0.5 * cos(
            TAU * (value + vec3(0.00, 0.67, 0.34))
          );
        }

        float band(
          float coordinate,
          float center,
          float width
        ) {
          return exp(
            -pow((coordinate - center) / width, 2.0)
          );
        }

        void main() {
          vec2 basePoint = (vUv - 0.5) * 2.0;
          vec2 shapePoint = vec2(
            basePoint.x * uAspect,
            basePoint.y
          );

          float maximumRadius = min(1.0, uAspect);

          float cornerRadius = mix(
            0.07,
            maximumRadius,
            clamp(uRadius, 0.0, 1.0)
          );

          float shapeDistance = roundedBoxSdf(
            shapePoint,
            vec2(uAspect, 1.0),
            cornerRadius
          );

          float mask =
            1.0 -
            smoothstep(-0.018, 0.026, shapeDistance);

          if (mask <= 0.001) {
            discard;
          }

          /*
           * تموجات داخلية متعددة.
           * لا يوجد مصدر ضوء يتبع مؤشر الماوس.
           */
          float waveA = sin(
            shapePoint.x * 5.8 +
            shapePoint.y * 3.4 +
            uTime * 0.98
          );

          float waveB = sin(
            shapePoint.y * 8.1 -
            shapePoint.x * 2.8 -
            uTime * 0.76
          );

          float waveC = sin(
            length(shapePoint) * 12.8 -
            uTime * 1.16
          );

          float waveD = sin(
            shapePoint.x * 11.0 -
            shapePoint.y * 7.2 +
            uTime * 0.61
          );

          float distortionAmount =
            (0.0065 + uActive * 0.0165) *
            uRefraction;

          vec2 warpedPoint = shapePoint;

          warpedPoint += vec2(
            waveA +
              waveC * 0.46 +
              waveD * 0.18,
            waveB -
              waveC * 0.34 -
              waveD * 0.14
          ) * distortionAmount;

          vec2 normalizedPoint = vec2(
            warpedPoint.x / max(uAspect, 0.001),
            warpedPoint.y
          );

          float radialDistance = length(normalizedPoint);

          /*
           * بروفايل عدسة محدبة.
           * يؤثر على أنماط الانكسار والطيف فقط، لأن الـShader
           * لا يقرأ بكسلات DOM الموجودة خلف العنصر.
           */
          float lensProfile = pow(
            saturateFloat(1.0 - radialDistance),
            1.35
          );

          float lensCompression =
            lensProfile *
            0.055 *
            uLens;

          normalizedPoint *= 1.0 - lensCompression;
          warpedPoint *= 1.0 - lensCompression * 0.72;

          radialDistance = length(normalizedPoint);

          float lensRing = exp(
            -pow(
              (radialDistance - 0.72) /
              max(0.055, 0.13 / max(uLens, 0.25)),
              2.0
            )
          );

          float outerLensRing = exp(
            -pow(
              (radialDistance - 0.91) /
              max(0.032, 0.075 / max(uLens, 0.25)),
              2.0
            )
          );

          /*
           * Fresnel للحواف، بدون ملء الوسط باللون الأبيض.
           */
          float edge = smoothstep(
            0.46,
            1.0,
            radialDistance
          );

          float fresnel = pow(edge, 2.35);

          /*
           * Caustics: تجمعات ضوء سائلة داخل الزجاج.
           */
          float causticWave =
            sin(
              warpedPoint.x * 9.4 +
              warpedPoint.y * 5.4 +
              uTime * 1.08
            ) +
            sin(
              warpedPoint.y * 11.2 -
              warpedPoint.x * 3.8 -
              uTime * 0.86
            );

          causticWave +=
            sin(
              length(warpedPoint) * 16.4 -
              uTime * 1.24
            ) *
            0.78;

          causticWave +=
            sin(
              warpedPoint.x * 14.0 +
              warpedPoint.y * 2.7 -
              uTime * 0.54
            ) *
            0.32;

          float caustics = pow(
            saturateFloat(abs(causticWave) * 0.48),
            7.5
          );

          caustics *=
            (0.22 + uActive * 0.78) *
            uRefraction;

          /*
           * طيف رئيسي يمر قطريًا.
           */
          vec2 spectrumAxisA =
            normalize(vec2(0.74, -0.67));

          float spectrumCoordinateA =
            dot(normalizedPoint, spectrumAxisA);

          spectrumCoordinateA +=
            waveA * 0.030 +
            waveB * 0.020 +
            sin(uTime * 0.44) * 0.065;

          float spectrumBandA = band(
            spectrumCoordinateA,
            sin(uTime * 0.38) * 0.20,
            0.18
          );

          /*
           * طيف ثانوي معاكس؛ يعطي إحساس انكسار فعلي
           * بدل خط واحد مسطح.
           */
          vec2 spectrumAxisB =
            normalize(vec2(-0.58, -0.82));

          float spectrumCoordinateB =
            dot(normalizedPoint, spectrumAxisB);

          spectrumCoordinateB +=
            waveC * 0.024 -
            waveD * 0.018 -
            cos(uTime * 0.36) * 0.055;

          float spectrumBandB = band(
            spectrumCoordinateB,
            cos(uTime * 0.31) * 0.16,
            0.19
          );

          /*
           * طيف ثالث منحني حول حلقة العدسة.
           */
          float spectrumCoordinateC =
            radialDistance +
            waveA * 0.024 -
            waveC * 0.020;

          float spectrumBandC =
            band(
              spectrumCoordinateC,
              0.72 + sin(uTime * 0.28) * 0.035,
              0.105
            ) *
            lensRing;

          float spectralActivity =
            (0.16 + uActive * 0.84) *
            uSpectrum;

          spectrumBandA *= spectralActivity;
          spectrumBandB *= spectralActivity * 0.82;
          spectrumBandC *= spectralActivity * 1.08 * uLens;

          vec3 spectrumColorA = spectralPalette(
            spectrumCoordinateA * 0.92 +
            uTime * 0.031
          );

          vec3 spectrumColorB = spectralPalette(
            spectrumCoordinateB * 0.88 -
            uTime * 0.025 +
            0.23
          );

          vec3 spectrumColorC = spectralPalette(
            spectrumCoordinateC * 1.34 +
            uTime * 0.042 +
            0.48
          );

          /*
           * انفصال RGB على الحواف.
           */
          float redEdge = smoothstep(
            0.54,
            1.0,
            length(
              normalizedPoint + vec2(0.027, -0.004)
            )
          );

          float greenEdge = smoothstep(
            0.62,
            1.0,
            radialDistance
          );

          float blueEdge = smoothstep(
            0.54,
            1.0,
            length(
              normalizedPoint - vec2(0.027, -0.004)
            )
          );

          vec3 chromaticEdge = vec3(
            redEdge,
            greenEdge * 0.30,
            blueEdge
          );

          chromaticEdge *=
            fresnel *
            0.18 *
            uSpectrum;

          /*
           * تموج طيفي دقيق داخل الـcaustics.
           */
          vec3 causticSpectrum = spectralPalette(
            (
              waveA +
              waveB * 0.7 +
              waveC * 0.4
            ) *
              0.12 +
            uTime * 0.018
          );

          vec3 color = vec3(0.0);

          color +=
            vec3(0.62, 0.82, 1.0) *
            fresnel *
            0.085;

          color +=
            vec3(0.62, 0.86, 1.0) *
            caustics *
            0.075;

          color +=
            causticSpectrum *
            caustics *
            0.052 *
            uSpectrum;

          color +=
            spectrumColorA *
            spectrumBandA *
            (0.105 + uActive * 0.175);

          color +=
            spectrumColorB *
            spectrumBandB *
            (0.075 + uActive * 0.125);

          color +=
            spectrumColorC *
            spectrumBandC *
            (0.095 + uActive * 0.145);

          color +=
            spectralPalette(
              radialDistance * 1.7 -
              uTime * 0.022
            ) *
            outerLensRing *
            0.075 *
            uSpectrum *
            uLens;

          color += chromaticEdge;

          color *= uIntensity;
          color *= 1.0 - uPressed * 0.10;

          /*
           * شفافية شديدة في المركز.
           * اللون يظهر فقط في مناطق الانكسار والطيف والحواف.
           */
          float alpha = 0.0;

          alpha += fresnel * 0.070;
          alpha += caustics * 0.032;

          alpha +=
            spectrumBandA *
            (0.020 + uActive * 0.050);

          alpha +=
            spectrumBandB *
            (0.020 + uActive * 0.045);

          alpha +=
            spectrumBandC *
            (0.026 + uActive * 0.052);

          alpha +=
            outerLensRing *
            0.018 *
            uSpectrum *
            uLens;

          alpha +=
            length(chromaticEdge) *
            0.026;

          alpha *= mask;
          alpha *= clamp(uIntensity, 0.0, 1.5);
          alpha *= 1.0 - uPressed * 0.05;

          gl_FragColor = vec4(color, alpha);
        }
      `,
    });

    this.geometry = new THREE.PlaneGeometry(2, 2);

    const mesh = new THREE.Mesh(this.geometry, this.material);

    this.scene.add(mesh);
  }

  attach(canvas: HTMLCanvasElement, options: AttachOptions): void {
    /*
     * امسح أثر العنصر السابق عند الانتقال بين عناصر متعددة.
     */
    if (this.targetCanvas && this.targetCanvas !== canvas) {
      this.targetContext?.clearRect(0, 0, this.targetCanvas.width, this.targetCanvas.height);
    }

    this.targetCanvas = canvas;
    this.targetContext = canvas.getContext("2d");

    this.detaching = false;
    this.activeTarget = 1;

    this.uniforms.uRadius.value = THREE.MathUtils.clamp(options.radius, 0, 1);

    this.uniforms.uIntensity.value = THREE.MathUtils.clamp(options.intensity, 0, 1.5);

    this.uniforms.uRefraction.value = THREE.MathUtils.clamp(options.refractionStrength, 0, 1.8);

    this.uniforms.uSpectrum.value = THREE.MathUtils.clamp(options.spectralStrength, 0, 2.5);

    this.uniforms.uLens.value = THREE.MathUtils.clamp(options.lensStrength, 0, 2.5);

    this.resize(canvas);

    if (this.frameId === null) {
      this.lastFrameTime = performance.now();
      this.frameId = requestAnimationFrame(this.renderFrame);
    }
  }

  detach(canvas: HTMLCanvasElement): void {
    if (this.targetCanvas !== canvas) return;

    this.activeTarget = 0;
    this.pressedTarget = 0;
    this.detaching = true;

    if (this.frameId === null) {
      this.lastFrameTime = performance.now();
      this.frameId = requestAnimationFrame(this.renderFrame);
    }
  }

  release(canvas: HTMLCanvasElement): void {
    if (this.targetCanvas !== canvas) return;

    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }

    this.targetContext?.clearRect(0, 0, canvas.width, canvas.height);

    this.targetCanvas = null;
    this.targetContext = null;

    this.detaching = false;

    this.active = 0;
    this.activeTarget = 0;

    this.pressed = 0;
    this.pressedTarget = 0;
  }

  setPressed(pressed: boolean): void {
    this.pressedTarget = pressed ? 1 : 0;
  }

  private resize(canvas: HTMLCanvasElement): void {
    const rect = canvas.getBoundingClientRect();

    const rawPixelRatio = window.devicePixelRatio || 1;

    /*
     * يمنع Canvas كبير من استهلاك GPU مبالغ فيه.
     */
    const maximumPixels = 240_000;
    const area = Math.max(1, rect.width * rect.height);

    const performanceRatio = Math.sqrt(maximumPixels / area);

    const pixelRatio = THREE.MathUtils.clamp(Math.min(rawPixelRatio, performanceRatio), 0.65, 1.5);

    const width = Math.max(1, Math.round(rect.width * pixelRatio));

    const height = Math.max(1, Math.round(rect.height * pixelRatio));

    if (canvas.width !== width) {
      canvas.width = width;
    }

    if (canvas.height !== height) {
      canvas.height = height;
    }

    this.uniforms.uAspect.value = rect.width / Math.max(rect.height, 1);

    this.renderer.setPixelRatio(1);
    this.renderer.setSize(width, height, false);
  }

  private renderFrame = (now: number): void => {
    const canvas = this.targetCanvas;
    const context = this.targetContext;

    if (!canvas || !context || !canvas.isConnected) {
      this.frameId = null;
      return;
    }

    const deltaSeconds = Math.min(0.05, Math.max(0, (now - this.lastFrameTime) / 1000));

    this.lastFrameTime = now;

    const activeEase = 1 - Math.exp(-deltaSeconds * 15);

    const pressedEase = 1 - Math.exp(-deltaSeconds * 22);

    this.active += (this.activeTarget - this.active) * activeEase;

    this.pressed += (this.pressedTarget - this.pressed) * pressedEase;

    this.uniforms.uTime.value += deltaSeconds;
    this.uniforms.uActive.value = this.active;
    this.uniforms.uPressed.value = this.pressed;

    this.renderer.render(this.scene, this.camera);

    context.clearRect(0, 0, canvas.width, canvas.height);

    context.drawImage(this.renderer.domElement, 0, 0, canvas.width, canvas.height);

    const finishedDetaching = this.detaching && this.active < 0.012 && this.pressed < 0.012;

    if (finishedDetaching) {
      context.clearRect(0, 0, canvas.width, canvas.height);

      this.targetCanvas = null;
      this.targetContext = null;

      this.detaching = false;
      this.frameId = null;
      return;
    }

    this.frameId = requestAnimationFrame(this.renderFrame);
  };
}

let sharedEngine: SharedLiquidGlassEngine | null = null;

function getSharedEngine(): SharedLiquidGlassEngine {
  if (!sharedEngine) {
    sharedEngine = new SharedLiquidGlassEngine();
  }

  return sharedEngine;
}

export function ThreeLiquidGlassSurface({
  children,
  className = "",
  contentClassName = "",
  style,
  radius = "999999px",
  shaderRadius = 1,
  interactive = true,
  alwaysActive = false,
  intensity = 1.08,
  refractionStrength = 1.42,
  spectralStrength = 1.48,
  lensStrength = 1.2,
  onPointerEnter,
  onPointerMove,
  onPointerLeave,
  onPointerDown,
  onPointerUp,
  onPointerCancel,
  onFocus,
  onBlur,
  ...wrapperProps
}: ThreeLiquidGlassSurfaceProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const focusedRef = useRef(false);

  const activate = useCallback(() => {
    const canvas = canvasRef.current;

    if (!canvas) return;

    getSharedEngine().attach(canvas, {
      radius: shaderRadius,
      intensity,
      refractionStrength,
      spectralStrength,
      lensStrength,
    });
  }, [intensity, lensStrength, refractionStrength, shaderRadius, spectralStrength]);

  const deactivateWhenIdle = () => {
    const canvas = canvasRef.current;

    if (!canvas || alwaysActive || focusedRef.current) {
      return;
    }

    sharedEngine?.detach(canvas);
  };

  useEffect(() => {
    const canvas = canvasRef.current;

    if (alwaysActive && canvas) {
      activate();
    }

    return () => {
      if (canvas) {
        sharedEngine?.release(canvas);
      }
    };
  }, [activate, alwaysActive]);

  const glassStyle: CSSProperties = {
    position: "relative",
    isolation: "isolate",
    overflow: "hidden",
    borderRadius: radius,

    /*
     * رجعنا شكل الزجاج السابق:
     * Blur خفيف وخلفية شبه شفافة تعطي سطحًا زجاجيًا واضحًا،
     * مع بقاء الخلفية ظاهرة من خلال العنصر.
     */
    WebkitBackdropFilter: "blur(0.25px) saturate(1.42) brightness(1.014) contrast(1.04)",

    backdropFilter: "blur(3.25px) saturate(1.42) brightness(1.014) contrast(1.04)",

    background: "linear-gradient(145deg, rgba(255,255,255,0.007), rgba(255,255,255,0.0015))",

    /*
     * حافة داخلية خفيفة فقط، بدون ضوء أو ظل خارجي.
     */
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -1px 0 rgba(0,0,0,0.034)",

    ...style,
  };

  return (
    <div
      {...wrapperProps}
      style={glassStyle}
      onPointerEnter={(event) => {
        /*
         * لا نفعّل Three.js عند الـHover.
         * نمرر الحدث فقط إذا كان المستعمل يحتاجه.
         */
        onPointerEnter?.(event);
      }}
      onPointerMove={(event) => {
        /*
         * لا يوجد تتبع للمؤشر أو تحريك للضوء.
         */
        onPointerMove?.(event);
      }}
      onPointerLeave={(event) => {
        if (interactive) {
          sharedEngine?.setPressed(false);
          deactivateWhenIdle();
        }

        onPointerLeave?.(event);
      }}
      onPointerDown={(event) => {
        /*
         * التأثير يعمل عند الضغط فقط،
         * أو عند التركيز بالكيبورد/الريموت.
         */
        if (interactive) {
          activate();
          sharedEngine?.setPressed(true);
        }

        onPointerDown?.(event);
      }}
      onPointerUp={(event) => {
        if (interactive) {
          sharedEngine?.setPressed(false);
          deactivateWhenIdle();
        }

        onPointerUp?.(event);
      }}
      onPointerCancel={(event) => {
        if (interactive) {
          sharedEngine?.setPressed(false);
          deactivateWhenIdle();
        }

        onPointerCancel?.(event);
      }}
      onFocus={(event) => {
        focusedRef.current = true;

        if (interactive) {
          activate();
        }

        onFocus?.(event);
      }}
      onBlur={(event) => {
        focusedRef.current = false;

        if (interactive) {
          sharedEngine?.setPressed(false);
          deactivateWhenIdle();
        }

        onBlur?.(event);
      }}
      className={className}
    >
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="
          pointer-events-none
          absolute inset-0 z-0
          h-full w-full
          rounded-[inherit]
        "
        style={{
          mixBlendMode: "screen",
          opacity: 0.98,
        }}
      />

      <div className={`relative z-10 h-full w-full ${contentClassName}`}>{children}</div>
    </div>
  );
}
