"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useState } from "react";
import {
  Bell,
  Code2,
  Compass,
  LogOut,
  Menu,
  MessageSquare,
  Plus,
  User,
  X,
} from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import type { Session } from "next-auth";

export function Navbar() {
  const { data: session } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { unreadCount } = useNotifications();

  return (
    <nav className="sticky top-0 z-50 glass border-b border-gray-800/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center glow-indigo group-hover:bg-indigo-500 transition-colors">
              <Code2 size={16} className="text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight gradient-text">
              Pronnect
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            <NavLink href="/explore" icon={<Compass size={16} />}>
              Explore
            </NavLink>
            {session && (
              <>
                <NavLink href="/global-chat" icon={<MessageSquare size={16} />}>
                  Global Chat
                </NavLink>
                <NavLink href="/projects/new" icon={<Plus size={16} />}>
                  New Project
                </NavLink>
              </>
            )}
          </div>

          {/* Right side */}
          <div className="hidden md:flex items-center gap-3">
            {session?.user ? (
              <>
                {/* Notifications */}
                <Link
                  href="/notifications"
                  className="relative p-2 rounded-lg text-gray-400 hover:text-gray-100 hover:bg-gray-800 transition-all"
                >
                  <Bell size={18} />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 w-4 h-4 bg-indigo-500 rounded-full text-[10px] flex items-center justify-center font-bold text-white">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </Link>

                {/* Profile dropdown */}
                <UserMenu session={session} />
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/auth/login"
                  className="px-4 py-2 text-sm text-gray-300 hover:text-white transition-colors"
                >
                  Sign in
                </Link>
                <Link
                  href="/auth/register"
                  className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-all glow-indigo"
                >
                  Get Started
                </Link>
              </div>
            )}
          </div>

          {/* Mobile menu toggle */}
          <button
            id="mobile-menu-toggle"
            className="md:hidden p-2 text-gray-400 hover:text-white"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-gray-800 bg-gray-950 animate-slide-up">
          <div className="px-4 py-3 space-y-1">
            <MobileNavLink href="/explore" onClick={() => setMobileOpen(false)}>
              Explore
            </MobileNavLink>
            {session?.user && (
              <>
                <MobileNavLink href="/global-chat" onClick={() => setMobileOpen(false)}>
                  Global Chat
                </MobileNavLink>
                <MobileNavLink href="/projects/new" onClick={() => setMobileOpen(false)}>
                  New Project
                </MobileNavLink>
                {session.user.id && (
                  <MobileNavLink
                    href={`/profile/${session.user.id}`}
                    onClick={() => setMobileOpen(false)}
                  >
                    Profile
                  </MobileNavLink>
                )}
                <button
                  onClick={() => signOut()}
                  className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-gray-900 rounded-lg"
                >
                  Sign out
                </button>
              </>
            )}
            {!session && (
              <>
                <MobileNavLink href="/auth/login" onClick={() => setMobileOpen(false)}>
                  Sign in
                </MobileNavLink>
                <MobileNavLink href="/auth/register" onClick={() => setMobileOpen(false)}>
                  Get Started
                </MobileNavLink>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}

function NavLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-400 hover:text-gray-100 hover:bg-gray-800/60 rounded-lg transition-all"
    >
      {icon}
      {children}
    </Link>
  );
}

function MobileNavLink({
  href,
  onClick,
  children,
}: {
  href: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="block px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-900 rounded-lg"
    >
      {children}
    </Link>
  );
}

function UserMenu({ session }: { session: Session }) {
  const [open, setOpen] = useState(false);
  const user = session.user;
  const initials = user?.name?.slice(0, 2).toUpperCase() || "??";

  return (
    <div className="relative">
      <button
        id="user-menu-button"
        onClick={() => setOpen(!open)}
        className="w-9 h-9 rounded-full bg-indigo-700 flex items-center justify-center text-sm font-bold text-white hover:bg-indigo-600 transition-colors ring-2 ring-indigo-500/30 hover:ring-indigo-400/50"
      >
        {user?.image ? (
          <img
            src={user.image}
            alt={user.name || ""}
            className="w-full h-full rounded-full object-cover"
          />
        ) : (
          initials
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-12 z-20 w-56 glass-card shadow-xl animate-slide-up">
            <div className="px-4 py-3 border-b border-gray-700">
              <p className="text-sm font-medium text-gray-100 truncate">
                {user?.name}
              </p>
              <p className="text-xs text-gray-400 truncate">{user?.email}</p>
            </div>
            <div className="py-1">
              {user?.id && (
                <Link
                  href={`/profile/${user.id}`}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-800 transition-colors"
                >
                  <User size={15} />
                  View Profile
                </Link>
              )}
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-gray-800 transition-colors"
              >
                <LogOut size={15} />
                Sign out
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
