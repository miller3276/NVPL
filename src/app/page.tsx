
import Link from "next/link";

const regions = [
  { name: "OCEANIA", code: "OCE", divisions: "Coming soon" },
  { name: "EUROPE", code: "EU", divisions: "Coming soon" },
  { name: "NORTH AMERICA", code: "NA", divisions: "Coming soon" },
];

const features = [
  ["01", "COMPETITIONS", "Regional leagues, divisions and tournaments."],
  ["02", "LIVE STATISTICS", "Track goals, assists, saves and player performances."],
  ["03", "TEAM MANAGEMENT", "Manage squads, registrations and transfers."],
  ["04", "PLAYER RANKINGS", "Discover the best players across every region."],
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#080b12] text-white">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#080b12]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-600 text-2xl font-black italic">
              N
            </div>
            <div>
              <div className="text-xl font-black tracking-widest">NVPL</div>
              <div className="text-[9px] tracking-[3px] text-gray-400">
                NATIONAL VIRTUAL PRO LEAGUE
              </div>
            </div>
          </Link>

          <nav className="hidden items-center gap-8 text-sm font-semibold text-gray-300 md:flex">
            <a href="#regions" className="hover:text-blue-400">REGIONS</a>
            <a href="#competitions" className="hover:text-blue-400">COMPETITIONS</a>
            <a href="#features" className="hover:text-blue-400">PLATFORM</a>
          </nav>

          <a href="#regions" className="rounded-lg bg-blue-600 px-5 py-3 text-xs font-bold tracking-wider hover:bg-blue-500">
            EXPLORE NVPL
          </a>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_75%_30%,rgba(37,99,235,0.22),transparent_55%)]" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-6 py-28 md:grid-cols-2 md:py-36">
          <div>
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-xs font-bold tracking-widest text-blue-400">
              <span className="h-2 w-2 rounded-full bg-blue-400" />
              THE NEXT GENERATION OF PRO CLUBS
            </div>

            <h1 className="text-5xl font-black leading-[1.08] tracking-tight md:text-7xl">
              ONE GAME.
              <br />
              <span className="text-blue-500">THREE REGIONS.</span>
              <br />
              ONE COMMUNITY.
            </h1>

            <p className="mt-7 max-w-lg text-lg leading-8 text-gray-400">
              A competitive home for Pro Clubs. Discover competitions,
              represent your team and compete against the best.
            </p>

            <div className="mt-10 flex flex-wrap gap-4">
              <a href="#regions" className="rounded-lg bg-blue-600 px-7 py-4 text-sm font-bold tracking-wider hover:bg-blue-500">
                EXPLORE REGIONS →
              </a>
              <a href="#features" className="rounded-lg border border-white/20 px-7 py-4 text-sm font-bold tracking-wider hover:bg-white/10">
                DISCOVER NVPL
              </a>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 rounded-3xl bg-blue-600/20 blur-3xl" />
            <div className="relative rounded-2xl border border-white/10 bg-[#101827] p-8 shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/10 pb-6">
                <div className="text-xs font-bold tracking-[3px] text-gray-400">
                  NVPL NETWORK
                </div>
                <div className="text-xs font-bold text-blue-400">GLOBAL</div>
              </div>

              <div className="py-10 text-center">
                <div className="text-8xl font-black italic tracking-tighter text-blue-500">
                  NVPL
                </div>
                <p className="mt-3 text-xs tracking-[5px] text-gray-400">
                  BUILT FOR COMPETITION
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {regions.map((region) => (
                  <div key={region.code} className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
                    <div className="text-xl font-black text-white">{region.code}</div>
                    <div className="mt-2 text-[9px] font-bold tracking-wider text-gray-400">
                      {region.name}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="regions" className="mx-auto max-w-7xl px-6 py-24">
        <div className="mb-12">
          <p className="text-xs font-bold tracking-[4px] text-blue-400">COMPETE WORLDWIDE</p>
          <h2 className="mt-4 text-4xl font-black md:text-5xl">OUR REGIONS</h2>
          <p className="mt-4 text-gray-400">Three competitive regions. One connected platform.</p>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {regions.map((region, index) => (
            <div key={region.code} className="group rounded-2xl border border-white/10 bg-[#101827] p-8 transition hover:-translate-y-1 hover:border-blue-500/60">
              <div className="text-sm font-bold tracking-widest text-blue-400">
                REGION 0{index + 1}
              </div>
              <div className="my-8 text-6xl font-black tracking-tight">
                {region.code}
              </div>
              <h3 className="text-xl font-extrabold">{region.name}</h3>
              <p className="mt-3 text-sm text-gray-400">{region.divisions}</p>
              <div className="mt-8 border-t border-white/10 pt-5 text-sm font-bold text-blue-400">
                COMING SOON
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="competitions" className="border-y border-white/10 bg-[#0d121d]">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-20 md:grid-cols-2 md:items-center">
          <div>
            <p className="text-xs font-bold tracking-[4px] text-blue-400">YOUR JOURNEY STARTS HERE</p>
            <h2 className="mt-5 text-4xl font-black md:text-5xl">
              BUILT FOR THE COMPETITIVE SCENE.
            </h2>
            <p className="mt-6 leading-8 text-gray-400">
              From league campaigns to individual player rankings,
              NVPL aims to bring the competitive Pro Clubs community
              together under one platform.
            </p>
          </div>
          <div className="rounded-2xl border border-blue-500/30 bg-blue-500/5 p-8">
            <div className="text-xs font-bold tracking-[3px] text-blue-400">THE NVPL STANDARD</div>
            <div className="mt-7 space-y-6">
              {["Competitive regional leagues", "Professional team profiles", "Detailed player statistics", "Community tournaments"].map((item) => (
                <div key={item} className="flex items-center gap-4 border-b border-white/10 pb-5">
                  <span className="text-blue-400">✦</span>
                  <span className="font-semibold">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-7xl px-6 py-24">
        <p className="text-xs font-bold tracking-[4px] text-blue-400">THE PLATFORM</p>
        <h2 className="mt-4 text-4xl font-black">EVERYTHING IN ONE PLACE.</h2>

        <div className="mt-12 grid gap-5 sm:grid-cols-2">
          {features.map(([number, title, description]) => (
            <div key={number} className="rounded-2xl border border-white/10 bg-[#101827] p-8 hover:border-blue-500/50">
              <div className="text-sm font-bold text-blue-400">{number}</div>
              <h3 className="mt-6 text-xl font-black">{title}</h3>
              <p className="mt-3 leading-7 text-gray-400">{description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-24">
        <div className="rounded-2xl bg-blue-600 px-8 py-14 text-center md:px-16">
          <p className="text-xs font-bold tracking-[4px] text-blue-100">NATIONAL VIRTUAL PRO LEAGUE</p>
          <h2 className="mt-5 text-4xl font-black md:text-6xl">THIS IS NVPL.</h2>
          <p className="mx-auto mt-5 max-w-xl text-blue-100">
            A new home for competitive Pro Clubs. Built for teams,
            players and the community.
          </p>
        </div>
      </section>

      <footer className="border-t border-white/10 px-6 py-8">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 text-sm text-gray-500 md:flex-row">
          <div className="font-black tracking-widest text-white">NVPL</div>
          <div>National Virtual Pro League © 2026</div>
          <div>ONE GAME. ONE COMMUNITY.</div>
        </div>
      </footer>
    </main>
  );
}
