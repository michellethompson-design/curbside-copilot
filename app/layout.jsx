import './globals.css';

export const metadata = {
  title: 'ABCD — design asset screening',
  description:
    'A cold, outside-eye QA pass for design assets. Catches accidental suggestive imagery before it ships.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
