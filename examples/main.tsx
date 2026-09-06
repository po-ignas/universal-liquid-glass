import { StrictMode, useEffect, useState, type CSSProperties } from "react";
import { createRoot } from "react-dom/client";
import { GlassProvider, GlassSurface, useGlassRenderer, type GlassDebugView } from "../src/index.js";
import "./demo.css";

const cards = [
  ["Cobalt tide", "#2459ff", "#9ec5ff"], ["Citrus field", "#ffb000", "#fff1a8"],
  ["Violet bloom", "#8c43ff", "#e0bbff"], ["Coral signal", "#ff556b", "#ffc0a5"],
  ["Forest light", "#0c9f75", "#9af0c9"], ["Night current", "#182444", "#7898ff"],
];

function Demo() {
  const [debug, setDebug] = useState(true);
  const [pulse, setPulse] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setPulse((value) => value + 1), 2400);
    return () => clearInterval(timer);
  }, []);
  return (
    <GlassProvider debug={debug} className="scene">
      <PipelineControls />
      <div className="ambient ambient-a" /><div className="ambient ambient-b" />
      <GlassSurface className="desktop-nav" borderRadius={26}>
        <a className="brand" href="#top">ULG</a>
        <nav aria-label="Primary"><a href="#work">Optics</a><a href="#details">Runtime</a><a href="#support">Support</a></nav>
        <button onClick={() => setDebug((value) => !value)}>{debug ? "Hide metrics" : "Show metrics"}</button>
      </GlassSurface>
      <GlassSurface className="mobile-nav" borderRadius={23}><span className="brand">ULG</span><button aria-label="Open menu">Menu</button></GlassSurface>
      <GlassSurface className="mobile-footer" borderRadius={28}>
        <a href="#top">Home</a><a href="#work">Optics</a><a href="#details">Speed</a>
      </GlassSurface>

      <main id="top">
        <section className="hero">
          <p className="eyebrow">One renderer · ordinary React DOM</p>
          <h1>Glass that actually<br /><em>bends the page.</em></h1>
          <p className="lede">Scroll the typography and color boundaries beneath the navigation. The curved edge shifts them optically instead of merely blurring them.</p>
          <div className="rings" aria-hidden="true"><i /><i /><i /><i /></div>
        </section>
        <section className="ticker" aria-label="Live changing content"><span>DOM UPDATE {pulse}</span><span>REFRACT · SCATTER · TRANSMIT ·</span></section>
        <section id="work" className="grid">
          {cards.map(([title, a, b], index) => <article key={title} style={{ "--a": a, "--b": b } as CSSProperties}><span>0{index + 1}</span><h2>{title}</h2><p>Sharp rules and contrasting gradients make lens displacement easy to verify.</p></article>)}
        </section>
        <section id="details" className="statement"><p>PERFORMANCE FIRST</p><h2>When the page gets busy,<br />the glass gets cheaper.</h2><div className="steps"><span>HIGH</span><b>→</b><span>MEDIUM</span><b>→</b><span>LOW</span><b>→</b><span>CSS</span></div></section>
        <section id="support" className="bands"><div>CHROMIUM</div><div>SAFARI</div><div>FIREFOX</div></section>
      </main>
    </GlassProvider>
  );
}

function PipelineControls() {
  const renderer = useGlassRenderer();
  const [view, setView] = useState<GlassDebugView>("normal");
  useEffect(() => renderer?.setDebugView(view), [renderer, view]);
  return (
    <aside data-liquid-glass-debug className="pipeline-controls">
      <strong>Backdrop pipeline</strong>
      {(["sample", "exaggerated", "normal"] as GlassDebugView[]).map((mode) => (
        <button key={mode} aria-pressed={view === mode} onClick={() => setView(mode)}>{mode}</button>
      ))}
    </aside>
  );
}

createRoot(document.getElementById("root")!).render(<StrictMode><Demo /></StrictMode>);
