import React from "react";

const Footer: React.FC = () => {
  return (
    <footer className="mt-auto border-t py-6 flex flex-col items-center gap-3">
      <a
        href="https://ayus.pro"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-lg bg-muted/50 px-3.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors duration-200"
      >
        Powered by
        <img src="/AYUS Circular.png" alt="AYUS" className="h-5 w-5 rounded-full" />
      </a>
      <p className="text-[11px] text-muted-foreground">
        © 2026 <span className="font-semibold text-foreground">StickyBadge</span>
      </p>
    </footer>
  );
};

export default Footer;
