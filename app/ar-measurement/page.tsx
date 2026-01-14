import { ARMeasurement } from '@/components/ar/ARMeasurement';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Medição Volumétrica AR | MyInventory',
  description: 'Meça volumes de objetos usando Realidade Aumentada no seu iPhone',
  manifest: '/manifest.json',
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
};

export default function ARMeasurementPage() {
  return (
    <main className="w-full h-screen overflow-hidden">
      <ARMeasurement />
    </main>
  );
}
