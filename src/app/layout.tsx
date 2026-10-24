import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Login - kide_crm_backend',
  description: 'Kerala CRM Backend - Next.js, Node.js & MongoDB',
  icons: {
    icon: '/images/logo.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="min-h-screen">
      <head>
        <link rel="preconnect" href="https://fonts.bunny.net" />
        <link href="https://fonts.bunny.net/css?family=inter:400,500,600,700&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen font-sans antialiased bg-gray-50 dark:bg-gray-950 text-gray-950 dark:text-white transition-colors duration-200">
        {children}
      </body>
    </html>
  );
}
