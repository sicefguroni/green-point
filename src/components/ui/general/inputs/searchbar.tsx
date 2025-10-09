import { Search } from "lucide-react";
import { useState } from "react";

// This search bar will automatically fill up any horizontal space in its container so put it in a div
// it has flex-1 enabled

interface SearchBarProps {
   placeholder?: string
}

export default function SearchBar({
  placeholder = "Search",
}: SearchBarProps)
{
  const [isFocused, setIsFocused] = useState(false)

  return <div className={` 
      bg-white/60 py-2 pl-3 pr-2 rounded-xl backdrop-blur-lg
      hover:bg-white/70 overflow-hidden transition-all duration-200 ease-in-out
      shadow-md shadow-neutral-300 
      ${isFocused ? "h-100" : "h-16"}`}>
      <div className="flex flex-row items-center space-x-2">
        <Search 
          size={30}
          className="text-neutral-black/80"
        />
        <input 
          placeholder={placeholder}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 150)}
          className="            
            flex-1
            rounded-lg
            pl-4 py-2                      
            text-xl text-neutral-black/80 font-roboto 
            placeholder:text-neutral-black/40
            border-none
            focus: outline-none focus:bg-white/30                        
          "          
        />            
      </div>
    </div>
}