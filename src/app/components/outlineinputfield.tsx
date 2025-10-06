import {ReactNode} from "react"

interface OutlineInputFieldProps {
    label?: string;
    placeholder_?: string;
}

export default function OutlineInputField({
    label,
    placeholder_,
}: OutlineInputFieldProps)
{
  return (
        <div className="flex flex-col space-y-1">
            <h3 className="text-neutral-black text-2xl font-medium font-roboto">
				{label}
			</h3>
            <input placeholder={placeholder_} className="
            bg-gray-100 border-1 border-neutral-grey rounded-lg
            text-xl py-3 pl-2 text-neutral-black
			placeholder:text-neutral-black/50 font-roboto
			focus:border-primary-green
            " />
        </div>
    )
}