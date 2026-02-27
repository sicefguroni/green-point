import { ReactNode } from "react"

interface OutlineInputFieldProps {
    label?: string;
    placeholder_?: string;
    type?: string;
    value?: string;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    name?: string;
}

export default function OutlineInputField({
    label,
    placeholder_,
    type = "text",
    value,
    onChange,
    name,
}: OutlineInputFieldProps) {
    return (
        <div className="flex flex-col space-y-1">
            <h3 className="text-neutral-black text-2xl font-medium font-poppins">
                {label}
            </h3>
            <input type={type} name={name} value={value} onChange={onChange} placeholder={placeholder_} className="
            bg-gray-100 border-1 border-neutral-grey rounded-lg
            text-xl py-3 pl-2 text-neutral-black
			placeholder:text-neutral-black/50 font-poppins
			focus:border-primary-green
            " />
        </div>
    )
}