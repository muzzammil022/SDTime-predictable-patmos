import { Geist_Mono } from "next/font/google";
import dynamic from "next/dynamic";

const PatmosIDE = dynamic(() => import("@/components/PatmosIDE"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-screen bg-[#0d1117] text-[#8b949e] font-mono text-sm">
      Loading Patmos IDE…
    </div>
  ),
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function Home() {
  return (
    <div className={geistMono.className}>
      <PatmosIDE />
    </div>
  );
}

