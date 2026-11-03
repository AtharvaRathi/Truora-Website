import { Button, ContactCTA, Eyebrow, Reveal } from '@/components/site';

type OfferingProps = {
  label: string;
  title: string;
  subtitle: string;
  description: string;
  heading: string;
  items: { title: string; text: string }[];
};

export function OfferingPage({ label, title, subtitle, description, heading, items }: OfferingProps) {
  return (
    <main id="main">
      <section className="page-hero">
        <div className="container">
          <Eyebrow light>{label} · COMING SOON</Eyebrow>
          <h1>{title}<br /><span>{subtitle}</span></h1>
          <p>{description}</p>
          <div className="page-hero-bottom">
            <span>Part of one coordinated recovery package.</span>
            <span className="status"><i /> Mumbai launch coming soon</span>
          </div>
        </div>
      </section>
      <section className="section">
        <div className="container">
          <Reveal className="section-heading">
            <Eyebrow>YOUR RECOVERY, CONNECTED</Eyebrow>
            <h2>{heading}</h2>
          </Reveal>
          <div className="values-grid">
            {items.map((item, index) => (
              <Reveal key={item.title} className="value-card">
                <span className="tiny-label">0{index + 1}</span>
                <h3 style={{ marginTop: 18 }}>{item.title}</h3>
                <p>{item.text}</p>
                <Button href={`/request?kind=service&subject=${encodeURIComponent(item.title)}`} secondary>Request information</Button>
              </Reveal>
            ))}
          </div>
          <p className="price-note">This is an introduction to our planned offering. Exact availability, inclusions and terms will be confirmed before agreement. Demo service requests can be saved in your account. No appointment or care is confirmed.</p>
          <div style={{ marginTop: 28 }}><Button href="/packages" secondary>Explore recovery packages</Button></div>
        </div>
      </section>
      <ContactCTA />
    </main>
  );
}
