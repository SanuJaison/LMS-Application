import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'KIDE CRM — Admin Portal',
  description: 'Kerala Institute Field CRM',
  icons: {
    icon: '/images/logo.png',
  },
};

/**
 * Applies the saved theme before the first paint so there is no flash of the
 * wrong theme. Dark is the default; light is opt-in via the theme toggle.
 */
const themeScript = `
(function () {
  try {
    var stored = localStorage.getItem('theme');
    var root = document.documentElement;
    if (stored === 'light') {
      root.classList.remove('dark');
    } else {
      root.classList.add('dark');
    }
  } catch (e) {}
})();
`;

/**
 * Some browser autofill/password-manager extensions stamp a `fdprocessedid`
 * attribute onto buttons and inputs before React hydrates. The server markup
 * never has it, so React logs a noisy "Extra attributes from the server"
 * warning in development. This removes that extension-only marker as it
 * appears; it has no effect on the app itself.
 */
const extensionAttrScript = `
(function () {
  try {
    var ATTR = 'fdprocessedid';
    var strip = function (node) {
      if (!node || node.nodeType !== 1) return;
      if (node.hasAttribute && node.hasAttribute(ATTR)) node.removeAttribute(ATTR);
      if (node.querySelectorAll) {
        var list = node.querySelectorAll('[' + ATTR + ']');
        for (var i = 0; i < list.length; i++) list[i].removeAttribute(ATTR);
      }
    };
    strip(document.documentElement);
    var observer = new MutationObserver(function (records) {
      for (var i = 0; i < records.length; i++) {
        var record = records[i];
        if (record.type === 'attributes' && record.attributeName === ATTR) {
          record.target.removeAttribute(ATTR);
        } else {
          for (var j = 0; j < record.addedNodes.length; j++) strip(record.addedNodes[j]);
        }
      }
    });
    observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: [ATTR]
    });
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark min-h-screen" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.bunny.net" />
        <link href="https://fonts.bunny.net/css?family=inter:400,500,600,700&display=swap" rel="stylesheet" />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: extensionAttrScript }} />
      </head>
      <body className="min-h-screen font-sans antialiased bg-app text-ink transition-colors duration-200">
        {children}
      </body>
    </html>
  );
}
