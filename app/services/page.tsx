import type { Metadata } from 'next';
import { OfferingPage } from '@/components/offering-page';

export const metadata: Metadata = {
  title: 'Services',
  description: 'Explore Truora’s planned nursing, physiotherapy and recovery coordination services. Coming soon to Mumbai.',
  alternates: { canonical: '/services' },
};

export default function Services() {
  return <OfferingPage
    label="AT-HOME SERVICES"
    title="Care that comes to you."
    subtitle="Support that comes together."
    description="Nursing, physiotherapy and a named coordinator, brought into one package around your surgery and your treating team’s instructions."
    heading="A team around your recovery."
    items={[
      { title: 'Nursing care.', text: 'Planned nursing visits as part of your recovery package. The care required and visit schedule will be confirmed around your discharge instructions.' },
      { title: 'Physiotherapy.', text: 'At-home physiotherapy organised around your surgery, with your treating team’s guidance at the centre of the recovery plan.' },
      { title: 'Care coordination.', text: 'A named coordinator to help connect care visits, equipment and supplies. One person for your family to contact.' },
    ]}
  />;
}
