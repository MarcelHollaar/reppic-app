"use client";
import React, { useEffect, useState } from "react";
import VideoPlayerContainer from "@/components/development/VideoPlayerContainer";
import { useBreadcrumb } from "@/context/BreadcrumbContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useTranslation } from "react-i18next";

export default function SalesTrainerPage() {
  const { t } = useTranslation("common");


  useEffect(() => {
    const script = document.createElement('script');
    script.innerHTML = `
      !function(window){
        const host="https://labs.heygen.com";
        const url=host+"/guest/streaming-embed?share=eyJxdWFsaXR5IjoiaGlnaCIsImF2YXRhck5hbWUiOiJQZWRyb19DYXN1YWxMb29rX3B1YmxpYyIsInByZXZpZXdJbWciOiJodHRwczovL2ZpbGVzMi5oZXlnZW4uYWkvYXZhdGFyL3YzLzRjYTdlYjc0NDJmNzRmZTBiYmNjMjA1ZjNmZTZmMjcxXzU1OTAwL3ByZXZpZXdfdGFyZ2V0LndlYnAiLCJuZWVkUmVtb3ZlQmFja2dyb3VuZCI6ZmFsc2UsImtub3dsZWRnZUJhc2VJZCI6IjM4MjczNGQ0MjQxMTQzZjc4NDk2NTA5MDA4ODJiODA5IiwidXNlcm5hbWUiOiJiMmFjM2UxOTgyNzE0YzY1YTNjYTA1ODYyY2EzYTZmYyJ9&inIFrame=1";
        const clientWidth=document.body.clientWidth;
        const wrapDiv=document.createElement("div");
        wrapDiv.id="heygen-streaming-embed";
        const container=document.createElement("div");
        container.id="heygen-streaming-container";
        const stylesheet=document.createElement("style");
        stylesheet.innerHTML=\`
          #heygen-streaming-embed {
            z-index: 1;
            position: relative;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            border-radius: 8px;
            border: 0;
            overflow: hidden;
            opacity: 1;
            visibility: visible;
          }
          
          @media (max-width: 768px) {
            #heygen-streaming-embed {
              height: 100%;
              border-radius: 0;
            }
          }
          
          #heygen-streaming-container {
            width: 100%;
            height: 100%;
          }
          
          #heygen-streaming-container iframe {
            width: 100%;
            height: 100%;
            border: 0;
            border-radius: 8px;
          }
          
          @media (max-width: 768px) {
            #heygen-streaming-container iframe {
              border-radius: 0;
            }
            
            #heygen-streaming-embed-container {
              min-height: 500px !important;
              height: 500px !important;
              border-radius: 0 !important;
            }
          }
        \`;
        const iframe=document.createElement("iframe");
        iframe.allowFullscreen=false;
        iframe.title="Streaming Embed";
        iframe.role="dialog";
        iframe.allow="microphone; camera; autoplay";
        iframe.src=url;
        
        let visible=false;
        let initial=false;
        
        window.addEventListener("message",(e=>{
          if(e.origin===host&&e.data&&e.data.type&&"streaming-embed"===e.data.type){
            if("init"===e.data.action){
              initial=true;
              wrapDiv.classList.add("show");
            } else if("show"===e.data.action){
              visible=true;
              wrapDiv.classList.add("expand");
            } else if("hide"===e.data.action){
              visible=false;
              wrapDiv.classList.remove("expand");
            }
          }
        }));
        
        container.appendChild(iframe);
        wrapDiv.appendChild(stylesheet);
        wrapDiv.appendChild(container);
        
        const targetContainer = document.getElementById('heygen-streaming-embed-container');
        if (targetContainer) {
          targetContainer.innerHTML = '';
          targetContainer.appendChild(wrapDiv);
        }
      }(window);
    `;
    
    setTimeout(() => {
      document.head.appendChild(script);
    }, 100);
    
    return () => {
      const embed = document.getElementById('heygen-streaming-embed');
      if (embed) {
        embed.remove();
      }
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);

  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 769;

  if (isMobile) {
    return (
      <div className="tw-mt-4">
        <div className="tw-flex tw-flex-row tw-justify-between">
          <h2 className="tw-ml-0 tw-text-3xl tw-font-medium tw-mb-5">
            {t("salesTrainer.title")}
          </h2>
        </div>
        
        <div 
          id="heygen-streaming-embed-container" 
          className="tw-w-full tw-h-[500px] tw-bg-black tw-overflow-hidden"
          style={{ 
            minHeight: "500px"
          }}
        />
        
       
        <div className="tw-flex tw-justify-center tw-mt-6">
          <button
            onClick={() => window.location.href = '/dashboard'}
            className="tw-bg-red-600 hover:tw-bg-red-700 tw-text-white tw-font-medium tw-py-3 tw-px-6 tw-rounded-lg tw-shadow-md hover:tw-shadow-lg tw-transition-all tw-duration-200"
          >
            {t("salesTrainer.endChat")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <VideoPlayerContainer
      title={t("salesTrainer.titleWithName")}
      category={t("salesTrainer.category")}
      showNavigation={false}
      showBackButton={false}
    >
      <div 
        id="heygen-streaming-embed-container" 
        className="tw-w-full tw-h-full tw-bg-black"
        style={{ 
          minHeight: "400px"
        }}
      />
    </VideoPlayerContainer>
  );
}
