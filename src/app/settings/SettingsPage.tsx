"use client";

import { useTheme } from "@/context/ThemeContext";
import Navbar from "@/components/ui/general/layout/navbar";
import { Moon, Sun } from "lucide-react";

export default function SettingsPage() {
  const { isDarkMode, toggleDarkMode } = useTheme();

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-950 dark:to-neutral-900 transition-colors">
      <Navbar />

      {/* Main Content */}
      <div className="pt-24 sm:pt-28 md:pt-32 px-4 sm:px-6 md:px-8 lg:px-10 pb-10">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-neutral-900 dark:text-white mb-2">
              Settings
            </h1>
            <p className="text-neutral-600 dark:text-neutral-400 text-sm sm:text-base">
              Customize your GreenPoint experience
            </p>
          </div>

          {/* Settings Cards */}
          <div className="space-y-4">
            {/* Dark Mode Setting */}
            <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-gradient-to-br from-neutral-100 to-neutral-200 dark:from-neutral-700 dark:to-neutral-600 rounded-lg">
                    {isDarkMode ? (
                      <Moon className="w-6 h-6 text-neutral-700 dark:text-yellow-300" />
                    ) : (
                      <Sun className="w-6 h-6 text-yellow-500" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">
                      Dark Mode
                    </h3>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400">
                      {isDarkMode
                        ? "Dark mode is enabled"
                        : "Light mode is enabled"}
                    </p>
                  </div>
                </div>

                {/* Toggle Switch */}
                <button
                  onClick={toggleDarkMode}
                  className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                    isDarkMode
                      ? "bg-primary-green"
                      : "bg-neutral-300 dark:bg-neutral-600"
                  }`}
                  role="switch"
                  aria-checked={isDarkMode}
                  aria-label="Toggle dark mode"
                >
                  <span
                    className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                      isDarkMode ? "translate-x-7" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Future Settings Placeholder */}
            <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-xl border border-dashed border-neutral-300 dark:border-neutral-700 p-6 text-center">
              <p className="text-neutral-500 dark:text-neutral-400 text-sm">
                More settings coming soon...
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
