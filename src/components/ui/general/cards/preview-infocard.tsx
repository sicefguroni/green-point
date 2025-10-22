import Image from "next/image";
import { ReactNode } from "react";

interface InfoCardProps {
  imageSrc: string;
  imageAlt: string;
  icon?: ReactNode;
  title: string;
  description: string;
}

export default function InfoCard({
  imageSrc,
  imageAlt,
  icon,
  title,
  description,
}: InfoCardProps) 
{
  return (
    <div className="bg-white shadow-md rounded-lg p-5 flex flex-col lg:flex-row gap-6 hover:shadow-lg transition">
      <Image
        src={imageSrc}
        width={500}
        height={400}
        alt={imageAlt}
        className="rounded-md object-cover w-auto h-auto md:h-[400px] lg:w-[400px] lg:h-auto"
      />
      <div className="flex flex-col justify-center">
        <div className="flex flex-row items-center mb-4 gap-2">
          {icon}
          <h2 className="text-lg font-semibold text-primary-darkgreen">
            {title}
          </h2>
        </div>
        <p className="text-lg text-neutral-black/90 font-roboto leading-relaxed">
          {description}
        </p>
      </div>
    </div>
  );
}