import Navbar from "@/components/ui/general/layout/navbar";

export default function MapPageLoading() {
  return (
    <main className="h-screen w-screen relative bg-white">
      <Navbar />  
      <div className="flex items-center justify-center">
        <span className="font-poppins text-lg text-neutral-black/80 font-medium w-full h-full">
          Loading...
        </span>
      </div>
    </main>
  );
}
