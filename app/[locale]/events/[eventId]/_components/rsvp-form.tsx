"use client";

import { submitRsvp } from "@/lib/actions";
import { Button } from "@/components/ui/button";

export function RsvpForm({ eventId, currentUserRsvp }: { eventId: string, currentUserRsvp?: string | null }) {
  // We use .bind to pre-fill the arguments for the server action
  const submitRsvpYes = submitRsvp.bind(null, eventId, "YES");
  const submitRsvpNo = submitRsvp.bind(null, eventId, "NO");
  const submitRsvpMaybe = submitRsvp.bind(null, eventId, "MAYBE");

  return (
    <div className="flex items-center gap-4">
      <p className="text-sm font-medium">Deine Antwort:</p>
      <form action={submitRsvpYes}>
        <Button type="submit" variant={currentUserRsvp === 'YES' ? 'default' : 'outline'}>
          Ja
        </Button>
      </form>
      <form action={submitRsvpNo}>
        <Button type="submit" variant={currentUserRsvp === 'NO' ? 'destructive' : 'outline'}>
          Nein
        </Button>
      </form>
      <form action={submitRsvpMaybe}>
        <Button type="submit" variant={currentUserRsvp === 'MAYBE' ? 'secondary' : 'outline'}>
          Vielleicht
        </Button>
      </form>
    </div>
  );
}
