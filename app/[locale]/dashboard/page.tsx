import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { EventGrid } from "./_components/event-grid";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    // This should not happen due to middleware, but it's good practice
    return <p>Nicht autorisiert.</p>;
  }

  const events = await prisma.event.findMany({
    where: {
      date: {
        gte: new Date(),
      },
    },
    orderBy: {
      date: 'asc',
    },
    take: 8,
    include: {
      cookAssignment: {
        include: {
          user: true,
        },
      },
    },
  });

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-4">Willkommen, {session.user.name}!</h1>
      <h2 className="text-2xl font-semibold mb-6">Die nächsten Kochabende</h2>

      {events.length === 0 ? (
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6 mt-6">
          <p>Keine bevorstehenden Events gefunden.</p>
          <p className="text-sm text-muted-foreground">
            Die Datenbank ist leer, da das Seed-Skript nicht ausgeführt werden konnte.
          </p>
        </div>
      ) : (
        <EventGrid events={events} />
      )}
    </div>
  );
}
