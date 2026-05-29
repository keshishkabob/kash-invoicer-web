"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  { href: "/time-log",  label: "Time Log" },
  { href: "/invoices",  label: "Invoices" },
  { href: "/payments",  label: "Payments" },
  { href: "/clients",   label: "Clients" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <header className="border-b bg-white">
      <div className="max-w-6xl mx-auto px-4 flex items-center gap-8 h-14">
        <span className="font-semibold text-sm tracking-tight">Kash DataWorks</span>
        <nav className="flex gap-1">
          {links.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                pathname.startsWith(href)
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
