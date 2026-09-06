import { captureViewport } from "../capture/captureManager.js";
import { adaptQuality } from "../performance/adaptiveQuality.js";
import { CaptureScheduler } from "../performance/captureScheduler.js";
import { summarizeFrameTimes } from "../performance/frameMetrics.js";
import { initialQuality, QUALITY_CONFIG } from "../performance/quality.js";
import type { GlassCapturePolicy, GlassDebugView, GlassMetrics, GlassQuality, GlassSurfaceOptions } from "../types.js";
import { FRAGMENT_SHADER, VERTEX_SHADER } from "./shaders.js";
import { resolveSurfaceOptions } from "./surfaceOptions.js";

interface RendererOptions {
  root: HTMLElement;
  initialQuality?: GlassQuality;
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

const QUALITY_ORDER: GlassQuality[] = ["fallback", "low", "medium", "high"];
const LIBRARY_OWNED_SELECTOR = "[data-liquid-glass-surface], [data-liquid-glass-renderer], [data-liquid-glass-debug]";

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

function isLibraryOwnedNode(node: Node): boolean {
  const element = node instanceof Element ? node : node.parentElement;
  return Boolean(element?.closest(LIBRARY_OWNED_SELECTOR));
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
  private gl: WebGL2RenderingContext | null;
  private glProgram: WebGLProgram | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private buffer: WebGLBuffer | null = null;
  private texture: WebGLTexture | null = null;
  private readonly uniforms = new Map<string, WebGLUniformLocation | null>();
  private readonly surfaces = new Map<HTMLElement, SurfaceRecord>();
  private readonly listeners = new Set<() => void>();
  private readonly rootObserver: ResizeObserver;
  private readonly mutationObserver: MutationObserver;
  private readonly captureScheduler = new CaptureScheduler();
  private readonly maximumDpr: number;
  private readonly mutationDebounceMs: number;
  private quality: GlassQuality;
  private frameHandle = 0;
  private captureTimer = 0;
  private mutationTimer = 0;
  private interactionSettleTimer = 0;
  private layoutDirty = true;
  private destroyed = false;
  private frameLoopActive = false;
  private interactionPresentationActive = false;
  private lastCaptureAt = -Infinity;
  private lastMetricsPublishAt = -Infinity;
  private textureWidth = 1;
  private textureHeight = 1;
  private frameTimes: number[] = [];
  private lastFrameAt = 0;
  private lastFrameMs = 0;
  private captureCount = 0;
  private captureTimestamps: number[] = [];
  private captureDurations: number[] = [];
  private lastCaptureMs = 0;
  private lastKnownScrollX = 0;
  private lastKnownScrollY = 0;
  private stressSamples = 0;
  private comfortableSamples = 0;
  private currentDpr = 1;
  private currentCaptureScale = 0;
  private loggedFirstCapture = false;
  private sourceReady = false;
  private debugView: GlassDebugView = "normal";
  private webglVersion = "unavailable";
  private shaderStatus = "not initialized";
  private framebufferStatus = "not checked";
  private sourceStatus = "not captured";
  private lastRenderError = "none";
  private diagnosticFailure = false;
  private lastInvalidation = "initial";
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
      opacity: "1", transition: "opacity 110ms ease", willChange: "opacity",
    });
    this.root.prepend(this.canvas);
    if (!this.root.style.isolation) this.root.style.isolation = "isolate";

    const fallbackRequested = this.quality === "fallback";
    let context: WebGL2RenderingContext | null = null;
    try {
      context = this.quality === "fallback" ? null : this.canvas.getContext("webgl2", {
        alpha: true, antialias: false, premultipliedAlpha: true, preserveDrawingBuffer: false, powerPreference: "high-performance",
      });
    } catch { context = null; }
    this.gl = context;

    if (this.gl) {
      const gl = this.gl;
      try {
        this.webglVersion = String(gl.getParameter(gl.VERSION));
        this.glProgram = program(gl);
        this.shaderStatus = "vertex compiled · fragment compiled · program linked";
        this.uniformsFor("u_backdrop", "u_viewport", "u_textureSize", "u_rect", "u_radius", "u_refraction", "u_blur", "u_chromatic", "u_tintOpacity", "u_tint", "u_sampleTier", "u_debugMode", "u_sourceReady");
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
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        this.framebufferStatus = this.readFramebufferStatus();
        this.canvas.addEventListener("webglcontextlost", this.onContextLost);
      } catch (error) {
        this.lastRenderError = error instanceof Error ? error.message : String(error);
        this.shaderStatus = `failed: ${this.lastRenderError}`;
        this.diagnosticFailure = true;
        this.quality = "fallback";
        this.canvas.style.display = "none";
        console.error("[universal-liquid-glass] WebGL initialization failed", error);
      }
    } else {
      this.quality = "fallback";
      this.canvas.style.display = "none";
      this.lastRenderError = fallbackRequested ? "none (CSS fallback requested)" : "WebGL2 context creation failed";
      this.diagnosticFailure = !fallbackRequested;
    }

    this.metrics = this.makeMetrics();
    this.rootObserver = new ResizeObserver(this.onRootResize);
    this.rootObserver.observe(this.root);
    this.mutationObserver = new MutationObserver(this.onMutation);
    this.mutationObserver.observe(this.root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["class", "style", "src", "hidden"] });
    window.addEventListener("scroll", this.onScroll, { passive: true, capture: true });
    window.addEventListener("wheel", this.onScrollIntent, { passive: true, capture: true });
    window.addEventListener("touchmove", this.onScrollIntent, { passive: true, capture: true });
    window.addEventListener("resize", this.onResize, { passive: true });
    window.addEventListener("popstate", this.onRouteChange);
    document.addEventListener("visibilitychange", this.onVisibilityChange);
    this.lastKnownScrollX = window.scrollX;
    this.lastKnownScrollY = window.scrollY;
    this.resizeCanvas();
    if (this.quality !== "fallback") this.captureScheduler.queue("initial");
    console.info("[universal-liquid-glass] renderer diagnostics", this.makeMetrics());
    this.scheduleFrame();
  }

  add(element: HTMLElement, options: GlassSurfaceOptions = {}): () => void {
    if (this.surfaces.has(element)) throw new Error("Glass surface is already registered");
    const computed = getComputedStyle(element);
    const merged = resolveSurfaceOptions(options);
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
    this.invalidate("surface registered");
    this.publish();
    return () => this.remove(record);
  }

  invalidate(reason = "manual"): void {
    if (this.destroyed || this.quality === "fallback") return;
    this.lastInvalidation = reason;
    this.captureScheduler.queue(reason);
    this.scheduleFrame();
  }

  getMetrics = (): GlassMetrics => this.metrics;
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  setDebugView(view: GlassDebugView): void {
    this.debugView = view;
    this.layoutDirty = true;
    this.scheduleFrame();
    console.info(`[universal-liquid-glass] debug view: ${view}`);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    cancelAnimationFrame(this.frameHandle);
    clearTimeout(this.captureTimer); clearTimeout(this.mutationTimer); clearTimeout(this.interactionSettleTimer);
    this.rootObserver.disconnect(); this.mutationObserver.disconnect();
    window.removeEventListener("scroll", this.onScroll, true);
    window.removeEventListener("wheel", this.onScrollIntent, true);
    window.removeEventListener("touchmove", this.onScrollIntent, true);
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
    if (this.quality === "fallback" || this.interactionPresentationActive) {
      style.background = this.quality === "fallback" && this.diagnosticFailure
        ? "repeating-linear-gradient(135deg, rgba(255,0,170,.72) 0 12px, rgba(55,0,75,.72) 12px 24px)"
        : `color-mix(in srgb, ${record.options.tint} ${Math.round(record.options.tintOpacity * 180)}%, transparent)`;
      style.backdropFilter = `blur(${Math.max(8, record.options.blur * 2)}px) saturate(155%)`;
      style.setProperty("-webkit-backdrop-filter", style.backdropFilter);
    } else {
      style.background = "transparent";
      style.backdropFilter = "none";
      style.setProperty("-webkit-backdrop-filter", "none");
    }
  }

  private setInteractionPresentation(active: boolean): void {
    if (this.interactionPresentationActive === active) return;
    this.interactionPresentationActive = active;
    this.canvas.style.opacity = active ? "0" : "1";
    for (const record of this.surfaces.values()) this.styleSurface(record);
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
      if (isLibraryOwnedNode(mutation.target)) return false;
      if (mutation.type !== "childList") return true;
      const changedNodes = [...mutation.addedNodes, ...mutation.removedNodes];
      return changedNodes.length === 0 || changedNodes.some((node) => !isLibraryOwnedNode(node));
    });
    if (!relevant) return;
    this.layoutDirty = true;
    clearTimeout(this.mutationTimer);
    const interactionMode = this.captureScheduler.snapshot.interactionMode;
    if (interactionMode === "scrolling" || interactionMode === "resizing" || interactionMode === "settling") {
      // Interaction already guarantees one settled refresh. Mark it now so a
      // separate mutation debounce cannot fire halfway through that capture.
      this.invalidate("DOM mutation");
      return;
    }
    this.mutationTimer = window.setTimeout(() => this.invalidate("DOM mutation"), this.mutationDebounceMs);
  };

  private onScrollIntent = (): void => {
    if (this.quality === "fallback") return;
    this.beginScrollInteraction();
  };

  private onScroll = (): void => {
    if (this.quality === "fallback") return;
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    // html2canvas can emit scroll events while restoring clone state. Only a
    // real live-viewport position change starts or extends an interaction.
    if (scrollX === this.lastKnownScrollX && scrollY === this.lastKnownScrollY) return;
    this.lastKnownScrollX = scrollX;
    this.lastKnownScrollY = scrollY;
    this.beginScrollInteraction("scroll settled");
  };

  private beginScrollInteraction(reason?: string): void {
    this.captureScheduler.beginScroll(reason);
    if (reason) this.lastInvalidation = "scroll pending";
    this.layoutDirty = true;
    this.cancelScheduledCapture();
    this.setInteractionPresentation(true);
    this.restartInteractionSettleTimer(140);
    this.scheduleFrame();
    this.publish(false);
  }

  private onResize = (): void => {
    if (this.quality === "fallback") return;
    this.captureScheduler.beginResize();
    this.lastInvalidation = "resize pending";
    this.layoutDirty = true;
    this.cancelScheduledCapture();
    this.setInteractionPresentation(true);
    this.restartInteractionSettleTimer(160);
    this.scheduleFrame();
    this.publish(false);
  };

  private onRootResize = (): void => {
    this.layoutDirty = true;
    this.scheduleFrame();
  };

  private restartInteractionSettleTimer(delayMs: number): void {
    clearTimeout(this.interactionSettleTimer);
    this.interactionSettleTimer = window.setTimeout(() => {
      this.interactionSettleTimer = 0;
      const wasResizing = this.captureScheduler.snapshot.interactionMode === "resizing";
      this.captureScheduler.settle();
      if (wasResizing) this.resizeCanvas();
      this.layoutDirty = true;
      if (this.captureScheduler.snapshot.interactionMode === "idle") this.setInteractionPresentation(false);
      this.scheduleFrame();
      this.publish(true);
    }, delayMs);
  }

  private cancelScheduledCapture(): void {
    clearTimeout(this.captureTimer);
    this.captureTimer = 0;
  }

  private onRouteChange = (): void => { window.setTimeout(() => this.invalidate("route change"), 0); };
  private onVisibilityChange = (): void => {
    this.frameTimes = [];
    this.lastFrameAt = 0;
    this.lastFrameMs = 0;
    if (!document.hidden) this.invalidate("document visible");
  };
  private onContextLost = (event: Event): void => {
    event.preventDefault();
    this.lastRenderError = "WebGL context lost";
    this.diagnosticFailure = true;
    console.error("[universal-liquid-glass] WebGL context lost");
    this.setQuality("fallback");
  };

  private resizeCanvas(): void {
    const config = QUALITY_CONFIG[this.quality];
    this.currentDpr = Math.min(window.devicePixelRatio || 1, this.maximumDpr, config.maxDpr);
    const width = Math.max(1, Math.round(window.innerWidth * this.currentDpr));
    const height = Math.max(1, Math.round(window.innerHeight * this.currentDpr));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width; this.canvas.height = height;
    }
  }

  private scheduleFrame(): void {
    if (this.destroyed || this.frameHandle || this.quality === "fallback" || document.hidden) return;
    if (!this.frameLoopActive) {
      this.frameLoopActive = true;
      this.lastFrameAt = 0;
    }
    this.frameHandle = requestAnimationFrame(this.frame);
  }

  private frame = (now: number): void => {
    this.frameHandle = 0;
    if (this.lastFrameAt > 0) {
      this.lastFrameMs = now - this.lastFrameAt;
      this.frameTimes.push(this.lastFrameMs);
      if (this.frameTimes.length > 120) this.frameTimes.shift();
    }
    this.lastFrameAt = now;
    if (this.layoutDirty) this.measureSurfaces();
    const hasVisibleSurface = this.hasVisibleSurface();
    if (hasVisibleSurface) this.requestCapture(now);
    if (!this.interactionPresentationActive && !this.captureScheduler.snapshot.captureInFlight) this.draw();
    this.publish(false, now);
    const state = this.captureScheduler.snapshot;
    const interactionActive = state.interactionMode === "scrolling" || state.interactionMode === "resizing";
    const pendingCaptureReady = Boolean(state.pendingCaptureReason && hasVisibleSurface && !this.captureTimer);
    if (interactionActive || state.captureInFlight || pendingCaptureReady) this.scheduleFrame();
    else {
      this.frameLoopActive = false;
      this.lastFrameAt = 0;
      this.publish(true, now);
    }
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
    const state = this.captureScheduler.snapshot;
    if (state.captureInFlight || !state.pendingCaptureReason) return;
    if (state.interactionMode === "scrolling" || state.interactionMode === "resizing" || state.interactionMode === "refreshing") return;
    const config = QUALITY_CONFIG[this.quality];
    const interval = config.minCaptureIntervalMs;
    const remaining = interval - (now - this.lastCaptureAt);
    if (remaining > 0) {
      if (!this.captureTimer) this.captureTimer = window.setTimeout(() => { this.captureTimer = 0; this.scheduleFrame(); }, remaining);
      return;
    }
    const reason = this.captureScheduler.beginCapture();
    if (!reason) return;
    this.lastCaptureAt = now;
    this.lastInvalidation = reason;
    this.captureCount += 1;
    this.captureTimestamps.push(performance.now());
    void this.capture();
  }

  private async capture(): Promise<void> {
    if (!this.gl || !this.texture || this.quality === "fallback") return;
    const started = performance.now();
    let durationRecorded = false;
    const config = QUALITY_CONFIG[this.quality];
    const scale = config.captureScale;
    this.currentCaptureScale = scale;
    try {
      const result = await captureViewport({
        root: this.root,
        scale,
        ignore: (element) => element.matches(LIBRARY_OWNED_SELECTOR),
      });
      if (this.destroyed) return;
      const probe = this.probeSource(result);
      this.sourceReady = probe.valid;
      this.sourceStatus = probe.message;
      if (!probe.valid) {
        this.lastRenderError = `Backdrop capture is empty: ${probe.message}`;
        console.error("[universal-liquid-glass] empty backdrop texture", { width: result.width, height: result.height, probe });
      }
      const gl = this.gl;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      // v_uv is intentionally top-down (0 at the viewport top), matching
      // DOM canvas row order. Flipping here mirrors the viewport vertically.
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      if (result.width === this.textureWidth && result.height === this.textureHeight) {
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, result);
      } else {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, result);
        this.textureWidth = result.width; this.textureHeight = result.height;
      }
      const uploadError = gl.getError();
      if (uploadError !== gl.NO_ERROR) {
        this.sourceReady = false;
        this.lastRenderError = `Texture upload WebGL error 0x${uploadError.toString(16)}`;
        console.error("[universal-liquid-glass] texture upload failed", this.lastRenderError);
      }
      const duration = performance.now() - started;
      this.recordCaptureDuration(duration);
      durationRecorded = true;
      this.evaluateQuality(duration);
      const interactionMode = this.captureScheduler.snapshot.interactionMode;
      if (interactionMode !== "scrolling" && interactionMode !== "resizing") this.draw();
      if (!this.loggedFirstCapture) {
        this.loggedFirstCapture = true;
        console.info("[universal-liquid-glass] first backdrop captured", this.makeMetrics());
      }
    } catch (error) {
      this.lastRenderError = error instanceof Error ? error.message : String(error);
      this.sourceStatus = "capture failed";
      this.sourceReady = false;
      console.error("[universal-liquid-glass] backdrop capture failed", error);
      this.stressSamples += 1;
      if (this.stressSamples >= 3) this.degrade();
    } finally {
      if (!durationRecorded) this.recordCaptureDuration(performance.now() - started);
      this.captureScheduler.finishCapture();
      if (this.captureScheduler.snapshot.interactionMode === "idle") this.setInteractionPresentation(false);
      this.publish(true);
      this.scheduleFrame();
    }
  }

  private draw(): void {
    if (!this.gl || !this.glProgram || !this.vao || !this.texture) return;
    const gl = this.gl;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.glProgram); gl.bindVertexArray(this.vao); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.uniform1i(this.uniforms.get("u_backdrop") ?? null, 0);
    gl.uniform2f(this.uniforms.get("u_viewport") ?? null, window.innerWidth, window.innerHeight);
    gl.uniform2f(this.uniforms.get("u_textureSize") ?? null, this.textureWidth, this.textureHeight);
    const config = QUALITY_CONFIG[this.quality];
    gl.uniform1f(this.uniforms.get("u_sampleTier") ?? null, config.blurSamples === 13 ? 1 : config.blurSamples === 9 ? 0.6 : 0);
    gl.uniform1f(this.uniforms.get("u_debugMode") ?? null, this.debugView === "sample" ? 1 : this.debugView === "exaggerated" ? 2 : 0);
    gl.uniform1f(this.uniforms.get("u_sourceReady") ?? null, this.sourceReady ? 1 : 0);
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
    this.framebufferStatus = this.readFramebufferStatus();
    const renderError = gl.getError();
    if (renderError !== gl.NO_ERROR) {
      this.lastRenderError = `Render WebGL error 0x${renderError.toString(16)}`;
      console.error("[universal-liquid-glass] render failed", this.lastRenderError);
    }
  }

  private probeSource(canvas: HTMLCanvasElement): { valid: boolean; message: string } {
    try {
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context || canvas.width < 2 || canvas.height < 2) return { valid: false, message: `${canvas.width}×${canvas.height}; no 2D pixels` };
      const points = [[.1, .1], [.5, .1], [.9, .1], [.1, .5], [.5, .5], [.9, .5], [.1, .9], [.5, .9], [.9, .9]];
      let alpha = 0; let luminance = 0;
      for (const [fx, fy] of points) {
        const pixel = context.getImageData(Math.min(canvas.width - 1, Math.floor(canvas.width * fx)), Math.min(canvas.height - 1, Math.floor(canvas.height * fy)), 1, 1).data;
        alpha += pixel[3]; luminance += pixel[0] + pixel[1] + pixel[2];
      }
      const valid = alpha > 9 * 16 && luminance > 9 * 6;
      return { valid, message: `${canvas.width}×${canvas.height}; probe alpha=${alpha}; rgb=${luminance}` };
    } catch (error) {
      return { valid: true, message: `${canvas.width}×${canvas.height}; pixel probe unavailable (${error instanceof Error ? error.message : String(error)})` };
    }
  }

  private readFramebufferStatus(): string {
    if (!this.gl) return "unavailable";
    const status = this.gl.checkFramebufferStatus(this.gl.FRAMEBUFFER);
    if (status === this.gl.FRAMEBUFFER_COMPLETE) return "complete";
    return `incomplete 0x${status.toString(16)}`;
  }

  private evaluateQuality(captureMs: number): void {
    const frameTiming = summarizeFrameTimes(this.frameTimes);
    const proposed = adaptQuality(this.quality, { averageFrameMs: frameTiming.averageFrameMs, p95FrameMs: frameTiming.p95FrameMs, captureMs });
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
      this.cancelScheduledCapture();
      clearTimeout(this.interactionSettleTimer);
      this.interactionSettleTimer = 0;
      this.captureScheduler.reset();
      this.interactionPresentationActive = false;
      this.canvas.style.display = "none";
      for (const record of this.surfaces.values()) this.styleSurface(record);
    } else {
      this.canvas.style.display = "block";
      this.resizeCanvas();
      this.layoutDirty = true;
      this.scheduleFrame();
    }
    this.publish();
  }

  private recordCaptureDuration(duration: number): void {
    this.lastCaptureMs = duration;
    this.captureDurations.push(duration);
    if (this.captureDurations.length > 30) this.captureDurations.shift();
  }

  private capturePolicy(): GlassCapturePolicy {
    if (this.lastCaptureMs <= 25) return "dynamic";
    if (this.lastCaptureMs <= 40) return "occasional";
    if (this.lastCaptureMs <= 60) return "idle-only";
    return "strict-idle-only";
  }

  private makeMetrics(): GlassMetrics {
    const { averageFrameMs, p95FrameMs, worstFrameMs, fps } = summarizeFrameTimes(this.frameTimes);
    const averageCaptureMs = this.captureDurations.length
      ? this.captureDurations.reduce((sum, value) => sum + value, 0) / this.captureDurations.length
      : 0;
    const recentCaptureCutoff = performance.now() - 10_000;
    this.captureTimestamps = this.captureTimestamps.filter((timestamp) => timestamp >= recentCaptureCutoff);
    const scheduling = this.captureScheduler.snapshot;
    const firstSurface = Array.from(this.surfaces.values()).find(({ rect }) =>
      rect.width > 0 && rect.height > 0 && rect.bottom >= 0 && rect.top <= innerHeight,
    );
    const rect = firstSurface?.rect;
    const surfaceRect = rect ? `${rect.left.toFixed(1)},${rect.top.toFixed(1)} ${rect.width.toFixed(1)}×${rect.height.toFixed(1)}` : "none";
    const sampledUvs = rect
      ? `${(rect.left / innerWidth).toFixed(3)},${(rect.top / innerHeight).toFixed(3)} → ${(rect.right / innerWidth).toFixed(3)},${(rect.bottom / innerHeight).toFixed(3)}`
      : "none";
    return {
      mode: this.quality === "fallback" ? "fallback" : "webgl2", quality: this.quality,
      averageFrameMs, lastFrameMs: this.lastFrameMs, p95FrameMs, worstFrameMs,
      fps,
      captureMs: this.lastCaptureMs, averageCaptureMs,
      captureScale: this.currentCaptureScale || QUALITY_CONFIG[this.quality].captureScale,
      captureCount: this.captureCount, capturesThisScrollGesture: scheduling.capturesThisScrollGesture,
      capturesLast10Seconds: this.captureTimestamps.length, interactionMode: scheduling.interactionMode,
      capturePolicy: this.capturePolicy(), pendingCaptureReason: scheduling.pendingCaptureReason,
      captureInFlight: scheduling.captureInFlight, surfaceCount: this.surfaces.size,
      textureWidth: this.textureWidth, textureHeight: this.textureHeight,
      canvasWidth: this.canvas.width, canvasHeight: this.canvas.height, dpr: this.currentDpr,
      viewportWidth: window.innerWidth, viewportHeight: window.innerHeight,
      webglVersion: this.webglVersion, shaderStatus: this.shaderStatus,
      framebufferStatus: this.framebufferStatus, sourceStatus: this.sourceStatus,
      debugView: this.debugView, surfaceRect, sampledUvs, lastInvalidation: this.lastInvalidation, lastRenderError: this.lastRenderError,
    };
  }

  private publish(force = true, now = performance.now()): void {
    if (!force && now - this.lastMetricsPublishAt < 100) return;
    this.lastMetricsPublishAt = now;
    this.metrics = this.makeMetrics();
    for (const listener of this.listeners) listener();
  }
}
