import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface AuthCardProps {
    children: ReactNode;
    className?: string;
}

export default function AuthCard({ children, className }: AuthCardProps) {
    return (
        <div
            className={cn(
                "auth-card-anim w-full max-w-[420px] mx-auto bg-white shadow-lg rounded-lg p-8",
                className
            )}
        >
            {children}
        </div>
    );
}
