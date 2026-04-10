import LandingPageClient from "@/components/landing/landing-page-client";

/**
 * Server shell keeps the first HTML response small; interactive UI is in the client boundary.
 */
export default function LandingPage() {
  return (
    <main className="relative min-h-screen overflow-x-hidden bg-gradient-to-br from-white via-emerald-50/30 to-green-100 text-neutral-900 transition-colors dark:from-neutral-950 dark:via-emerald-950/40 dark:to-neutral-900 dark:text-neutral-50">
      <Navbar landing />

      <div className="pt-[4.5rem] sm:pt-24 pb-6 sm:pb-8">
        <section
          className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl"
          aria-labelledby="hero-heading"
        >
          <div className="flex flex-col lg:flex-row items-center justify-between gap-8 sm:gap-10 lg:gap-16 my-8 sm:my-12 lg:my-16">
            <div className="flex flex-col items-start gap-3 sm:gap-4 max-w-2xl w-full order-2 lg:order-1 min-w-0">
              <h1
                id="hero-heading"
                className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-semibold text-neutral-black dark:text-neutral-50 text-left leading-tight"
              >
                Turn Heat Maps
                <br />
                into <span className="text-primary-green">Green Maps</span>
              </h1>
              <p className="text-neutral-black/70 dark:text-neutral-300 text-base sm:text-lg lg:text-xl font-normal">
                Data-driven pathways to greener and healthier cities.
              </p>
              <Link
                href="/home_dashboard"
                className="inline-flex items-center justify-center gap-2 w-full sm:w-auto text-base sm:text-lg text-white bg-primary-green border-2 border-primary-green py-3 px-5 sm:px-6 rounded-full font-semibold mt-1 sm:mt-2 hover:bg-primary-green/90 hover:border-primary-green/90 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-green focus:ring-offset-2 dark:focus:ring-offset-neutral-950"
              >
                Get Started
                <ChevronRight size={20} aria-hidden />
              </Link>
              <div className="grid grid-cols-[1fr_1fr_1.4fr] sm:flex sm:flex-wrap gap-2 sm:gap-3 w-full mt-4 sm:mt-6">
                {FEATURE_PILLS.map(({ icon: Icon, label }, index) => (
                  <div
                    key={label}
                    className={`flex flex-col items-center justify-center text-primary-green/70 hover:text-primary-green/90 dark:text-emerald-300 dark:hover:text-emerald-200 bg-white/60 dark:bg-neutral-900/75 border border-primary-green/40 dark:border-emerald-500/30 rounded-lg min-h-[5.25rem] sm:min-h-[5rem] py-3 px-2 sm:px-2.5 gap-1.5 hover:shadow-md dark:hover:shadow-black/20 hover:-translate-y-0.5 transition-all duration-300 ${index === 2 ? "sm:min-w-[9rem]" : "sm:min-w-[7rem]"}`}
                  >
                    <Icon
                      size={22}
                      className="sm:w-6 sm:h-6 flex-shrink-0"
                      aria-hidden
                    />
                    <span className="text-xs sm:text-sm font-medium text-center leading-tight [word-break:break-word]">
                      {label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:gap-4 w-full max-w-[min(100%,430px)] order-1 lg:order-2 shrink-0 mx-auto lg:mx-0">
              <div className="flex flex-wrap justify-between items-center gap-2">
                <h2 className="text-neutral-black dark:text-neutral-50 text-lg sm:text-xl font-medium">
                  Mandaue City
                </h2>
                <span className="inline-flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-medium border-2 border-primary-green/50 dark:border-emerald-400/40 bg-white dark:bg-neutral-900 text-primary-green dark:text-emerald-300 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full">
                  <Leaf
                    size={18}
                    className="sm:w-5 sm:h-5 flex-shrink-0"
                    aria-hidden
                  />
                  GI = 0.94 (High)
                </span>
              </div>
              <div className="w-full h-[260px] sm:h-[320px] md:h-[380px] lg:w-[430px] lg:h-[480px] border-2 sm:border-4 border-primary-green/40 dark:border-emerald-500/30 overflow-hidden rounded-lg sm:rounded-xl shadow-xl shadow-black/5 dark:shadow-black/30 bg-white dark:bg-neutral-900">
                <BarangayProvider>
                  <MandaueMap settings={false} />
                </BarangayProvider>
              </div>
            </div>
          </div>
        </section>

        <section
          className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl mt-8 sm:mt-12 lg:mt-16"
          aria-label="Major features"
        >
          <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-neutral-black dark:text-neutral-50 mb-4 sm:mb-6 lg:mb-8">
            All major features
          </h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 lg:gap-4 list-none p-0 m-0">
            {MAJOR_FEATURES.map(({ icon: Icon, name }) => (
              <li
                key={name}
                className="flex items-center gap-2 sm:gap-3 rounded-lg bg-white/70 dark:bg-neutral-900/75 border border-primary-green/30 dark:border-neutral-700 px-3 sm:px-4 py-2.5 sm:py-3 text-neutral-black dark:text-neutral-100 hover:border-primary-green/50 dark:hover:border-emerald-400/50 hover:shadow-sm dark:hover:shadow-black/20 transition-colors"
              >
                <span className="flex-shrink-0 text-primary-green" aria-hidden>
                  <Icon size={20} className="sm:w-[22px] sm:h-[22px]" />
                </span>
                <span className="font-medium text-xs sm:text-sm lg:text-base min-w-0 break-words">
                  {name}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section
          className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl mt-8 sm:mt-12 lg:mt-16"
          aria-label="Features"
        >
          <div className="flex flex-col gap-5 sm:gap-6 lg:gap-8">
            {FEATURE_CARDS.map((card) => (
              <InfoCard
                key={card.title}
                imageSrc={card.imageSrc}
                imageAlt={card.imageAlt}
                icon={card.icon}
                title={card.title}
                description={card.description}
                priority={card.priority}
              />
            ))}
          </div>
        </section>

        <section
          className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl mt-6 sm:mt-8 pt-4 sm:pt-5 pb-4 border-t border-neutral-black/10 dark:border-white/10"
          aria-label="Credits"
        >
          <p className="text-primary-green dark:text-emerald-300 text-xs sm:text-sm font-semibold uppercase tracking-wider mb-1.5 sm:mb-2">
            Built by:
          </p>
          {/* Mobile: 2 rows (3 + 2 names), centered. Desktop: single line with bullets */}
          <div className="flex flex-col sm:hidden items-center gap-1.5 text-neutral-black/85 dark:text-neutral-300 text-xs">
            <div className="flex justify-center gap-x-4 sm:gap-x-6 gap-y-0">
              {APP_AUTHORS[0]}
              <span className="text-neutral-black/50 dark:text-neutral-500">·</span>
              {APP_AUTHORS[1]}
              <span className="text-neutral-black/50 dark:text-neutral-500">·</span>
              {APP_AUTHORS[2]}
            </div>
            <div className="flex justify-center gap-x-4 sm:gap-x-6 gap-y-0">
              {APP_AUTHORS[3]}
              <span className="text-neutral-black/50 dark:text-neutral-500">·</span>
              {APP_AUTHORS[4]}
            </div>
          </div>
          <p className="hidden sm:block text-neutral-black/85 dark:text-neutral-300 text-xs sm:text-sm text-center whitespace-nowrap overflow-x-auto [-webkit-overflow-scrolling:touch]">
            {APP_AUTHORS.join(" · ")}
          </p>
        </section>
      </div>
    </main>
  );
}
