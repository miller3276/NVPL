
import Link from "next/link";

export default function HomeButton() {
  return (
    <Link
      href="/"
      className="fixed bottom-6 left-6 z-[9999] flex items-center gap-2 rounded-xl border border-blue-400/30 bg-[#101a2d] px-5 py-3 text-sm font-bold text-white shadow-xl transition hover:bg-blue-600"
    >
      <span>←</span>
      HOME
    </Link>
  );
}
