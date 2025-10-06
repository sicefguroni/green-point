import {ReactNode} from "react"

interface OutlineButtonProps {
    text?: string;
    icon?: ReactNode;
}

export default function OutlineButton({
    text,
    icon,
}: OutlineButtonProps)
{
    return (
        <button className="items-center justify-center w-auto flex flex-1 
        flex-row px-10 py-3 bg-gray-100 border-1 border-neutral-grey rounded-lg
        hover:bg-gray-200 transition
        ">
            {icon}            
            {text}
        </button>
    )
}