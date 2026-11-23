import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ChromaFract Studio — AI Synesthetic Fractal Visualizer',
  description:
    'Next-generation WebGL2 GLSL audio-reactive 2D/3D fractal music visualizer, AI visual choreography studio, and 16:9 / 9:16 YouTube video exporter.',
  openGraph: {
    title: 'ChromaFract Studio — AI Synesthetic Fractal Visualizer',
    description:
      'Next-generation WebGL2 GLSL audio-reactive 2D/3D fractal music visualizer, AI visual choreography studio, and 16:9 / 9:16 YouTube video exporter.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ChromaFract Studio — AI Synesthetic Fractal Visualizer',
    description:
      'Next-generation WebGL2 GLSL audio-reactive 2D/3D fractal music visualizer, AI visual choreography studio, and 16:9 / 9:16 YouTube video exporter.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body
        suppressHydrationWarning
        className="bg-zinc-950 text-zinc-100 font-sans antialiased overflow-hidden"
      >
        {children}
      </body>
    </html>
  );
}
