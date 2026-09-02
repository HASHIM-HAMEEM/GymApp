import * as React from 'react';

export default function RootHTML({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover" />
        <title>Meridian Athletic Club</title>

        {/* General Sans — Indian Type Foundry / Fontshare (free) */}
        <link
          href="https://api.fontshare.com/v2/css?f[]=general-sans@400,500,600,700&display=swap"
          rel="stylesheet"
        />
        {/* Newsreader — Google Fonts (serif for editorial / notice body) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&display=swap"
          rel="stylesheet"
        />
        {/* IBM Plex Sans Arabic — for Arabic member names */}
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600&display=swap"
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
            background: #F5F3EC;
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
          /* Proper text selection color — forest tint */
          ::selection {
            background: rgba(45, 92, 72, 0.16);
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
