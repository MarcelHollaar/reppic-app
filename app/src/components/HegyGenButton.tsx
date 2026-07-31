import React, { useState, useEffect } from 'react';

export const ChatButton = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [embedExists, setEmbedExists] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuth = () => {
      if (typeof window !== "undefined") {
        const token = localStorage.getItem("token");
        const userData = localStorage.getItem("user_data");

        if (token && userData) {
          try {
            const decodedToken = JSON.parse(atob(token.split(".")[1]));
            if (decodedToken.exp * 1000 > Date.now()) {
              setIsAuthenticated(true);
            } else {
              localStorage.removeItem("token");
              localStorage.removeItem("user_data");
              setIsAuthenticated(false);
            }
          } catch (error) {
            console.error("Error decoding token:", error);
            localStorage.removeItem("token");
            localStorage.removeItem("user_data");
            setIsAuthenticated(false);
          }
        } else {
          setIsAuthenticated(false);
        }
      }
    };

    checkAuth();

    const handleStorageChange = () => {
      checkAuth();
    };

    window.addEventListener('storage', handleStorageChange);
    
    const interval = setInterval(checkAuth, 1000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setEmbedExists(false);
      setIsOpen(false);
      return;
    }

    const checkEmbed = () => {
      const embedElement = document.querySelector('#heygen-streaming-embed.show');
      if (embedElement) {
        setEmbedExists(true);
        
        if (embedElement.classList.contains('active')) {
          setIsOpen(true);
        }
      } else {
        setEmbedExists(false);
        setTimeout(checkEmbed, 1000);
      }
    };
    
    checkEmbed();
  }, [isAuthenticated]);

  const handleChatClick = () => {
    const embedElement = document.querySelector('#heygen-streaming-embed.show');

    if (embedElement) {
      if (isOpen) {
        embedElement.classList.remove('active');
        setIsOpen(false);
      } else {
        embedElement.classList.add('active');
        setIsOpen(true);
      }
    }
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <button
      onClick={handleChatClick}
      disabled={!embedExists}
      style={{
        position: 'fixed',
        bottom: '65px',
        right: '65px',
        width: '64px',
        height: '64px',
        background: !embedExists 
          ? 'linear-gradient(135deg, #9ca3af, #6b7280)' 
          : isOpen 
            ? 'linear-gradient(135deg, #ef4444, #dc2626)' 
            : 'linear-gradient(135deg, #5870F6, #4f46e5)',
        borderRadius: '50%',
        border: '2px solid rgba(255, 255, 255, 0.9)',
        boxShadow: !embedExists 
          ? '0 4px 12px rgba(156, 163, 175, 0.3)' 
          : isOpen 
            ? '0 8px 25px rgba(239, 68, 68, 0.4)' 
            : '0 8px 25px rgba(88, 112, 246, 0.4)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: embedExists ? 'pointer' : 'not-allowed',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        opacity: embedExists ? 1 : 0.6,
        transform: 'scale(1)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)'
      }}
      onMouseEnter={(e) => {
        if (embedExists) {
          e.currentTarget.style.transform = 'scale(1.1)';
          if (!isOpen) {
            e.currentTarget.style.background = 'linear-gradient(135deg, #4f46e5, #4338ca)';
            e.currentTarget.style.boxShadow = '0 12px 35px rgba(88, 112, 246, 0.5)';
          }
        }
      }}
      onMouseLeave={(e) => {
        if (embedExists) {
          e.currentTarget.style.transform = 'scale(1)';
          if (!isOpen) {
            e.currentTarget.style.background = 'linear-gradient(135deg, #5870F6, #4f46e5)';
            e.currentTarget.style.boxShadow = '0 8px 25px rgba(88, 112, 246, 0.4)';
          }
        }
      }}
      aria-label={!embedExists ? "Loading chat..." : (isOpen ? "Close chat" : "Open chat")}
    >
      <svg
        style={{
          width: '28px',
          height: '28px',
          color: 'white',
          filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2))',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)'
        }}
        fill="currentColor"
        viewBox="0 0 24 24"
      >
        {isOpen ? (
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        ) : (
          <>
            <path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h4l4 4 4-4h4c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
            <path d="M16 18l-2-2-2 2 2-2 2 2z"/>
          </>
        )}
      </svg>
    </button>
  );
};