import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// This function finds the date of the *next* upcoming Wednesday.
// If today is Monday, it finds the Wednesday of this week.
// If today is Thursday, it finds the Wednesday of next week.
const getUpcomingWednesday = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayOfWeek = today.getDay(); // Sunday = 0, Wednesday = 3

    // Days to add to get to the next Wednesday
    // If today is Mon (1), add 2 days.
    // If today is Tue (2), add 1 day.
    // If today is Wed (3), add 0 days (it's this coming Wednesday).
    // If today is Thu (4), add 6 days.
    const daysToAdd = (3 - dayOfWeek + 7) % 7;

    const upcomingWednesday = new Date(today);
    upcomingWednesday.setDate(today.getDate() + daysToAdd);

    return upcomingWednesday;
};


export async function POST(request: Request) {
  const cronSecret = request.headers.get('x-cron-secret');

  if (cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const upcomingWednesday = getUpcomingWednesday();

    // Find the event that corresponds to the upcoming Wednesday.
    // The event date has a time component, so we search for the whole day.
    const startOfDay = new Date(upcomingWednesday);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(upcomingWednesday);
    endOfDay.setHours(23, 59, 59, 999);

    const event = await prisma.event.findFirst({
      where: {
        date: {
          gte: startOfDay,
          lt: endOfDay,
        }
      }
    });

    if (!event) {
      console.log(`Cron job: No event found for upcoming Wednesday ${upcomingWednesday.toDateString()}.`);
      return NextResponse.json({ message: 'No event found for the upcoming Wednesday.' });
    }

    // Delete all RSVPs for that event
    const { count } = await prisma.rSVP.deleteMany({
      where: {
        eventId: event.id,
      },
    });

    console.log(`Cron job: Successfully reset ${count} RSVPs for event on ${event.date.toDateString()}.`);
    return NextResponse.json({ message: `Successfully reset ${count} RSVPs for event on ${event.date.toDateString()}.` });

  } catch (error) {
    console.error('Cron job failed:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
