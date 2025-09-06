'use server';

import { signIn, auth } from '@/auth';
import { AuthError } from 'next-auth';
import { getTranslator } from 'next-intl/server';
import { revalidatePath } from 'next/cache';
import prisma, { Prisma } from './prisma';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { redirect } from 'next/navigation';

const SignupFormSchema = z.object({
  name: z.string().min(2, { message: 'Name muss mindestens 2 Zeichen lang sein.' }),
  email: z.string().email({ message: 'Bitte gib eine gültige E-Mail an.' }),
  password: z.string().min(6, { message: 'Passwort muss mindestens 6 Zeichen lang sein.' }),
});

export async function authenticate(
  prevState: string | undefined,
  formData: FormData,
) {
  const t = await getTranslator('de', 'AuthErrors');
  try {
    await signIn('credentials', formData);
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case 'CredentialsSignin':
          return t('CredentialsSignin');
        default:
          return t('Default');
      }
    }
    throw error;
  }
}

export async function signup(
  prevState: string | undefined,
  formData: FormData,
) {
  const t = await getTranslator('de', 'AuthErrors');
  const validatedFields = SignupFormSchema.safeParse(
    Object.fromEntries(formData.entries()),
  );

  if (!validatedFields.success) {
    return validatedFields.error.flatten().fieldErrors.map(e => e.join(', ')).join('; ');
  }

  const { name, email, password } = validatedFields.data;
  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return t('UserExists');
    }

    await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: hashedPassword,
      },
    });
  } catch (error) {
    console.error(error);
    return t('DatabaseError');
  }

  redirect('/login?message=Signup successful. Please log in.');
}

export async function assignCook(eventId: string) {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: 'Nicht autorisiert.' };
  }

  const userId = session.user.id;

  try {
    // Use a transaction to prevent race conditions
    const result = await prisma.$transaction(async (tx) => {
      const existingAssignment = await tx.cookAssignment.findUnique({
        where: { eventId },
      });

      if (existingAssignment) {
        throw new Error('Dieser Abend ist bereits vergeben.');
      }

      const newAssignment = await tx.cookAssignment.create({
        data: {
          eventId: eventId,
          userId: userId,
        },
      });
      return newAssignment;
    });

  } catch (error: any) {
    console.error(error);
    return { error: error.message || 'Datenbankfehler: Zuweisung fehlgeschlagen.' };
  }

  revalidatePath('/dashboard');
  return { success: true };
}

export async function submitRsvp(eventId: string, status: string) {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: 'Nicht autorisiert.' };
  }
  const userId = session.user.id;

  // Validate status
  const validStatuses = ["YES", "NO", "MAYBE"];
  if (!validStatuses.includes(status)) {
    return { error: 'Ungültiger Status.' };
  }

  try {
    await prisma.rSVP.upsert({
      where: {
        eventId_userId: {
          eventId: eventId,
          userId: userId,
        },
      },
      update: {
        status: status,
      },
      create: {
        eventId: eventId,
        userId: userId,
        status: status,
      },
    });

    revalidatePath(`/events/${eventId}`);
    revalidatePath('/dashboard'); // Also revalidate dashboard in case we show RSVP counts there
    return { success: true };

  } catch (error) {
    console.error(error);
    return { error: 'Datenbankfehler: RSVP konnte nicht gespeichert werden.' };
  }
}


const ShoppingItemSchema = z.object({
  name: z.string().min(1, { message: "Name darf nicht leer sein." }),
  quantity: z.string().optional(),
  unit: z.string().optional(),
});

export async function addShoppingItem(eventId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: 'Nicht autorisiert.' };
  }
  const userId = session.user.id;

  const validatedFields = ShoppingItemSchema.safeParse(
    Object.fromEntries(formData.entries()),
  );

  if (!validatedFields.success) {
    return { error: validatedFields.error.flatten().fieldErrors.map(e => e.join(', ')).join('; ') };
  }

  const { name, quantity, unit } = validatedFields.data;

  try {
    await prisma.shoppingItem.create({
      data: {
        eventId,
        name,
        quantity: quantity || null,
        unit: unit || null,
        createdBy: userId,
      },
    });

    revalidatePath(`/events/${eventId}`);
    return { success: true };

  } catch (error) {
    console.error(error);
    return { error: 'Datenbankfehler: Artikel konnte nicht hinzugefügt werden.' };
  }
}

