

export const defaultLayerVisibility = {
  floodLayer: true,
  stormLayer: false,
  liquefactionLayer: false,
  eilLayer: false,
  landslideLayer: false,
  heatLayer: false,
  barangayBoundsLayer: true,
  ndviLayer: false,
  canopyLayer: false,
  greeneryIndexLayer: false,
  taggedTreesLayer: true,
}


//working with layer colors
export const defaultLayerColors = {
  floodLayer: ["#48CAE4", "#0096C7", "#023E8A"],
  stormLayer: ["#9333ea", "#a855f7", "#7e22ce"],
  barangayBoundsLayer: ["#63DF6D", "#31C438", "#0F8519"],
}

/**
 * Where location search looks. Mandaue's barangay polygons span
 * 123.9129–123.9754 E, 10.3112–10.3898 N; the bbox adds about 2 km on each
 * side so places on the city's edge still match. Results in that margin but
 * outside the city are caught when selected (see handleSearchRetrieve).
 */
export const MANDAUE_SEARCH_AREA = {
  proximity: [123.944, 10.35] as [number, number],
  bbox: [123.895, 10.295, 123.995, 10.405] as [number, number, number, number],
  country: "PH",
};

export const mapStyles: Record<string, string> = {
  Default: "mapbox://styles/ishah-bautista/cmgt5dgq7000101t13gvm2mlz",
  Light: "mapbox://styles/ishah-bautista/cmgt5m4eh000201t13qrpdyfh",
  Dark: "mapbox://styles/mapbox/dark-v11",
  Satellite: "mapbox://styles/ishah-bautista/cmgt5kx9h000401r58j677d1l",
};