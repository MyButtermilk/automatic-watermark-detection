import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "../../styles/globals.css"; // Corrected path
import {NextIntlClientProvider} from 'next-intl';
import {getMessages} from 'next-intl/server';
import Header from '@/components/layout/header';
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Sauna Boys Club",
  description: "Jeden Mittwoch bei Niko",
};

export default async function RootLayout({
  children,
  params: {locale}
}: {
  children: React.ReactNode;
  params: {locale: string};
}) {
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body className={inter.className}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <div className="flex min-h-screen flex-col">
            <Header />
            <main className="flex-grow">{children}</main>
            <Toaster />
          </div>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
