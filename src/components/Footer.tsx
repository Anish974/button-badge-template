import React from "react";

const Footer: React.FC = () => {
  return (
    <footer className="mt-12 bg-gradient-to-b from-background to-[#0f1729] py-10 flex flex-col items-center gap-4">
      <a
        href="https://ayus.pro"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-full bg-[#1a2236] px-5 py-2.5 ring-1 ring-purple-500/30 shadow-[0_0_20px_rgba(168,85,247,0.15)] transition-shadow hover:shadow-[0_0_28px_rgba(168,85,247,0.25)]"
      >
        <span className="text-sm font-medium text-gray-300">Powered By</span>
        <img src="/AYUS Circular.png" alt="AYUS" className="h-8 w-8 rounded-full" />
      </a>
      <p className="text-sm text-gray-400">
        © 2026 <span className="font-semibold text-gray-200">TimeStamper</span>. All rights reserved.
      </p>
      <div className="mt-2 h-px w-24 bg-gray-700" />
    </footer>
  );
};

export default Footer;
