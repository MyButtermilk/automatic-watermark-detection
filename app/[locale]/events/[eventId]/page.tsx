import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import { RsvpForm } from "./_components/rsvp-form";
import { RecipeDisplay } from "./_components/recipe-display";
import { ShoppingList } from "./_components/shopping-list";
import { GalleryView } from "./_components/gallery-view";
import { ImageUploader } from "./_components/image-uploader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AnimatedSection } from "./_components/animated-section";
import { Separator } from "@/components/ui/separator"; // I need to create this

// Helper function to format the date
const formatDate = (date: Date) => {
  return new Intl.DateTimeFormat('de-DE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(date));
};

export default async function EventDetailPage({ params }: { params: { eventId: string } }) {
  const session = await auth();
  const userId = session?.user?.id;

  const event = await prisma.event.findUnique({
    where: { id: params.eventId },
    include: {
      cookAssignment: { include: { user: true } },
      RSVPs: { include: { user: true }, orderBy: { updatedAt: 'desc' } },
      recipe: true,
      shoppingItems: { orderBy: { purchased: 'asc', name: 'asc' } },
      galleryItems: { orderBy: { id: 'desc' } },
    },
  });

  if (!event) {
    notFound();
  }

  const currentUserRsvp = event.RSVPs.find(rsvp => rsvp.userId === userId);

  return (
    <div className="container mx-auto py-12 max-w-4xl">
      {/* Header Section */}
      <div className="text-center mb-12">
        <p className="text-primary font-semibold tracking-wide uppercase">{formatDate(event.date)}</p>
        <h1 className="text-4xl md:text-5xl font-bold mt-2">{event.title}</h1>
        {event.cookAssignment && (
          <p className="text-lg text-muted-foreground mt-4">
            Gekocht von: <strong>{event.cookAssignment.user.name}</strong>
          </p>
        )}
      </div>

      {/* Main Content Sections */}
      <div className="space-y-12">
        <AnimatedSection>
          <Card>
            <CardHeader>
              <CardTitle>Deine Teilnahme</CardTitle>
              <CardDescription>Kommst du diesen Mittwoch?</CardDescription>
            </CardHeader>
            <CardContent>
              <RsvpForm eventId={event.id} currentUserRsvp={currentUserRsvp?.status} />
            </CardContent>
          </Card>
        </AnimatedSection>

        <Separator />

        {event.recipe && (
          <AnimatedSection>
            <RecipeDisplay recipe={event.recipe} />
          </AnimatedSection>
        )}

        <Separator />

        <AnimatedSection>
          <ShoppingList eventId={event.id} items={event.shoppingItems} />
        </AnimatedSection>

        <Separator />

        <AnimatedSection>
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-center">Galerie</h2>
            <ImageUploader eventId={event.id} />
            <GalleryView items={event.galleryItems} />
          </div>
        </AnimatedSection>
      </div>
    </div>
  );
}
