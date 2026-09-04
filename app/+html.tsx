import * as React from 'react';

export default function RootHTML({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover" />
        <title>Meridian Athletic Club</title>

        {/* Fonts — Space Grotesk, Inter, JetBrains Mono, Newsreader, IBM Plex Sans Arabic */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;1,6..72,400&family=IBM+Plex+Sans+Arabic:wght@400;500;600&display=swap"
          rel="stylesheet"
        />

        <style dangerouslySetInnerHTML={{ __html: `
          html, body {
            height: 100%;
            margin: 0;
            padding: 0;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            text-rendering: optimizeLegibility;
          }
          body {
            overflow: hidden;
            background: #0A0A0A;
            color: #FAFAFA;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          }
          #root {
            display: flex;
            height: 100%;
            flex: 1;
          }
          /* Tabular numbers for stats / prices / dates */
          .num {
            font-variant-numeric: tabular-nums;
            font-feature-settings: 'tnum' 1;
          }
          /* Clean white text selection */
          ::selection {
            background: rgba(255, 255, 255, 0.16);
            color: #FFFFFF;
          }
          /* Hide scrollbars on web for native feel */
          ::-webkit-scrollbar { display: none; }
          * { scrollbar-width: none; }
        ` }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
