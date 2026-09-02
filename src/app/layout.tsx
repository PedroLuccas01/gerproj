import type { Metadata } from "next";
import { Geist } from "next/font/google";
import localFont from "next/font/local";
import { AppFrame } from "@/components/AppFrame";
import { AuthProvider } from "@/lib/auth";
import { FeedbackProvider } from "@/lib/feedback";
import { StoreProvider } from "@/lib/store";
import { ThemeProvider } from "@/lib/theme";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const ethnocentric = localFont({
  src: "../fonts/Ethnocentric-Regular.otf",
  variable: "--font-ethnocentric",
  display: "swap",
});

const vipnagorgialla = localFont({
  src: "../fonts/Vipnagorgialla-Rg-It.otf",
  variable: "--font-vipna",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://capsulatecnologia.com.br"),
  title: "Gestão de Projetos",
  description: "CAPSULA Tecnologia",
  icons: {
    icon: [
      { url: "/favicon.ico?v=2", sizes: "any" },
      { url: "/icon.png?v=2", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png?v=2" }],
  },
};

const themeInit = `(function(){try{var t=localStorage.getItem("pdef-theme");if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}if(t==="dark")document.documentElement.classList.add("dark");document.documentElement.style.colorScheme=t}catch(e){}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${ethnocentric.variable} ${vipnagorgialla.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className="min-h-full bg-page font-sans text-ink">
        <ThemeProvider>
          <FeedbackProvider>
            <AuthProvider>
              <StoreProvider>
                <AppFrame>{children}</AppFrame>
              </StoreProvider>
            </AuthProvider>
          </FeedbackProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
