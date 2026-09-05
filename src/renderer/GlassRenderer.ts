import { captureViewport } from "../capture/captureManager.js";
import { adaptQuality } from "../performance/adaptiveQuality.js";
import { initialQuality, QUALITY_CONFIG } from "../performance/quality.js";
import type { GlassMetrics, GlassQuality, GlassSurfaceOptions } from "../types.js";
import { FRAGMENT_SHADER, VERTEX_SHADER } from "./shaders.js";

interface RendererOptions {
  root: HTMLElement;
  initialQuality?: Exclude<GlassQuality, "fallback">;
  maxDpr?: number;
  mutationDebounceMs?: number;
}

interface SurfaceRecord {
  element: HTMLElement;
  options: Required<GlassSurfaceOptions>;
  rect: DOMRect;
  radius: number;
  tint: [number, number, number];
  observer: ResizeObserver;
  previous: { background: string; backdropFilter: string; webkitBackdropFilter: string; position: string; zIndex: string; isolation: string };
}

const DEFAULT_SURFACE: Required<GlassSurfaceOptions> = {
  borderRadius: 24,
  refraction: 1,
  blur: 3.5,
  chromaticAberration: 0.55,
  tint: "#ffffff",
  tintOpacity: 0.075,
};

const QUALITY_ORDER: GlassQuality[] = ["fallback", "low", "medium", "high"];

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

function shader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const result = gl.createShader(type);
  if (!result) throw new Error("Unable to create WebGL shader");
  gl.shaderSource(result, source);
  gl.compileShader(result);
  if (!gl.getShaderParameter(result, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(result) ?? "Unknown shader error";
    gl.deleteShader(result);
    throw new Error(message);
  }
  return result;
}

function program(gl: WebGL2RenderingContext): WebGLProgram {
  const vertex = shader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragment = shader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  const result = gl.createProgram();
  if (!result) throw new Error("Unable to create WebGL program");
  gl.attachShader(result, vertex);
  gl.attachShader(result, fragment);
  gl.linkProgram(result);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(result, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(result) ?? "Unknown WebGL link error";
    gl.deleteProgram(result);
    throw new Error(message);
  }
  return result;
}

function parseColor(value: string): [number, number, number] {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return [1, 1, 1];
  context.fillStyle = "#fff";
  context.fillStyle = value;
  const normalized = context.fillStyle;
  if (normalized.startsWith("#")) {
    const hex = normalized.length === 4
      ? normalized.slice(1).split("").map((part) => part + part).join("")
      : normalized.slice(1);
    const number = Number.parseInt(hex, 16);
    return [((number >> 16) & 255) / 255, ((number >> 8) & 255) / 255, (number & 255) / 255];
  }
  const channels = normalized.match(/[\d.]+/g)?.map(Number) ?? [255, 255, 255];
  return [channels[0] / 255, channels[1] / 255, channels[2] / 255];
}

export class GlassRenderer {
  private readonly root: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly gl: WebGL2RenderingContext | null;
  private readonly glProgram: WebGLProgram | null = null;
  private readonly vao: WebGLVertexArrayObject | null = null;
  private readonly buffer: WebGLBuffer | null = null;
  private readonly texture: WebGLTexture | null = null;
  private readonly uniforms = new Map<string, WebGLUniformLocation | null>();
  private readonly surfaces = new Map<HTMLElement, SurfaceRecord>();
  private readonly listeners = new Set<() => void>();
  private readonly rootObserver: ResizeObserver;
  private readonly mutationObserver: MutationObserver;
  private readonly maximumDpr: number;
  private readonly mutationDebounceMs: number;
  private quality: GlassQuality;
  private frameHandle = 0;
  private captureTimer = 0;
  private mutationTimer = 0;
  private resizeTimer = 0;
  private scrollEndTimer = 0;
  private capturing = false;
  private captureAgain = false;
  private backdropDirty = true;
  private layoutDirty = true;
  private scrolling = false;
  private destroyed = false;
  private lastCaptureAt = -Infinity;
  private textureWidth = 1;
  private textureHeight = 1;
  private frameTimes: number[] = [];
  private lastFrameAt = 0;
  private stressSamples = 0;
  private comfortableSamples = 0;
  private metrics: GlassMetrics;

