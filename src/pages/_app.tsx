import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { Inter, Fira_Code } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const firaCode = Fira_Code({
  subsets: ["latin"],
  variable: "--font-fira-code",
});

export default function App({ Component, pageProps }: AppProps) {
  return (
    <div className={`${inter.variable} ${firaCode.variable}`}>
      <Component {...pageProps} />
    </div>
  );
}
