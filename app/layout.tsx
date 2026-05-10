import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Homepage Audit | CorZen',
  description: 'Get a full conversion audit of your homepage — 6-section weighted scoring, before/after headline rewrite, and a prioritized action plan — in minutes.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://api.fontshare.com/v2/css?f[]=satoshi@400,500,600,700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
