import Image from "next/image";
import { ReactNode } from "react";

interface InfoCardProps {
  imageSrc: string;
  imageAlt: string;
  icon?: ReactNode;
  title: string;
  description: string;
  priority?: boolean;
}

export default function InfoCard({
  imageSrc,
  imageAlt,
  icon,
  title,
  description,
  priority,
}: InfoCardProps) {
  return (
    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-md shadow-black/5 dark:shadow-black/20 rounded-lg p-5 flex flex-col lg:flex-row gap-6 hover:shadow-lg dark:hover:shadow-black/30 transition-colors">
      <div className="relative w-full aspect-[2/1] lg:w-[30%] flex-shrink-0">
        <Image
          src={imageSrc}
          alt={imageAlt}
          fill
          className="object-cover rounded-md"
          priority={priority}
        />
      </div>
      <div className="flex flex-col justify-center">
        <div className="flex flex-row items-center mb-4 gap-2">
          {icon}
          <h2 className="text-2xl font-semibold text-primary-darkgreen dark:text-emerald-300">
            {title}
          </h2>
        </div>
        <p className="text-lg text-neutral-black/90 dark:text-neutral-300 font-roboto leading-relaxed">
          {description}
        </p>
      </div>
    </div>
  );
}
