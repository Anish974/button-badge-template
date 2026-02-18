import React from "react";
import { NavLink } from "react-router-dom";
import Footer from "./Footer";

const navItems = [
  { to: "/", label: "Badge Maker", icon: "🔘" },
  { to: "/sticker", label: "Sticker Maker", icon: "✨" },
];

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top Navigation Bar */}
      <nav className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="mx-auto max-w-6xl px-4 flex items-center justify-between h-14">
          {/* Brand */}
          <NavLink to="/" className="flex items-center gap-2.5 group">
            <img
              src="/AYUS Circular.png"
              alt="AYUS"
              className="h-8 w-8 rounded-full ring-2 ring-primary/30 group-hover:ring-primary/60 transition-all"
            />
            <span className="text-lg font-bold text-foreground tracking-tight">
              TimeStamper<span className="text-primary">.</span>
            </span>
          </NavLink>

          {/* Nav Links */}
          <div className="flex items-center gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  `px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  }`
                }
              >
                <span className="mr-1.5">{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
          </div>
        </div>
      </nav>

      {/* Page Content */}
      <main className="flex-1">{children}</main>

      {/* Footer */}
      <Footer />
    </div>
  );
};

export default Layout;
