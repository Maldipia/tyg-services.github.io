import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TYG POS — QR-Based POS for Philippine F&B',
  description: 'Scan, order, pay. Zero hardware. Built for Philippine cafés and restaurants.',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
  themeColor: '#16a34a',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans antialiased bg-gray-50 text-gray-900">
        {children}
      </body>
    </html>
  );
}
