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
    <div className="bg-white shadow-md rounded-2xl p-5 flex flex-col lg:flex-row gap-5 hover:shadow-lg transition">
      <Image
        src={imageSrc}
        width={500}
        height={400}
        alt={imageAlt}
        className="rounded-xl object-cover w-auto h-auto md:h-[400px] lg:w-[400px] lg:h-auto"
      />
      <div className="my-5 mx-5 flex flex-col justify-center">
        <div className="flex flex-row items-center mb-4">
          {icon}
          <h2 className="ml-5 text-3xl md:text-4xl font-semibold text-primary-darkgreen">
            {title}
          </h2>
        </div>
        <p className="text-xl md:text-2xl mb-2 text-neutral-black/90 font-roboto leading-relaxed">
          {description}
        </p>
      </div>
    </div>
  );
}