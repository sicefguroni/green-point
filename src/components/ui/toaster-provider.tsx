"use client";

import dynamic from "next/dynamic";

const Toaster = dynamic(
  () => import("sonner").then((m) => m.Toaster),
  { ssr: false },
);

/** Loads sonner in a separate chunk so the root layout parses slightly faster. */
export function AppToaster() {
  return (
    <Toaster
      position="top-center"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast: "font-poppins",
          title: "font-poppins",
          description: "font-poppins",
        },
      }}
    />
  );
}
