import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MemberList } from "./_components/member-list";
import { EventList } from "./_components/event-list";
import { ContentModeration } from "./_components/content-moderation";

export default async function AdminPage() {
  const session = await auth();
  const currentAdminId = session!.user!.id;

  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
  });

  const events = await prisma.event.findMany({
    orderBy: { date: 'desc' },
    include: {
      cookAssignment: { include: { user: true } },
    },
  });

  const recipes = await prisma.recipe.findMany({
    orderBy: { title: 'asc' },
  });

  const galleryItems = await prisma.galleryItem.findMany({
    orderBy: { id: 'desc' },
  });

  return (
    <Tabs defaultValue="members" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="members">Mitglieder</TabsTrigger>
        <TabsTrigger value="events">Events</TabsTrigger>
        <TabsTrigger value="content">Inhalte</TabsTrigger>
      </TabsList>
      <TabsContent value="members" className="mt-4">
        <MemberList users={users} currentAdminId={currentAdminId} />
      </TabsContent>
      <TabsContent value="events" className="mt-4">
        <EventList events={events} />
      </TabsContent>
      <TabsContent value="content" className="mt-4">
        <ContentModeration recipes={recipes} galleryItems={galleryItems} />
      </TabsContent>
    </Tabs>
  );
}