  constructor(options: RendererOptions) {
    this.root = options.root;
    this.maximumDpr = options.maxDpr ?? 2;
    this.mutationDebounceMs = options.mutationDebounceMs ?? 140;
    this.quality = options.initialQuality ?? initialQuality();
    this.canvas = document.createElement("canvas");
    this.canvas.dataset.liquidGlassRenderer = "";
    Object.assign(this.canvas.style, {
      position: "fixed", inset: "0", width: "100vw", height: "100vh", pointerEvents: "none", zIndex: "1000",
    });
    this.root.prepend(this.canvas);
    if (!this.root.style.isolation) this.root.style.isolation = "isolate";

    let context: WebGL2RenderingContext | null = null;
    try {
      context = this.quality === "fallback" ? null : this.canvas.getContext("webgl2", {
        alpha: true, antialias: false, premultipliedAlpha: true, preserveDrawingBuffer: false, powerPreference: "high-performance",
      });
    } catch { context = null; }
    this.gl = context;

    if (this.gl) {
      const gl = this.gl;
      this.glProgram = program(gl);
      this.uniformsFor("u_backdrop", "u_viewport", "u_textureSize", "u_rect", "u_radius", "u_refraction", "u_blur", "u_chromatic", "u_tintOpacity", "u_tint", "u_sampleTier");
      this.vao = gl.createVertexArray();
      this.buffer = gl.createBuffer();
      this.texture = gl.createTexture();
      if (!this.vao || !this.buffer || !this.texture) throw new Error("Unable to allocate WebGL resources");
      gl.bindVertexArray(this.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
      const position = gl.getAttribLocation(this.glProgram, "a_position");
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      this.canvas.addEventListener("webglcontextlost", this.onContextLost);
    } else {
      this.quality = "fallback";
      this.canvas.style.display = "none";
    }

    this.metrics = this.makeMetrics();
    this.rootObserver = new ResizeObserver(this.onResize);
    this.rootObserver.observe(this.root);
    this.mutationObserver = new MutationObserver(this.onMutation);
    this.mutationObserver.observe(this.root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["class", "style", "src", "hidden"] });
    window.addEventListener("scroll", this.onScroll, { passive: true, capture: true });
    window.addEventListener("resize", this.onResize, { passive: true });
    window.addEventListener("popstate", this.onRouteChange);
    document.addEventListener("visibilitychange", this.onVisibilityChange);
    this.resizeCanvas();
    this.scheduleFrame();
  }

  add(element: HTMLElement, options: GlassSurfaceOptions = {}): () => void {
    if (this.surfaces.has(element)) throw new Error("Glass surface is already registered");
    const computed = getComputedStyle(element);
    const merged = { ...DEFAULT_SURFACE, ...options };
    const parsedRadius = Number.parseFloat(computed.borderTopLeftRadius);
    const record = {} as SurfaceRecord;
    record.element = element;
    record.options = merged;
    record.rect = element.getBoundingClientRect();
    record.radius = options.borderRadius ?? (Number.isFinite(parsedRadius) ? parsedRadius : merged.borderRadius);
    record.tint = parseColor(merged.tint);
    record.previous = {
      background: element.style.background,
      backdropFilter: element.style.backdropFilter,
      webkitBackdropFilter: element.style.getPropertyValue("-webkit-backdrop-filter"),
      position: element.style.position,
      zIndex: element.style.zIndex,
      isolation: element.style.isolation,
    };
    record.observer = new ResizeObserver(() => { this.layoutDirty = true; this.scheduleFrame(); });
    record.observer.observe(element);
    this.surfaces.set(element, record);
    this.styleSurface(record);
    this.layoutDirty = true;
    this.invalidate();
    this.publish();
    return () => this.remove(record);
  }

  invalidate(): void {
    if (this.destroyed || this.quality === "fallback") return;
    this.backdropDirty = true;
    this.scheduleFrame();
  }

