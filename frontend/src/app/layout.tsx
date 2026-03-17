import './globals.css';
import { ReactNode } from 'react';

export const metadata = {
  title: 'StreetScope AI',
  description: 'Orlando business opportunity intelligence platform'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
