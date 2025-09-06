import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Function to get the next N Wednesdays
function getNextNWednesdays(n: number): Date[] {
  const dates: Date[] = [];
  let today = new Date();
  // Find the next Wednesday
  let daysUntilWednesday = (3 - today.getDay() + 7) % 7;
  if (daysUntilWednesday === 0 && today.getHours() >= 19) { // If it's Wednesday past 7 PM, start from next week
    daysUntilWednesday = 7;
  }
  let nextWednesday = new Date(today);
  nextWednesday.setDate(today.getDate() + daysUntilWednesday);
  nextWednesday.setHours(19, 0, 0, 0); // Set time to 19:00

  for (let i = 0; i < n; i++) {
    const wednesday = new Date(nextWednesday.getTime());
    wednesday.setDate(wednesday.getDate() + (i * 7));
    dates.push(wednesday);
  }
  return dates;
}


async function main() {
  console.log('Start seeding...');

  // 1. Clear database
  console.log('Clearing existing data...');
  // Delete in an order that respects foreign key constraints
  await prisma.rSVP.deleteMany();
  await prisma.shoppingItem.deleteMany();
  await prisma.galleryItem.deleteMany();
  await prisma.cookAssignment.deleteMany();
  await prisma.event.deleteMany();
  await prisma.recipe.deleteMany();
  await prisma.account.deleteMany();
  await prisma.session.deleteMany();
  await prisma.verificationToken.deleteMany();
  await prisma.user.deleteMany();
  console.log('Data cleared.');


  // 2. Create users
  console.log('Creating users...');
  const hashedPassword = await bcrypt.hash('password123', 10);
  const users = await Promise.all([
    prisma.user.create({
      data: {
        name: 'Niko (Admin)',
        email: 'admin@saunaboys.de',
        passwordHash: hashedPassword,
        role: 'ADMIN',
      },
    }),
    prisma.user.create({
      data: {
        name: 'Ben',
        email: 'ben@saunaboys.de',
        passwordHash: hashedPassword,
      },
    }),
    prisma.user.create({
      data: {
        name: 'Hans',
        email: 'hans@saunaboys.de',
        passwordHash: hashedPassword,
      },
    }),
    prisma.user.create({
      data: {
        name: 'Tom',
        email: 'tom@saunaboys.de',
        passwordHash: hashedPassword,
      },
    }),
    prisma.user.create({
      data: {
        name: 'Jan',
        email: 'jan@saunaboys.de',
        passwordHash: hashedPassword,
      },
    }),
  ]);
  console.log(`Created ${users.length} users.`);
  const adminUser = users[0];
  const regularUser = users[1];

  // 3. Create one recipe
  console.log('Creating recipe...');
  const recipe = await prisma.recipe.create({
    data: {
      title: 'Spaghetti Carbonara Originale',
      description: 'Ein klassisches römisches Gericht, schnell und einfach.',
      ingredients: JSON.stringify([
        '200g Guanciale',
        '350g Spaghetti',
        '4 Eigelb',
        '50g Pecorino Romano',
        'Schwarzer Pfeffer',
      ]),
      steps: JSON.stringify([
        'Guanciale in Würfel schneiden und in einer Pfanne knusprig braten.',
        'Spaghetti kochen.',
        'Eigelb und Pecorino vermischen.',
        'Spaghetti zum Guanciale geben, Pfanne vom Herd nehmen, Ei-Käse-Mischung unterrühren.',
        'Mit viel Pfeffer servieren.',
      ]),
    }
  });
  console.log(`Created recipe: ${recipe.title}`);

  // 4. Create events
  console.log('Creating events...');
  const wednesdays = getNextNWednesdays(12);
  const events = await Promise.all(
    wednesdays.map((date, i) =>
      prisma.event.create({
        data: {
          date: date,
          // Assign a cook to the first event
          cookAssignment: i === 0 ? {
            create: { userId: adminUser.id }
          } : undefined,
          // Add recipe to the first event
          recipeId: i === 0 ? recipe.id : undefined,
        },
      })
    )
  );
  console.log(`Created ${events.length} events.`);
  const firstEvent = events[0];

  // 5. Create shopping items for the first event
  console.log('Creating shopping items...');
  await prisma.shoppingItem.createMany({
    data: [
      { eventId: firstEvent.id, name: 'Guanciale', quantity: '200g', createdBy: adminUser.id },
      { eventId: firstEvent.id, name: 'Spaghetti', quantity: '1 Packung', createdBy: adminUser.id },
      { eventId: firstEvent.id, name: 'Eier', quantity: '6 Stück', createdBy: adminUser.id },
    ],
  });
  console.log('Created 3 shopping items.');


  // 6. Create gallery items for the first event
  console.log('Creating gallery items...');
  await prisma.galleryItem.createMany({
    data: [
      {
        eventId: firstEvent.id,
        publicId: 'sauna_boys/sample1', // Placeholder
        url: 'https://placehold.co/600x400/000000/FFFFFF/png?text=Sauna+Boys+1',
        caption: 'Der Abend war ein voller Erfolg!',
        createdBy: regularUser.id,
      },
      {
        eventId: firstEvent.id,
        publicId: 'sauna_boys/sample2', // Placeholder
        url: 'https://placehold.co/600x400/orange/white/png?text=Lecker!',
        caption: 'Das Essen war fantastisch.',
        createdBy: adminUser.id,
      },
    ],
  });
  console.log('Created 2 gallery items.');

  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
