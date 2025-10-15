
// working with the layer visibilities
export const defaultLayerVisibility = {
  floodLayer: true,
  stormLayer: false,
  heatLayer: false,
  airLayer: false
}

//working with layer colors
export const defaultLayerColors = {
  floodLayer: ["#48CAE4", "#0096C7", "#023E8A"],
  stormLayer: ["#9333ea", "#a855f7", "#7e22ce"],
  heatLayer: ["#dc2626", "#ef4444", "#b91c1c"],
  airLayer: ["#16a34a", "#4ade80", "#22c55e"]
}

export const mapStyles: Record<string, string> = {
  Default: "mapbox://styles/mapbox/standard",
  Light: "mapbox://styles/mapbox/light-v11",
  Dark: "mapbox://styles/mapbox/dark-v11",
  Satellite: "mapbox://styles/mapbox/satellite-streets-v12",
};