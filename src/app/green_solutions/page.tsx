"use client"

import Navbar from "@/components/ui/general/layout/navbar"
import { MapPin, Trees, Flower, X, Cookie, ImageIcon, Camera} from "lucide-react"
import GreenSolutionCard from "@/components/ui/general/cards/greensolution-infocard"
import { useState, useRef} from "react"
import mapboxgl from "mapbox-gl"

import exifr from 'exifr'
import Image from "next/image" 

import dynamic from "next/dynamic";

const MapWrapper = dynamic(() => import("@/components/map/map_wrapper"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center">
      <div className="text-neutral-black/50">Loading map…</div>
    </div>
  ),
});

export default function GreenSolutionsPage() {
  const [selectedFeature, setSelectedFeature] = useState<any | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);

  function handleUploadClick() {
    fileInputRef.current?.click()
  }

  async function handleFileUploaded(e: React.ChangeEvent<HTMLInputElement>) { 
    const file = e.target.files?.[0]
    if(!file) return 

    const url = URL.createObjectURL(file)
    if(imageUrl) URL.revokeObjectURL(imageUrl)
    
    setImageUrl(url)
    setImageName(file.name)

    try {
      const gps = await exifr.gps(file)
      const imgLat = gps?.latitude ?? null
      const imgLng = gps?.longitude ?? null

      if (imgLat != null && imgLng != null) {
        console.log('Image GPS coordinates:', imgLat, imgLng)
        
        if(mapRef.current) {
          // teleport weee
          mapRef.current.flyTo({
            center: [imgLng, imgLat],
            zoom: 16,
            speed:1.2,
            curve: 1.5,
            essential: true,
          })

          if(markerRef.current) markerRef.current.remove();
          
          // add marker on point
          markerRef.current = new mapboxgl.Marker({color: "#DB4848"})
            .setLngLat([imgLng,imgLat])
            .addTo(mapRef.current)

          //get address
          const geocodeUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${imgLng},${imgLat}.json?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}`;
          let Imgaddress = "Unknown Address"
          try {
            const response = await fetch(geocodeUrl);
            const data = await response.json();
            if(data.features && data.features.length > 0) { 
              Imgaddress = data.features[0].place_name        
            } 
          } catch (error) {
            console.error("Error fetching address:", error)
          }

          setSelectedFeature({
            name:"Photo Location",
            address: Imgaddress,
            coords: {lng: imgLng, lat: imgLat}
          })
        }
        
      } else {
        alert('No GPS data found in this image.')
      }
    } catch (error) {
      console.error('Error reading EXIF data:', error)
    }
  }

  return (    
    <main className="min-h-screen w-screen relative bg-gradient-to-br from-white to-green-100">
      {/* top nav bar */}
      <Navbar />

      {/* this is the input button for the image upload, put it up here so all can access */}
      <input
        type="file"
        accept="image/*"
        ref={fileInputRef}
        onChange={handleFileUploaded}
        className="hidden"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 w-full h-[calc(100vh-8rem)] px-8 pb-8 pt-32">
        {/* Left Side */}
        <div className="flex flex-col space-y-4 pr-0 lg:pr-4 h-[calc(100vh-10rem)]">
          <div className="flex flex-col justify-between items-start
          lg:flex-row lg:items-center">
            <h1 className="text-neutral-black font-poppins font-bold text-2xl 
            whitespace-nowrap overflow-hidden text-ellipsis">
              Greening Suggestions
            </h1>
            {/* this should be a link -- will change later on */}
            <h2 className="text-primary-darkgreen underline font-roboto
            whitespace-nowrap overflow-hidden text-ellipsis"> 
              Browse sample interventions
            </h2>                        
          </div>

          <p className="text-neutral-black text-lg leading-tight text-justify">
          See what greening interventions are suitable for your selected area. These aim to reduce the effects of environmental hazards and improve livability.
          </p>

          <div className="flex flex-col bg-white/80 backdrop-blur-lg rounded-xl
          shadow-xl shadow-neutral-300 flex-1 max-
          p-4 space-y-3 overflow-hidden
          ">

            {/* Current Location  */}
            <div className="flex flex-row justify-between">
              <div className="flex items-center space-x-3 flex-row">
                <MapPin size={35} className="text-neutral-black shrink-0" />
                {
                  selectedFeature ? 
                  <div>
                    <p className="font-semibold text-lg text-neutral-black">
                        {selectedFeature.name}
                    </p>
                    <p className="text-md text-neutral-black/80 -mt-1 ">
                      {selectedFeature.address}
                    </p>
                  </div>
                  :
                  <div className="flex flex-row items-center gap-2">
                    <p className="font-medium text-lg text-neutral-black">
                        Please select a location on the map
                    </p>
                    <p className="font-medium text-lg text-neutral-black">
                      or
                    </p>
                    <button className="bg-neutral-200 font-medium font-poppins py-1 px-5 rounded-full
                    hover:bg-green-300 transition-all duration-150 hover:scale-105
                    "
                    onClick={handleUploadClick}
                    >
                      <div className="flex flex-row gap-3 items-center">
                        <Camera 
                          size={20}
                        />
                        <span>
                          Upload a Photo
                        </span>
                      </div>
                    </button>                    
                  </div>
                }
              </div> 
              <div 
              onClick={() => { setSelectedFeature(null)
                if(imageUrl) {
                  URL.revokeObjectURL(imageUrl)
                  setImageUrl(null)
                  setImageName(null)
                };
                
                if(markerRef.current) {
                  markerRef.current.remove();
                  markerRef.current = null;
                };
              }

              }
              className={`py-2 px-3 hover:bg-neutral-100 items-center rounded-full duration-200 transition-all
              ${selectedFeature ? 'flex' : 'hidden'}
              `}>
                <X 
                  size={25}
                  className="text-neutral-black/80"
                />
              </div>
            </div>

            <div className="-mx-4">
              <hr className="border-t border-1 border-neutral-black/30" />
            </div>            
            {
              selectedFeature ? 
              <div className=" flex-1 overflow-y-auto [scrollbar-width:none] pr-2">
                      
                <GreenSolutionCard 
                  solutionTitle="Street Trees"
                  solutionDescription="Trees planted along urban streets and walkways."
                  efficiencyLevel="Highly Efficient"
                  value={90}
                  icon={<Trees size={50} />}
                />

                <hr className="border-t border-1 border-neutral-black/20" />

                <GreenSolutionCard 
                  solutionTitle="Roof Gardens"
                  solutionDescription="Gardens grown on the rooftops of buildings."
                  efficiencyLevel="Moderately Efficient"
                  value={40}
                  icon={<Flower size={50} />}
                />

                <hr className="border-t border-1 border-neutral-black/20" />

                <GreenSolutionCard 
                  solutionTitle="Mixed Blue-Green Corridors"
                  solutionDescription="Urban pathways that combine water-based and vegetative features."
                  efficiencyLevel="Not Efficient"
                  value={30}
                  icon={<Cookie size={50} />}
                />
              </div>
              :
              <div className="flex items-center justify-center ">
                <span className="text-md font-roboto text-neutral-black/60 font-regular ">
                  Select a location or upload a geotagged photo to get started generating solutions!
                </span>
              </div>        
            }
          </div>   
        </div>       
        
        {/* Right Side */}
        <div className="bg-white/60 backdrop-blur-lg relative rounded-lg p-2">
          {/* map */}
          <MapWrapper 
            searchBoxLocation="absolute top-5 left-5 w-80 z-10"
            onFeatureSelected={(feature: any) => {
              setSelectedFeature(feature);

              //remove the image
              if(imageUrl) {
                URL.revokeObjectURL(imageUrl);
                setImageUrl(null);
                setImageName(null);
              };
              
              if(markerRef.current) {
                markerRef.current.remove();
                markerRef.current = null;
              };
            }}

            onMapReady={(mapInstance) => {mapRef.current = mapInstance}}
          />
    
          {/* overlays */}
          <div className="absolute top-2 right-2 m-4">
            {
              imageUrl ?
              <div className="flex flex-col bg-white/90 backdrop-blur-md max-w-xs max-h-xs p-2 rounded-md gap-1">
                <div className="flex flex-row justify-between items-center">
                  <span className="text-sm font-roboto text-center">
                    Uploaded Image
                  </span>
                  <div 
                  onClick={() => { setSelectedFeature(null)
                    if(imageUrl) {
                      URL.revokeObjectURL(imageUrl)
                      setImageUrl(null)
                      setImageName(null)
                    };

                    if(markerRef.current) {
                      markerRef.current.remove();
                      markerRef.current = null;
                    };
                  }}
                  className="p-1 flex hover:bg-neutral-200 items-center rounded-full duration-200 transition-all">
                    <X 
                      size={15}
                      className="text-neutral-black/80"
                    />
                  </div>
                </div>

                <Image 
                key={imageUrl}
                width={10}
                height={10}
                src={imageUrl}
                alt={imageName ?? "preview"}       
                className=" w-full rounded-sm object-cover"
                /> 
              </div>
              :
              <div 
              onClick={handleUploadClick}
              className="p-3 rounded-xl
                bg-white/60 backdrop-blur-lg text-neutral-black/80 
                hover:bg-white/70 transition
              ">     
              <ImageIcon 
                size={25}
              />         
              </div>
              }
          </div>       
        </div>                           
      </div>
    </main>
  )
}

