import React, { useEffect, useState } from "react";

const ScrollToTopButton: React.FC = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > 200);
    };
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <button
      aria-label="Scroll to top"
      onClick={scrollToTop}
      className={`
        tw-fixed tw-bottom-8 tw-right-8 tw-z-50 tw-bg-transparent tw-rounded-full tw-shadow-lg
        tw-flex tw-items-center tw-justify-center tw-transition-opacity tw-duration-300
        ${visible ? "tw-opacity-100" : "tw-opacity-0 tw-pointer-events-none"}
        hover:tw-bg-blue-100
      `}
      style={{ width: 48, height: 48 }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="tw-h-12 tw-w-12"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle cx="12" cy="12" r="11" stroke="rgb(88,112,246)" strokeWidth="1" fill="none" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12l4-4 4 4" stroke="rgb(88,112,246)" strokeWidth="1" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V8" stroke="rgb(88,112,246)" strokeWidth="1" />
      </svg>
    </button>
  );
};

export default ScrollToTopButton;