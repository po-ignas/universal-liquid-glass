import { useEffect, useState } from "react";

type FaqItem = { question: string; answer: string };

const items: FaqItem[] = [
  {
    question: "Which delivery option should I choose?",
    answer: "Choose Vilnius delivery for the fixed hub option, or door-to-door when you want the local leg included to the final handover address.",
  },
  {
    question: "Is the displayed route final?",
    answer: "The route and estimate are used for booking. Operational timing can still be refined when the driver is assigned and pickup is confirmed.",
  },
  {
    question: "What happens after I choose?",
    answer: "Your selected route and price are carried into the next step, where you sign in and continue the booking.",
  },
];

/**
 * Realistic DOM stress fixture adapted from Delivery Market's
 * src/components/MobileJourneyFaqStrip.tsx. It deliberately keeps the same
 * state/timer/conditional rendering shape without importing app-specific
 * Tailwind tokens or lucide-react.
 */
export function DeliveryMarketFaqFixture() {
  const [expanded, setExpanded] = useState(false);
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (expanded || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setActive((value) => (value + 1) % items.length), 4000);
    return () => window.clearInterval(timer);
  }, [expanded]);

  return (
    <section className="delivery-faq-stage" aria-label="Delivery Market FAQ capture stress fixture">
      <div className="delivery-faq-copy">
        <p>REAL APPLICATION DOM</p>
        <h2>Delivery Market FAQ strip</h2>
        <span>Scroll this stateful component beneath the fixed glass. It reproduces the kind of DOM that exposed the integration bottleneck.</span>
      </div>
      <div data-journey-faq className="delivery-faq-strip">
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className="delivery-faq-trigger"
        >
          <span className="delivery-faq-label">FAQ</span>
          <span className="delivery-faq-question">{items[active]?.question}</span>
          <span className="delivery-faq-count">{active + 1}/{items.length}</span>
          <span className="delivery-faq-chevron" aria-hidden="true">{expanded ? "⌃" : "⌄"}</span>
        </button>
        {!expanded ? (
          <span className="delivery-faq-progress" aria-hidden="true">
            <span key={active} />
          </span>
        ) : null}
        {expanded ? (
          <div className="delivery-faq-expanded">
            {items.map((item) => (
              <div key={item.question} className="delivery-faq-item">
                <p>{item.question}</p>
                <span>{item.answer}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
