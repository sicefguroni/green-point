"use client"

import Navbar from "@/components/ui/general/layout/navbar"
import { MapPin, Trees, Flower, X, Cookie, ImageIcon, Camera, Leaf, Sprout, TreeDeciduous, Thermometer, CircleQuestionMark } from "lucide-react"
import GreenSolutionCard from "@/components/ui/general/cards/greensolution-infocard"
import { useState, useRef } from "react"
import mapboxgl from "mapbox-gl"

import { BarangayProvider, useBarangay } from "@/context/BarangayContext";
import exifr from 'exifr'
import Image from "next/image"

import dynamic from "next/dynamic";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

import { getGreeneryClassColor } from "@/lib/chloroplet-colors"
import BarangayMetricItem from "./barangaydetails"
import { BarangayData } from "@/context/BarangayContext"
import { type LocationSelectionMode } from "@/types/maplayers"
import { SelectedFeature } from "@/types/metrics"
import { api, BarangayResult, Recommendation } from "@/lib/api"
import Accordion from "@/components/ui/general/layout/accordion"

const MapWrapper = dynamic(() => import("@/components/map/map_wrapper"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center">
      <div className="text-neutral-black/50">Loading map…</div>
    </div>
  ),
});



function SyncSelectedBarangay({
  feature,
  geoData,
  setRecommendations,
  setIsLoading
}: {
  feature: SelectedFeature | null;
  geoData: BarangayData[] | null;
  setRecommendations: (recs: Recommendation[]) => void;
  setIsLoading: (loading: boolean) => void;
}) {
  const { setSelectedBarangay } = useBarangay();

  useEffect(() => {
    if (!feature) {
      setSelectedBarangay?.(null);
      setRecommendations([]); // Clear recommendations
      setIsLoading(false);
      return;
    }

    const fetchData = async () => {
      console.log("Fetching data for:", feature.barangay);
      setIsLoading(true);
      const apiMatched = await api.getBarangayData(feature.barangay || "");
      const recs = await api.getBarangayRecommendations(feature.barangay || "");

      setRecommendations(recs);

      if (apiMatched) {
        console.log("API Match Found:", apiMatched);
        setSelectedBarangay?.({
          name: apiMatched.brgy_name,
          greeneryIndex: apiMatched.gi_score ?? 0,
          ndvi: apiMatched.ndvi_mean ?? 0,
          lst: apiMatched.mean_lst ?? 0,
          treeCanopy: apiMatched.canopy_cover_pct ?? 0,
          floodExposure: apiMatched.flood_exposure as string ?? "",
          currentIntervention: ""
        });
      } else {
        console.warn(`No API data found for ${feature.barangay}`);
        // Only set name if no data found, do NOT use hardcoded metrics
        setSelectedBarangay?.({
          name: feature.barangay ?? "Unknown",
          greeneryIndex: 0,
          ndvi: 0,
          lst: 0,
          treeCanopy: 0
        } as BarangayData);
      }

      setIsLoading(false);
    };

    fetchData();
  }, [feature?.barangay, setIsLoading, setRecommendations, setSelectedBarangay]); // Use primitive dependency to avoid loop

  return null;
}

