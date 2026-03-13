import { ReactNode } from "react"

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
            className={`inline-flex items-center justify-center gap-2 px-6 py-3 bg-gray-100 border border-neutral-grey rounded-lg hover:bg-gray-200 transition font-poppins font-medium ${className ?? ""}`}
            {...props}
        >
            {icon}
            {text}
        </button>
    )
}