  getMetrics = (): GlassMetrics => this.metrics;
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    cancelAnimationFrame(this.frameHandle);
    clearTimeout(this.captureTimer); clearTimeout(this.mutationTimer); clearTimeout(this.resizeTimer); clearTimeout(this.scrollEndTimer);
    this.rootObserver.disconnect(); this.mutationObserver.disconnect();
    window.removeEventListener("scroll", this.onScroll, true);
    window.removeEventListener("resize", this.onResize);
    window.removeEventListener("popstate", this.onRouteChange);
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
    this.canvas.removeEventListener("webglcontextlost", this.onContextLost);
    for (const record of this.surfaces.values()) this.restoreSurface(record);
    this.surfaces.clear();
    if (this.gl) {
      this.gl.deleteTexture(this.texture); this.gl.deleteBuffer(this.buffer); this.gl.deleteVertexArray(this.vao); this.gl.deleteProgram(this.glProgram);
    }
    this.canvas.remove();
  }

  private uniformsFor(...names: string[]): void {
    if (!this.gl || !this.glProgram) return;
    for (const name of names) this.uniforms.set(name, this.gl.getUniformLocation(this.glProgram, name));
  }

  private styleSurface(record: SurfaceRecord): void {
    const style = record.element.style;
    if (!style.position) style.position = "relative";
    style.zIndex = style.zIndex || "1001";
    style.isolation = "isolate";
    if (this.quality === "fallback") {
      style.background = `color-mix(in srgb, ${record.options.tint} ${Math.round(record.options.tintOpacity * 180)}%, transparent)`;
      style.backdropFilter = `blur(${Math.max(8, record.options.blur * 2)}px) saturate(155%)`;
      style.setProperty("-webkit-backdrop-filter", style.backdropFilter);
    } else {
      style.background = "transparent";
      style.backdropFilter = "none";
      style.setProperty("-webkit-backdrop-filter", "none");
    }
  }

  private restoreSurface(record: SurfaceRecord): void {
    record.observer.disconnect();
    const { webkitBackdropFilter, ...standard } = record.previous;
    Object.assign(record.element.style, standard);
    record.element.style.setProperty("-webkit-backdrop-filter", webkitBackdropFilter);
  }

  private remove(record: SurfaceRecord): void {
    this.restoreSurface(record);
    this.surfaces.delete(record.element);
    this.layoutDirty = true;
    this.scheduleFrame();
    this.publish();
  }

  private onMutation = (mutations: MutationRecord[]): void => {
    const relevant = mutations.some((mutation) => {
      const target = mutation.target instanceof Element ? mutation.target : mutation.target.parentElement;
      return target && !target.closest("[data-liquid-glass-surface], [data-liquid-glass-renderer], [data-liquid-glass-debug]");
    });
    if (!relevant) return;
    this.layoutDirty = true;
    clearTimeout(this.mutationTimer);
    this.mutationTimer = window.setTimeout(() => this.invalidate(), this.mutationDebounceMs);
  };

  private onScroll = (): void => {
    if (this.quality === "fallback") return;
    this.scrolling = true;
    this.layoutDirty = true;
    this.invalidate();
    clearTimeout(this.scrollEndTimer);
    this.scrollEndTimer = window.setTimeout(() => {
      this.scrolling = false;
      this.invalidate();
    }, 150);
  };

  private onResize = (): void => {
    this.layoutDirty = true;
    this.resizeCanvas();
    this.scheduleFrame();
    clearTimeout(this.resizeTimer);
    this.resizeTimer = window.setTimeout(() => this.invalidate(), 180);
  };

  private onRouteChange = (): void => { window.setTimeout(() => this.invalidate(), 0); };
  private onVisibilityChange = (): void => { if (!document.hidden) this.invalidate(); };
  private onContextLost = (event: Event): void => { event.preventDefault(); this.setQuality("fallback"); };

  private resizeCanvas(): void {
    const config = QUALITY_CONFIG[this.quality];
    const dpr = Math.min(window.devicePixelRatio || 1, this.maximumDpr, config.maxDpr);
    const width = Math.max(1, Math.round(window.innerWidth * dpr));
    const height = Math.max(1, Math.round(window.innerHeight * dpr));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width; this.canvas.height = height;
      this.backdropDirty = true;
    }
  }

  private scheduleFrame(): void {
    if (this.destroyed || this.frameHandle || this.quality === "fallback" || document.hidden) return;
    this.frameHandle = requestAnimationFrame(this.frame);
  }

  private frame = (now: number): void => {
    this.frameHandle = 0;
    if (this.lastFrameAt > 0 && now - this.lastFrameAt < 80) {
      this.frameTimes.push(now - this.lastFrameAt);
      if (this.frameTimes.length > 45) this.frameTimes.shift();
    }
    this.lastFrameAt = now;
    if (this.layoutDirty) this.measureSurfaces();
    const hasVisibleSurface = this.hasVisibleSurface();
    if (this.backdropDirty && hasVisibleSurface) this.requestCapture(now);
    this.draw();
    this.publish();
    if (this.scrolling || this.capturing || (this.backdropDirty && hasVisibleSurface)) this.scheduleFrame();
  };

  private measureSurfaces(): void {
    for (const record of this.surfaces.values()) record.rect = record.element.getBoundingClientRect();
    this.layoutDirty = false;
  }

  private hasVisibleSurface(): boolean {
    for (const { rect } of this.surfaces.values()) {
      if (rect.width > 0 && rect.height > 0 && rect.bottom >= 0 && rect.top <= innerHeight && rect.right >= 0 && rect.left <= innerWidth) return true;
    }
    return false;
  }

  private requestCapture(now: number): void {
    if (this.capturing) { this.captureAgain = true; return; }
    const config = QUALITY_CONFIG[this.quality];
    const interval = config.minCaptureIntervalMs * (this.scrolling ? 1.35 : 1);
    const remaining = interval - (now - this.lastCaptureAt);
    if (remaining > 0) {
      if (!this.captureTimer) this.captureTimer = window.setTimeout(() => { this.captureTimer = 0; this.scheduleFrame(); }, remaining);
      return;
    }
    this.backdropDirty = false;
    this.lastCaptureAt = now;
    void this.capture();
  }

  private async capture(): Promise<void> {
    if (!this.gl || !this.texture || this.quality === "fallback") return;
    this.capturing = true;
    const started = performance.now();
    const config = QUALITY_CONFIG[this.quality];
    const scale = config.captureScale * (this.scrolling ? 0.72 : 1);
    try {
      const result = await captureViewport({
        root: this.root,
        scale,
        ignore: (element) => element.hasAttribute("data-liquid-glass-renderer") || element.hasAttribute("data-liquid-glass-surface") || element.hasAttribute("data-liquid-glass-debug"),
      });
      if (this.destroyed) return;
      const gl = this.gl;
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      if (result.width === this.textureWidth && result.height === this.textureHeight) {
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, result);
      } else {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, result);
        this.textureWidth = result.width; this.textureHeight = result.height;
      }
      const duration = performance.now() - started;
      this.metrics = { ...this.metrics, captureMs: duration, captureCount: this.metrics.captureCount + 1, captureScale: scale, textureWidth: result.width, textureHeight: result.height };
      this.evaluateQuality(duration);
    } catch (error) {
      console.warn("[universal-liquid-glass] Backdrop capture failed; retaining the previous texture.", error);
      this.stressSamples += 1;
      if (this.stressSamples >= 3) this.degrade();
    } finally {
      this.capturing = false;
      if (this.captureAgain) { this.captureAgain = false; this.backdropDirty = true; }
      this.scheduleFrame();
    }
  }

  private draw(): void {
    if (!this.gl || !this.glProgram || !this.vao || !this.texture) return;
    const gl = this.gl;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.glProgram); gl.bindVertexArray(this.vao); gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.uniform1i(this.uniforms.get("u_backdrop") ?? null, 0);
    gl.uniform2f(this.uniforms.get("u_viewport") ?? null, window.innerWidth, window.innerHeight);
    gl.uniform2f(this.uniforms.get("u_textureSize") ?? null, this.textureWidth, this.textureHeight);
    const config = QUALITY_CONFIG[this.quality];
    gl.uniform1f(this.uniforms.get("u_sampleTier") ?? null, config.blurSamples === 13 ? 1 : config.blurSamples === 9 ? 0.6 : 0);
    for (const record of this.surfaces.values()) {
      const rect = record.rect;
      if (rect.width <= 0 || rect.height <= 0 || rect.bottom < 0 || rect.top > innerHeight || rect.right < 0 || rect.left > innerWidth) continue;
      const options = record.options;
      gl.uniform4f(this.uniforms.get("u_rect") ?? null, rect.left, rect.top, rect.width, rect.height);
      gl.uniform1f(this.uniforms.get("u_radius") ?? null, Math.min(record.radius, rect.width / 2, rect.height / 2));
      gl.uniform1f(this.uniforms.get("u_refraction") ?? null, clamp(options.refraction, 0, 2));
      gl.uniform1f(this.uniforms.get("u_blur") ?? null, Math.max(0, options.blur));
      gl.uniform1f(this.uniforms.get("u_chromatic") ?? null, config.chromaticAberration ? clamp(options.chromaticAberration, 0, 1) : 0);
      gl.uniform3f(this.uniforms.get("u_tint") ?? null, ...record.tint);
      gl.uniform1f(this.uniforms.get("u_tintOpacity") ?? null, clamp(options.tintOpacity, 0, 1));
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
  }

  private evaluateQuality(captureMs: number): void {
    const frameMs = this.averageFrameMs();
    const proposed = adaptQuality(this.quality, { averageFrameMs: frameMs, captureMs });
    if (QUALITY_ORDER.indexOf(proposed) < QUALITY_ORDER.indexOf(this.quality)) {
      this.stressSamples += 1; this.comfortableSamples = 0;
      if (this.stressSamples >= (this.quality === "low" ? 3 : 2)) this.setQuality(proposed);
    } else if (QUALITY_ORDER.indexOf(proposed) > QUALITY_ORDER.indexOf(this.quality)) {
      this.comfortableSamples += 1; this.stressSamples = 0;
      if (this.comfortableSamples >= 8) this.setQuality(proposed);
    } else { this.stressSamples = 0; this.comfortableSamples = 0; }
  }

  private degrade(): void {
    const index = QUALITY_ORDER.indexOf(this.quality);
    this.setQuality(QUALITY_ORDER[Math.max(0, index - 1)]);
  }

  private setQuality(next: GlassQuality): void {
    if (next === this.quality) return;
    this.quality = next; this.stressSamples = 0; this.comfortableSamples = 0;
    if (next === "fallback") {
      this.canvas.style.display = "none";
      for (const record of this.surfaces.values()) this.styleSurface(record);
    } else {
      this.resizeCanvas(); this.backdropDirty = true; this.scheduleFrame();
    }
    this.publish();
  }

  private averageFrameMs(): number {
    if (!this.frameTimes.length) return 0;
    return this.frameTimes.reduce((sum, value) => sum + value, 0) / this.frameTimes.length;
  }

  private makeMetrics(): GlassMetrics {
    const averageFrameMs = this.averageFrameMs();
    return {
      mode: this.quality === "fallback" ? "fallback" : "webgl2", quality: this.quality,
      averageFrameMs, fps: averageFrameMs > 0 ? Math.min(999, 1000 / averageFrameMs) : 0,
      captureMs: this.metrics?.captureMs ?? 0, captureScale: QUALITY_CONFIG[this.quality].captureScale,
      captureCount: this.metrics?.captureCount ?? 0, surfaceCount: this.surfaces.size,
      textureWidth: this.textureWidth, textureHeight: this.textureHeight,
    };
  }

  private publish(): void {
    this.metrics = { ...this.makeMetrics(), captureMs: this.metrics.captureMs, captureCount: this.metrics.captureCount };
    for (const listener of this.listeners) listener();
  }
}
