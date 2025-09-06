# Sauna Boys Club - Web App

This is a full-stack web application for a private cooking club, built with Next.js, Prisma, NextAuth.js, and Tailwind CSS.

## Features

- Member authentication (Signup, Login, Logout)
- Event scheduling for weekly cooking nights
- RSVP system for events
- "I'm cooking" functionality to assign a cook to an event
- Collaborative shopping lists per event
- Recipe and photo gallery for each event
- Admin panel for user, event, and content management

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: Prisma with SQLite (Development)
- **Authentication**: NextAuth.js (Credentials Provider)
- **Styling**: Tailwind CSS with shadcn/ui
- **Deployment**: Vercel

## Getting Started

### 1. Prerequisites

- Node.js (v18 or later)
- npm

### 2. Installation

Clone the repository and install the dependencies:

```bash
git clone <repository_url>
cd sauna-boys-club
npm install
```

### 3. Environment Variables

Create a `.env` file in the root of the project by copying the example file:

```bash
cp .env.example .env
```

Then, fill in the required values in your new `.env` file:

- `DATABASE_URL`: Already set for SQLite.
- `AUTH_SECRET`: Generate a secret with `openssl rand -base64 32`.
- `CLOUDINARY_*` variables: Add your Cloudinary credentials. The `NEXT_PUBLIC_` variables should have the same values as their server-side counterparts.
- `CRON_SECRET`: A secure random string to protect the cron job endpoint.

### 4. Database Setup

Apply the database schema migrations:

```bash
npx prisma migrate dev
```

### 5. (Optional) Seeding the Database

The project includes a seed script to populate the database with test data.

**Note:** The execution of this script might fail in some environments due to issues with running local binaries. If it fails, you can skip this step and create users manually as described in the Admin Onboarding section.

```bash
npm run prisma:seed
```

### 6. Running the Development Server

Start the development server:

```bash
npm run dev
```

The application will be available at `http://localhost:3000`.

## Admin Onboarding

To create an admin user:

1.  **If the seed script was successful:** Log in with the credentials `admin@saunaboys.de` and password `password123`.
2.  **If the seed script failed:**
    -   Register a new user through the signup form.
    -   Open the database management UI: `npx prisma studio`.
    -   Navigate to the `User` model, find your newly created user, and change their `role` from `MEMBER` to `ADMIN`.
    -   Save the changes. You can now log in and access the `/admin` panel.
