import Link from "next/link";
import { SquaresFour, UserCircle } from "@phosphor-icons/react/dist/ssr";

export default function TopBar({
  userName,
  roleLabel,
  role,
  right,
}: {
  userName: string;
  roleLabel?: string;
  role?: "STUDENT" | "INSTRUCTOR" | "AUTHOR" | "ADMIN";
  right?: React.ReactNode;
}) {
  const links: { href: string; label: string }[] = [];
  if (role) links.push({ href: "/dashboard", label: roleLabel === "Mission Control" ? "Campaigns" : "Dashboard" });
  if (role === "INSTRUCTOR" || role === "ADMIN") links.push({ href: "/instructor", label: "Instructor" });
  if (role === "ADMIN") links.push({ href: "/admin", label: "Admin" });

  return (
    <header className="topbar">
      <div className="topbar__inner">
        <div className="topbar__identity">
          <Link href="/" className="brand-mark" aria-label="TestMe home">
            <SquaresFour size={18} weight="fill" aria-hidden="true" />
            <span>testme</span>
          </Link>
          {roleLabel && <span className="topbar__section">{roleLabel}</span>}
          {links.length > 0 && (
            <nav className="topbar__nav" aria-label="Primary navigation">
              {links.map((link) => (
                <Link key={link.href} href={link.href}>
                  {link.label}
                </Link>
              ))}
            </nav>
          )}
        </div>
        <div className="topbar__account">
          {right}
          <span className="topbar__user">
            <span>{roleLabel === "Mission Control" ? "Student" : roleLabel}: {userName}</span>
            <UserCircle size={20} weight="regular" aria-hidden="true" />
          </span>
          <form action="/auth/signout" method="post">
            <button type="submit" className="topbar__signout">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