export default function GreenSolutionsPage() {
  const [selectedFeature, setSelectedFeature] = useState<SelectedFeature | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [isLoadingBarangayData, setIsLoadingBarangayData] = useState(false);

  // image upload
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);
  const [showNoGpsWarning, setShowNoGpsWarning] = useState(false);
  const [showOutOfBoundsWarning, setShowOutOfBoundsWarning] = useState(false);

  // map
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const removeMarkerRef = useRef<(() => void) | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);

  // for switching from map to greening solutions page
  const searchParams = useSearchParams();
  const addressParam = decodeURIComponent(searchParams.get("address") ?? "");;
  const nameParam = decodeURIComponent(searchParams.get("name") ?? "");
  const barangayParam = decodeURIComponent(searchParams.get("barangay") ?? "");
  const latParam = searchParams.get("lat");
  const lngParam = searchParams.get("lng");

  const [geoData, setGeoData] = useState<BarangayData[] | null>(null);
  const [locationSelectionMode, setLocationSelectionMode] = useState<LocationSelectionMode>("poi");

  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);

  useEffect(() => {
    console.log("selectedFeature updated:", selectedFeature);
  }, [selectedFeature]);

  useEffect(() => {
    // Load GeoJSON for map boundaries
    fetch('/geo/mandaue_barangays_gi.geojson')
      .then(res => res.json())
      .then((data: BarangayResult[]) => {
        const mapped = data.map((item: BarangayResult) => ({
          name: item.name,
          greeneryIndex: item.greenery_index,
          ndvi: item.ndvi,
          lst: item.lst,
          treeCanopy: item.tree_canopy,
          floodExposure: item.flood_exposure,
          currentIntervention: item.current_intervention,
        }));
        setGeoData(mapped as BarangayData[]);
      })
      .catch(err => console.error("GeoJSON load error:", err));
  }, []);



  useEffect(() => {
    if (!mapRef.current || !latParam || !lngParam) return;

    const lat = parseFloat(latParam);
    const lng = parseFloat(lngParam);

    mapRef.current.flyTo({
      center: [lng, lat],
      zoom: 16,
      speed: 1.2,
      curve: 1.5,
      essential: true,
    });

    if (markerRef.current) markerRef.current.remove();

    markerRef.current = new mapboxgl.Marker({ color: "#DB4848" })
      .setLngLat([lng, lat])
      .addTo(mapRef.current);

    setSelectedFeature({
      name: nameParam,
      address: addressParam ?? "Unknown Address",
      barangay: barangayParam ?? "Unknown Barangay",
      coords: { lng, lat },
    });
  }, [latParam, lngParam, addressParam, barangayParam, nameParam, mapReady]);

  function handleUploadClick() {
    fileInputRef.current?.click()
  }

  async function handleFileUploaded(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const url = URL.createObjectURL(file)
    if (imageUrl) URL.revokeObjectURL(imageUrl)

    setImageUrl(url)
    setImageName(file.name)

    try {
      const gps = await exifr.gps(file)
      const imgLat = gps?.latitude ?? null
      const imgLng = gps?.longitude ?? null

      if (imgLat != null && imgLng != null) {
        console.log('Image GPS coordinates:', imgLat, imgLng)

        if (mapRef.current) {
          // teleport weee
          mapRef.current.flyTo({
            center: [imgLng, imgLat],
            zoom: 16,
            speed: 1.2,
            curve: 1.5,
            essential: true,
          })

          if (markerRef.current) markerRef.current.remove();

          // add marker on point
          markerRef.current = new mapboxgl.Marker({ color: "#DB4848" })
            .setLngLat([imgLng, imgLat])
            .addTo(mapRef.current)

          //get address
          const geocodeUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${imgLng},${imgLat}.json?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}`;
          let Imgaddress = "Unknown Address"
          try {
            const response = await fetch(geocodeUrl);
            const data = await response.json();
            if (data.features && data.features.length > 0) {
              Imgaddress = data.features[0].place_name
            }
          } catch (error) {
            console.error("Error fetching address:", error)
          }

          const barangayFeatures = mapRef.current.queryRenderedFeatures(
            mapRef.current.project([imgLng, imgLat]), //convert coords to screen point
            { layers: ["barangayBounds"] }
          );

          const polygonFeature = barangayFeatures.find(
            (f): f is mapboxgl.GeoJSONFeature =>
              f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon"
          );

          const barangayName = polygonFeature?.properties?.name ?? "Unknown Barangay";

          if (barangayName == "Unknown Barangay") {
            // photo is outside our coverage / barangay bounds — show specific modal
            setShowOutOfBoundsWarning(true);
            // cleanup preview and marker so UI doesn't show a dangling preview
            if (markerRef.current) {
              markerRef.current.remove();
              markerRef.current = null;
            }
            if (url) {
              URL.revokeObjectURL(url);
            }
            setImageUrl(null);
            setImageName(null);
            return;
          }

          setSelectedFeature({
            name: "Photo Location",
            address: Imgaddress,
            coords: { lng: imgLng, lat: imgLat },
            barangay: barangayName,
          })

          // if there was a previous marker remove it
          if (removeMarkerRef.current) {
            removeMarkerRef.current();
          }
        }
      } else {
        setShowNoGpsWarning(true);
      }
    } catch (error) {
      setShowNoGpsWarning(true);
      console.error('Error reading EXIF data:', error)
    }
  }

  const MetricsSection = () => {
    const { selectedBarangay } = useBarangay();
    const classColor = getGreeneryClassColor(selectedBarangay?.greeneryIndex || 0);
    const [textColor, bgColor] = classColor.split(' ');
    return (
      <div className="flex flex-col items-center gap-3 justify-center w-full p-2 ">
        {/* Barangay Name */}
        <h1
          className={`w-full ${bgColor} text-lg font-semibold rounded-md py-1 px-5 ${textColor} text-center`}
        >
          {`Barangay ${selectedBarangay?.name} Metrics` || "Select a Barangay"}
        </h1>

        {/* Metrics List */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full mx-auto">
          <BarangayMetricItem
            icon={Leaf}
            label="Greenery Index"
            value={selectedBarangay?.greeneryIndex ?? 0}
          />
          <BarangayMetricItem
            icon={Sprout}
            label="NDVI (Vegetation Density)"
            value={selectedBarangay?.ndvi ?? 0}
          />
          <BarangayMetricItem
            icon={TreeDeciduous}
            label="Tree Canopy Cover (%)"
            value={selectedBarangay?.treeCanopy ?? 0}
          />
          <BarangayMetricItem
            icon={Thermometer}
            label="Land Surface Temp (°C)"
            value={selectedBarangay?.lst ?? 0}
            isTemperature={true}
          />
        </div>
      </div>
    )
  }

  useEffect(() => {
    console.log("loc select mode:", locationSelectionMode);
  }, [locationSelectionMode])

  return (
    <BarangayProvider>
      {/* keep this inside the provider so SyncSelectedBarangay can use useBarangay() */}
      <SyncSelectedBarangay feature={selectedFeature} geoData={geoData} setRecommendations={setRecommendations} setIsLoading={setIsLoadingBarangayData} />
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
            </div>

            <p className="text-neutral-black text-lg leading-tight text-justify">
              See what greening interventions are suitable for your selected area. These aim to reduce the effects of environmental hazards and improve livability.
            </p>

            <div className="flex flex-row bg-white/80 backdrop-blur-md rounded-xl
            shadow-xl shadow-neutral-200 overflow-hidden p-2 items-center justify-between px-3">
              <p className="font-roboto font-medium">Location Selection Mode</p>
              <div className="flex flex-row gap-2 items-center w-fit">
                <button
                  onClick={() => setLocationSelectionMode("poi")}
                  className={`py-1 px-3  hover:bg-green-300 text-neutral-black rounded-full transition-color duration-200 cursor-pointer
                ${locationSelectionMode === "poi" ? "bg-green-300 font-medium" : "bg-neutral-200"}`}>
                  Point of Interest
                </button>
                <button
                  onClick={() => setLocationSelectionMode("barangay")}
                  className={`py-1 px-3  hover:bg-green-300 text-neutral-black rounded-full transition-color duration-200 cursor-pointer
                ${locationSelectionMode === "barangay" ? "bg-green-300 font-medium" : "bg-neutral-200"}`}>
                  Barangay
                </button>
                <button className="p-1 hover:bg-neutral-200 text-neutral-black/70 rounded-full transition-all duration-150">
                  <CircleQuestionMark size={20} />
                </button>
              </div>
            </div>

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
                      hover:bg-green-300 transition-all duration-150 cursor-pointer
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
                  onClick={() => {
                    setSelectedFeature(null)
                    if (imageUrl) {
                      URL.revokeObjectURL(imageUrl)
                      setImageUrl(null)
                      setImageName(null)
                    };

                    if (markerRef.current) {
                      console.log("Marker Ref Exists!")
                      markerRef.current.remove();
                      markerRef.current = null;
                    };

                    if (removeMarkerRef.current) {
                      removeMarkerRef.current();
                    }
                    setSelectedFeature(null);
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
                selectedFeature ? (
                  isLoadingBarangayData ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-4">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
                      <p className="text-neutral-600 font-roboto">Loading barangay data...</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 overflow-y-auto max-h-[100vh] pr-2 [scrollbar-width:thin]">
                      <MetricsSection />

                      <Accordion
                        title="Location's Recommended Greening Interventions"
                        content={
                          <div className="flex-1 flex flex-col gap-4">
                            {recommendations
                              .filter(r => r.barangay_name === selectedFeature.barangay)
                              .sort((a, b) => (b.efficiency_score || 0) - (a.efficiency_score || 0))
                              .map((rec, idx, arr) => (
                                <div key={idx}>
                                  <GreenSolutionCard
                                    solutionTitle={rec.intervention_name}
                                    solutionDescription={rec.intervention_type}
                                    shortDescription={rec.explanation ? rec.explanation.substring(0, 120) + (rec.explanation.length > 120 ? '...' : '') : undefined}
                                    detailedDescription={rec.explanation || "Recommended greening intervention for this location based on environmental factors and urban planning considerations."}
                                    efficiencyLevel="Recommended"
                                    efficiencyScore={rec.efficiency_score}
                                    icon={
                                      rec.intervention_type.toLowerCase().includes('tree') ? <Trees size={24} /> :
                                        rec.intervention_type.toLowerCase().includes('garden') ? <Flower size={24} /> :
                                          rec.intervention_type.toLowerCase().includes('park') ? <TreeDeciduous size={24} /> :
                                            <Leaf size={24} />
                                    }
                                    value={Math.min(100, Math.max(0, rec.efficiency_score || 0))}
                                    cost={rec.estimated_cost_per_sqm}
                                    impact={rec.cooling_potential}
                                  />
                                  {idx < arr.length - 1 && (
                                    <hr className="border-t border-1 border-neutral-black/20 my-2" />
                                  )}
                                </div>
                              ))}

                            {recommendations.filter(r => r.barangay_name === selectedFeature.barangay).length === 0 && (
                              <div className="text-center p-4 text-neutral-500">
                                No specific recommendations found for this location.
                                <br />
                                <span className="text-sm">Try selecting another barangay.</span>
                              </div>
                            )}
                          </div>
                        }
                        hasContent={true}
                        hasCustomStyling={true}
                        customTextStyling="font-roboto text-md font-semibold"
                      />
                    </div>
                  )
                ) : (
                  <div className="flex items-center justify-center flex-col gap-2">
                    <span className="text-md font-roboto text-neutral-black/60 font-regular mb-2">
                      Select a location or upload a geotagged photo to get started generating solutions!
                    </span>
                  </div>
                )
              }
            </div>
          </div>

          {/* Right Side */}
          <div className="bg-white/60 backdrop-blur-lg relative rounded-lg p-2">
            {/* map */}
            <MapWrapper
              searchBoxLocation="absolute top-5 left-5 w-80 z-10"
              onFeatureSelected={(feature) => {
                // try to pull barangay from feature.properties 
                const barangayName =
                  feature.barangay ||
                  "";

                setSelectedFeature({
                  ...feature,
                  barangay: barangayName,
                });
              }}

              onBarangaySelected={(barangayName, summarizedHazards, airqualindex) => {
                if (!geoData) return;

                const matched = geoData.find(
                  (b) => b.name.toLowerCase() === barangayName.toLowerCase()
                );

                if (matched) {
                  setSelectedFeature({
                    name: matched.name,
                    address: "Barangay Area",
                    barangay: matched.name,
                    coords: { lng: 0, lat: 0 },
                    properties: matched,
                    barangay_hazards: summarizedHazards,
                    barangay_air: airqualindex,
                  });
                }
              }}

              onMapReady={(map, removeMarker) => {
                mapRef.current = map
                removeMarkerRef.current = removeMarker;
                setMapReady(true);
              }}
              selectionMode={locationSelectionMode}
            />

            {/* overlays */}
            <div className="absolute top-2 right-2 m-4">
              {
                imageUrl && selectedFeature?.name == "Photo Location" ?
                  <div className="flex flex-col bg-white/90 backdrop-blur-md max-w-xs max-h-xs p-2 rounded-md gap-1">
                    <div className="flex flex-row justify-between items-center">
                      <span className="text-sm font-roboto text-center">
                        Uploaded Image
                      </span>
                      <div
                        onClick={() => {
                          setSelectedFeature(null)
                          if (imageUrl) {
                            URL.revokeObjectURL(imageUrl)
                            setImageUrl(null)
                            setImageName(null)
                          };

                          if (markerRef.current) {
                            markerRef.current.remove();
                            markerRef.current = null;
                          };

                          if (removeMarkerRef.current) {
                            removeMarkerRef.current();
                          }
                          setSelectedFeature(null);
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

        {showNoGpsWarning && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex justify-center items-center z-50">
            <div className="bg-white rounded-lg p-6 shadow-xl w-80 text-center">
              <h2 className="text-lg font-semibold text-neutral-black mb-2">
                No GPS Data Found
              </h2>
              <p className="text-neutral-600 text-sm mb-4">
                This photo does not contain GPS information. Please try another image.
              </p>
              <button
                onClick={() => setShowNoGpsWarning(false)}
                className="font-roboto px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all"
              >
                OK
              </button>
            </div>
          </div>
        )}

        {showOutOfBoundsWarning && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex justify-center items-center z-50">
            <div className="bg-white rounded-lg p-6 shadow-xl w-96 text-center">
              <h2 className="text-lg font-semibold text-neutral-black mb-2">
                Photo Outside Coverage
              </h2>
              <p className="text-neutral-600 text-sm mb-4">
                This photo appears to be outside our barangay bounds. A sample photo can be found in the root of the repo.
              </p>
              <button
                onClick={() => setShowOutOfBoundsWarning(false)}
                className="font-roboto px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all"
              >
                OK
              </button>
            </div>
          </div>
        )}

      </main>
    </BarangayProvider>
  )
}
