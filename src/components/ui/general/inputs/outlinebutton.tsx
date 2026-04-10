import { ReactNode } from "react";

interface OutlineButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  text?: string;
  icon?: ReactNode;
}

export default function OutlineButton({
  text,
  icon,
  className,
  ...props
}: OutlineButtonProps) {
  return (
    <button
      className={`inline-flex h-12 min-h-12 min-w-[6.5rem] shrink-0 items-center justify-center gap-2 rounded-lg border border-neutral-grey bg-gray-100 dark:bg-neutral-900 dark:border-neutral-700 px-4 py-2 font-poppins font-medium text-neutral-black dark:text-neutral-100 transition hover:bg-gray-200 dark:hover:bg-neutral-800 sm:px-6 ${className ?? ""}`}
      {...props}
    >
      {icon}
      {text}
    </button>
  );
}
