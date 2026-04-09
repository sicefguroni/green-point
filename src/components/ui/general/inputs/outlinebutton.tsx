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
      className={`inline-flex h-12 min-h-12 min-w-[6.5rem] shrink-0 items-center justify-center gap-2 rounded-lg border border-neutral-grey bg-gray-100 px-4 py-2 font-poppins font-medium transition hover:bg-gray-200 sm:px-6 ${className ?? ""}`}
      {...props}
    >
      {icon}
      {text}
    </button>
  );
}
