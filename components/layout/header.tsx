import { auth, signOut } from "@/auth";
import Link from "next/link";
import { Button } from "../ui/button";

export default async function Header() {
  const session = await auth();

  return (
    <header className="border-b">
      <nav className="container mx-auto flex items-center justify-between p-4">
        <Link href="/" className="text-2xl font-bold">
          Sauna Boys
        </Link>
        <div className="flex items-center gap-4">
          {session?.user ? (
            <>
              <Link href="/dashboard">Dashboard</Link>
              <form
                action={async () => {
                  "use server";
                  await signOut();
                }}
              >
                <Button type="submit" variant="ghost">Logout</Button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login">Login</Link>
              <Link href="/signup">
                <Button>Registrieren</Button>
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
