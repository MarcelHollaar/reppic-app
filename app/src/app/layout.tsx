"use client";

import React from "react";
import Script from "next/script";
import { Roboto } from "next/font/google";
import { Inter } from "next/font/google";
import ThemeProvider from "@/components/ThemeProvider";
import theme from "@/theme";
import { MaterialTailwindControllerProvider } from "@/context";
import InnerContent from "./content";
import { I18nextProvider } from 'react-i18next';
import i18next from '../lib/i18n';
import "react-calendar/dist/Calendar.css";
import "./globals.css";
import ScrollToTopButton from "@/utils/scrollToTop";
import {ChatButton} from "@/components/HegyGenButton";
import DesktopRecordingBridge from "@/components/DesktopRecordingBridge";

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700", "900"],
  display: "swap",
});

const inter = Inter({ subsets: ["latin"] });

function RootLayout({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <html lang="en">
      <head>
        {/* <Script
          defer
          data-site="YOUR_DOMAIN_HERE"
          src="https://api.nepcha.com/js/nepcha-analytics.js"
        /> */}

          {process.env.NEXT_PUBLIC_NODE_ENV !== "production" && (
              <meta name="robots" content="noindex, nofollow"/>
          )}
          {/* Hotjar Tracking Code for https://reppic.ai */}
        {process.env.NEXT_PUBLIC_NODE_ENV === "production" && (
          <Script id="hotjar" strategy="afterInteractive">
            {`
              (function(h,o,t,j,a,r){
                  h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};
                  h._hjSettings={hjid:6461193,hjsv:6};
                  a=o.getElementsByTagName('head')[0];
                  r=o.createElement('script');r.async=1;    
                  r.src=t+h._hjSettings.hjid+j+h._hjSettings.hjsv;
                  a.appendChild(r);
              })(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');
            `}
          </Script>
        )}
        {/* Render HeyGen script only if not in production */}
        {/*{process.env.NEXT_PUBLIC_NODE_ENV !== "production" && (*/}
        {/*  <Script id="heygen-streaming-embed" strategy="afterInteractive">*/}
        {/*    {`!function(window){const host="https://labs.heygen.com",url=host+"/guest/streaming-embed?share=eyJxdWFsaXR5IjoiaGlnaCIsImF2YXRhck5hbWUiOiJQZWRyb19DYXN1YWxMb29rX3B1YmxpYyIs%0D%0AInByZXZpZXdJbWciOiJodHRwczovL2ZpbGVzMi5oZXlnZW4uYWkvYXZhdGFyL3YzLzRjYTdlYjc0%0D%0ANDJmNzRmZTBiYmNjMjA1ZjNmZTZmMjcxXzU1OTAwL3ByZXZpZXdfdGFyZ2V0LndlYnAiLCJuZWVk%0D%0AUmVtb3ZlQmFja2dyb3VuZCI6ZmFsc2UsImtub3dsZWRnZUJhc2VJZCI6IjM4MjczNGQ0MjQxMTQz%0D%0AZjc4NDk2NTA5MDA4ODJiODA5IiwidXNlcm5hbWUiOiJiMmFjM2UxOTgyNzE0YzY1YTNjYTA1ODYy%0D%0AY2EzYTZmYyJ9&inIFrame=1",clientWidth=document.body.clientWidth,wrapDiv=document.createElement("div");wrapDiv.id="heygen-streaming-embed";const container=document.createElement("div");container.id="heygen-streaming-container";const stylesheet=document.createElement("style");stylesheet.innerHTML=\`\n  #heygen-streaming-embed {\n    z-index: 9999;\n    position: fixed;\n    left: 40px;\n    bottom: 40px;\n    width: 200px;\n    height: 200px;\n    border-radius: 50%;\n    border: 2px solid #fff;\n    box-shadow: 0px 8px 24px 0px rgba(0, 0, 0, 0.12);\n    transition: all linear 0.1s;\n    overflow: hidden;\n\n    opacity: 0;\n    visibility: hidden;\n  }\n  #heygen-streaming-embed.show {\n    opacity: 1;\n    visibility: visible;\n  }\n  #heygen-streaming-embed.expand {\n    \${clientWidth<540?"height: 266px; width: 96%; left: 50%; transform: translateX(-50%);":"height: 366px; width: calc(366px * 16 / 9);"}\n    border: 0;\n    border-radius: 8px;\n  }\n  #heygen-streaming-container {\n    width: 100%;\n    height: 100%;\n  }\n  #heygen-streaming-container iframe {\n    width: 100%;\n    height: 100%;\n    border: 0;\n  }\n  \`;const iframe=document.createElement("iframe");iframe.allowFullscreen=!1,iframe.title="Streaming Embed",iframe.role="dialog",iframe.allow="microphone",iframe.src=url;let visible=!1,initial=!1;window.addEventListener("message",(e=>{e.origin===host&&e.data&&e.data.type&&"streaming-embed"===e.data.type&&("init"===e.data.action?(initial=!0,wrapDiv.classList.toggle("show",initial)):"show"===e.data.action?(visible=!0,wrapDiv.classList.toggle("expand",visible)):"hide"===e.data.action&&(visible=!1,wrapDiv.classList.toggle("expand",visible)))})),container.appendChild(iframe),wrapDiv.appendChild(stylesheet),wrapDiv.appendChild(container),document.body.appendChild(wrapDiv)}(globalThis);`}*/}
        {/*  </Script>*/}
        {/*)}*/}
        <link rel="icon" type="image/png+xml" href="/img/favicon_reptune.png" />
        <title>
         { process.env.NEXT_PUBLIC_APP_NAME || "Reppic"}
        </title>
      </head>
      <body className={inter.className}>
         <I18nextProvider i18n={i18next}>
        <ThemeProvider value={theme}>
          <MaterialTailwindControllerProvider>
            <InnerContent>
              {children}
            </InnerContent>
            <ScrollToTopButton />
            <DesktopRecordingBridge />
          </MaterialTailwindControllerProvider>
        </ThemeProvider>
        </I18nextProvider>
      </body>
    </html>
  );
}

export default RootLayout;
