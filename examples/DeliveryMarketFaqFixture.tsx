const items = [
  { question: "Which delivery option should I choose?", answer: "Choose Vilnius delivery for the fixed hub option, or door-to-door when you want the local leg included to the final handover address." },
  { question: "Is the displayed route final?", answer: "The route and estimate are used for booking. Operational timing can still be refined when the driver is assigned and pickup is confirmed." },
  { question: "What happens after I choose?", answer: "Your selected route and price are carried into the next step, where you sign in and continue the booking." },
];

export interface DeliveryMarketFaqFixtureProps {
  active: number;
  expanded: boolean;
  onToggle?: () => void;
  mirrored?: boolean;
}

export const deliveryFaqItemCount = items.length;

export function DeliveryMarketFaqFixture({ active, expanded, onToggle, mirrored = false }: DeliveryMarketFaqFixtureProps) {
  return <section className="delivery-faq-stage" aria-label={mirrored ? undefined : "Delivery Market FAQ live-DOM fixture"} aria-hidden={mirrored || undefined}><div className="delivery-faq-copy"><p>REAL APPLICATION DOM</p><h2>Delivery Market FAQ strip</h2><span>Scroll this stateful component beneath the fixed glass.</span></div><div data-journey-faq className="delivery-faq-strip"><button type="button" onClick={onToggle} aria-expanded={expanded} tabIndex={mirrored ? -1 : undefined} className="delivery-faq-trigger"><span className="delivery-faq-label">FAQ</span><span className="delivery-faq-question">{items[active]?.question}</span><span className="delivery-faq-count">{active + 1}/{items.length}</span><span className="delivery-faq-chevron" aria-hidden="true">{expanded ? "⌃" : "⌄"}</span></button><div className="delivery-faq-progress" aria-hidden="true"><i key={`${active}-${expanded}`} className={expanded ? "is-paused" : undefined} /></div>{expanded ? <div className="delivery-faq-expanded">{items.map((item) => <div key={item.question} className="delivery-faq-item"><p>{item.question}</p><span>{item.answer}</span></div>)}</div> : null}</div></section>;
}
