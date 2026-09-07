import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { GlassSurface, SvgLiveDomProvider } from "../src/index.js";
import { DeliveryMarketFaqFixture, deliveryFaqItemCount } from "./DeliveryMarketFaqFixture.js";
import "./demo.css";

function ExperimentContent({ active, expanded, onToggle }: { active: number; expanded: boolean; onToggle: () => void }) {
  return <main className="experiment-content">
    <section className="experiment-hero">
      <p>EXPERIMENT · poc/svg-live-dom</p>
      <h1>Can the browser<br /><em>bend living DOM?</em></h1>
      <div className="branch-banner">ONE MIRROR · TWO SURFACES · ZERO CAPTURES</div>
      <DeliveryMarketFaqFixture active={active} expanded={expanded} onToggle={onToggle} />
      <div className="test-rings" aria-hidden="true"><i /><i /><i /><i /></div>
    </section>
    <section className="stripe-field" aria-hidden="true"><strong>SCROLL THROUGH THE LENS</strong></section>
    <section className="finish-field" aria-hidden="true"><span>NO SCREENSHOT</span><span>NO WEBGL</span><span>LIVE SUBTREE</span></section>
  </main>;
}

function DemoNavigation() {
  return <>
    <header data-html2canvas-ignore="true" className="demo-site-header">
      <GlassSurface aria-hidden="true" borderRadius={26} className="demo-glass-presentation" />
      <strong>CARVA</strong>
      <nav aria-label="Demo navigation"><a href="#live">Live DOM</a><a href="#faq">FAQ</a><button type="button">Menu</button></nav>
    </header>
    <nav data-html2canvas-ignore="true" aria-label="Demo mobile navigation" className="demo-mobile-footer">
      <GlassSurface aria-hidden="true" borderRadius={24} className="demo-glass-presentation" />
      <button type="button">Home</button><button type="button">Routes</button><button type="button">FAQ</button><button type="button">More</button>
    </nav>
  </>;
}

function Demo() {
  const [active, setActive] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [displacement, setDisplacement] = useState(34);
  const [blur, setBlur] = useState(1.2);
  const [frost, setFrost] = useState(16);

  useEffect(() => {
    if (expanded || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setActive((value) => (value + 1) % deliveryFaqItemCount), 4000);
    return () => window.clearInterval(timer);
  }, [expanded]);

  return <SvgLiveDomProvider
    debug
    className="svg-poc"
    displacement={displacement}
    blur={blur}
    tint={`rgba(255,255,255,${frost / 100})`}
  >
    <DemoNavigation />
    <aside data-svg-live-ignore="" className="poc-note"><strong>poc/svg-live-dom</strong><span>shared viewport mirror</span><span>Timer: {active + 1}/{deliveryFaqItemCount} · FAQ {expanded ? "open" : "closed"}</span></aside>
    <aside data-svg-live-ignore="" className="poc-controls" aria-label="Glass effect controls">
      <strong>Glass parameters</strong>
      <label><span>Strength <b>{displacement}px</b></span><input type="range" min="0" max="100" value={displacement} onChange={(event) => setDisplacement(Number(event.target.value))} /></label>
      <label><span>Blur <b>{blur.toFixed(1)}px</b></span><input type="range" min="0" max="6" step="0.1" value={blur} onChange={(event) => setBlur(Number(event.target.value))} /></label>
      <label><span>Tint <b>{frost}%</b></span><input type="range" min="0" max="60" value={frost} onChange={(event) => setFrost(Number(event.target.value))} /></label>
    </aside>
    <ExperimentContent active={active} expanded={expanded} onToggle={() => setExpanded((value) => !value)} />
  </SvgLiveDomProvider>;
}

createRoot(document.getElementById("root")!).render(<StrictMode><Demo /></StrictMode>);
