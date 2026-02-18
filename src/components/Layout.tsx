import React from "react";
import { NavLink } from "react-router-dom";
import Footer from "./Footer";
import ThemeToggle from "./ThemeToggle";

const navItems = [
  {
    to: "/",
    label: "Badge Maker",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="4" />
      </svg>
    ),
  },
  {
    to: "/sticker",
    label: "Sticker Maker",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
      </svg>
    ),
  },
];

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Navigation */}
      <nav className="glass sticky top-0 z-50 border-b">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 flex items-center justify-between h-14">
          {/* Brand */}
          <NavLink to="/" className="flex items-center gap-2.5 group">
            <img
              src="/StickyBadge.png"
              alt="StickyBadge"
              className="h-8 w-8 rounded-lg transition-transform duration-200 group-hover:scale-110"
            />
            <span className="text-base font-extrabold text-foreground tracking-tight hidden sm:block">
              StickyBadge
            </span>
          </NavLink>

          {/* Center Nav */}
          <div className="flex items-center bg-muted/60 rounded-lg p-0.5 gap-0.5">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] font-semibold transition-all duration-200 ${
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-background/60"
                  }`
                }
              >
                {item.icon}
                <span className="hidden sm:inline">{item.label}</span>
              </NavLink>
            ))}
          </div>

          {/* Theme toggle */}
          <ThemeToggle />
        </div>
      </nav>

      {/* Page */}
      <main className="flex-1">{children}</main>

      <Footer />
    </div>
  );
};

export default Layout;
