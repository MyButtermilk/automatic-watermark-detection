"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { AssignCookForm } from "./assign-cook-form";
import type { Event, CookAssignment, User } from "@prisma/client";

// Define a more specific type for the event data
type EventWithCook = Event & {
  cookAssignment: (CookAssignment & { user: User }) | null;
};

interface EventGridProps {
  events: EventWithCook[];
}

const formatDate = (date: Date) => new Intl.DateTimeFormat('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(date));

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
  },
};

export function EventGrid({ events }: EventGridProps) {
  return (
    <motion.div
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {events.map((event) => (
        <motion.div key={event.id} variants={itemVariants} className="h-full">
          <Link href={`/events/${event.id}`} className="block h-full">
            <Card className="flex flex-col h-full">
              <CardHeader>
                <CardTitle>{formatDate(event.date)}</CardTitle>
                <CardDescription>{event.location}</CardDescription>
              </CardHeader>
              <CardContent className="flex-grow">
                {event.cookAssignment ? (
                  <div>
                    <p className="font-semibold">Koch des Abends:</p>
                    <p>{event.cookAssignment.user.name}</p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Noch kein Koch für diesen Abend.</p>
                )}
              </CardContent>
              <CardFooter>
                {!event.cookAssignment && (
                  <div onClick={(e) => e.stopPropagation()}>
                    <AssignCookForm eventId={event.id} />
                  </div>
                )}
              </CardFooter>
            </Card>
          </Link>
        </motion.div>
      ))}
    </motion.div>
  );
}