export async function toggleShoppingItem(itemId: string, purchased: boolean, eventId: string) {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: 'Nicht autorisiert.' };
  }

  // The spec says "Alle Mitglieder dürfen abhaken". So no specific role check needed here.

  try {
    await prisma.shoppingItem.update({
      where: { id: itemId },
      data: { purchased },
    });

    revalidatePath(`/events/${eventId}`);
    return { success: true };

  } catch (error) {
    console.error(error);
    return { error: 'Datenbankfehler: Status konnte nicht geändert werden.' };
  }
}


import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export async function getCloudinarySignature() {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: 'Nicht autorisiert.' };
  }

  const timestamp = Math.round((new Date).getTime()/1000);

  const signature = cloudinary.utils.api_sign_request(
    {
      timestamp: timestamp,
      // You can add more parameters to sign here if needed
      // e.g., folder: 'sauna-boys'
    },
    process.env.CLOUDINARY_API_SECRET!
  );

  return { timestamp, signature };
}

export async function saveGalleryItem(eventId: string, publicId: string, url: string, caption?: string) {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: 'Nicht autorisiert.' };
  }
  const userId = session.user.id;

  try {
    await prisma.galleryItem.create({
      data: {
        eventId,
        publicId,
        url,
        caption: caption || null,
        createdBy: userId,
      },
    });

    revalidatePath(`/events/${eventId}`);
    return { success: true };

  } catch (error) {
    console.error(error);
    return { error: 'Datenbankfehler: Galerie-Eintrag konnte nicht gespeichert werden.' };
  }
}

// =================================================================
// ADMIN ACTIONS
// =================================================================

async function checkAdmin() {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') {
    throw new Error('Nicht autorisiert: Nur für Admins.');
  }
  return session;
}

export async function toggleUserActive(userId: string, active: boolean) {
  await checkAdmin();

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { active },
    });
    revalidatePath('/admin');
    return { success: true };
  } catch (error) {
    console.error(error);
    return { error: 'Datenbankfehler: Benutzerstatus konnte nicht geändert werden.' };
  }
}

export async function changeUserRole(userId: string, role: string) {
  await checkAdmin();

  if (role !== 'ADMIN' && role !== 'MEMBER') {
    return { error: 'Ungültige Rolle.' };
  }

  // Prevent admin from removing their own admin role if they are the last one
  if (role === 'MEMBER') {
    const session = await auth();
    if (session?.user?.id === userId) {
      const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } });
      if (adminCount <= 1) {
        return { error: 'Kann die Rolle des letzten Admins nicht entfernen.' };
      }
    }
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { role },
    });
    revalidatePath('/admin');
    return { success: true };
  } catch (error) {
    console.error(error);
    return { error: 'Datenbankfehler: Benutzerrolle konnte nicht geändert werden.' };
  }
}

export async function resetRsvpsForEvent(eventId: string) {
  await checkAdmin();
  try {
    const { count } = await prisma.rSVP.deleteMany({
      where: { eventId },
    });
    revalidatePath('/admin');
    revalidatePath(`/events/${eventId}`);
    return { success: true, message: `${count} RSVPs zurückgesetzt.` };
  } catch (error) {
    console.error(error);
    return { error: 'Datenbankfehler: RSVPs konnten nicht zurückgesetzt werden.' };
  }
}

export async function clearCookAssignment(eventId: string) {
  await checkAdmin();
  try {
    await prisma.cookAssignment.delete({
      where: { eventId },
    });
    revalidatePath('/admin');
    revalidatePath(`/events/${eventId}`);
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error) {
    // It's possible no assignment exists, so we can ignore "not found" errors.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      revalidatePath('/admin');
      return { success: true, message: 'Keine Zuweisung zum Entfernen gefunden.' };
    }
    console.error(error);
    return { error: 'Datenbankfehler: Koch konnte nicht entfernt werden.' };
  }
}


export async function deleteGalleryItem(id: string) {
  await checkAdmin();
  try {
    const item = await prisma.galleryItem.findUnique({ where: { id } });
    if (!item) {
      return { error: 'Galerie-Eintrag nicht gefunden.' };
    }

    if (item.publicId) {
      await cloudinary.uploader.destroy(item.publicId);
    }
    await prisma.galleryItem.delete({ where: { id } });

    revalidatePath('/admin');
    revalidatePath(`/events/${item.eventId}`);
    return { success: true };
  } catch (error) {
    console.error(error);
    return { error: 'Datenbankfehler: Galerie-Eintrag konnte nicht gelöscht werden.' };
  }
}

export async function deleteRecipe(id: string) {
  await checkAdmin();
  try {
    await prisma.recipe.delete({ where: { id } });
    revalidatePath('/admin');
    return { success: true };
  } catch (error) {
    console.error(error);
    return { error: 'Datenbankfehler: Rezept konnte nicht gelöscht werden.' };
  }
}
