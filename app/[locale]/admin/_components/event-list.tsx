"use client";

import { useTransition } from "react";
import type { Event, CookAssignment, User } from "@prisma/client";
import { clearCookAssignment, resetRsvpsForEvent } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { Toaster } from "@/components/ui/toaster";

// Define a more specific type for the event data, including the cook and their user record
type EventWithCook = Event & {
  cookAssignment: (CookAssignment & { user: User }) | null;
};

interface EventListProps {
  events: EventWithCook[];
}

const formatDate = (date: Date) => new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' }).format(date);

export function EventList({ events }: EventListProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleResetRsvp = (eventId: string) => {
    if (confirm("Sollen wirklich alle RSVPs für dieses Event zurückgesetzt werden?")) {
      startTransition(async () => {
        const result = await resetRsvpsForEvent(eventId);
        if (result.error) {
          toast({ variant: "destructive", title: "Fehler", description: result.error });
        } else {
          toast({ title: "Erfolg", description: result.message });
        }
      });
    }
  };

  const handleClearCook = (eventId: string) => {
    if (confirm("Soll der Koch für diesen Abend wirklich entfernt werden?")) {
      startTransition(async () => {
        const result = await clearCookAssignment(eventId);
        if (result.error) {
          toast({ variant: "destructive", title: "Fehler", description: result.error });
        } else {
          toast({ title: "Erfolg", description: "Koch wurde entfernt." });
        }
      });
    }
  };

  return (
    <div className="rounded-lg border">
      <Toaster />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Datum</TableHead>
            <TableHead>Koch</TableHead>
            <TableHead className="text-right">Aktionen</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {events.map((event) => (
            <TableRow key={event.id}>
              <TableCell>{formatDate(event.date)}</TableCell>
              <TableCell>{event.cookAssignment?.user.name || <span className="text-muted-foreground">N/A</span>}</TableCell>
              <TableCell className="text-right space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleResetRsvp(event.id)}
                  disabled={isPending}
                >
                  RSVPs zurücksetzen
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleClearCook(event.id)}
                  disabled={isPending || !event.cookAssignment}
                >
                  Koch entfernen
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
