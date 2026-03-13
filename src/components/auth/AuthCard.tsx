import { ReactNode } from "react";

interface AuthCardProps {
    children: ReactNode;
}

export default function AuthCard({ children }: AuthCardProps) {
    return (
        <div className="w-full max-w-[420px] mx-auto bg-white shadow-lg rounded-lg p-8">
            {children}
        </div>
    );
}
