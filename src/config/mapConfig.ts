

export const defaultLayerVisibility = {
  floodLayer: true,
  stormLayer: false,
  heatLayer: false,
  airLayer: false,
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
  heatLayer: ["#dc2626", "#ef4444", "#b91c1c"],
  airLayer: ["#16a34a", "#4ade80", "#22c55e"],
  barangayBoundsLayer: ["#63DF6D", "#31C438", "#0F8519"],
}

export const mapStyles: Record<string, string> = {
  Default: "mapbox://styles/ishah-bautista/cmgt5dgq7000101t13gvm2mlz",
  Light: "mapbox://styles/ishah-bautista/cmgt5m4eh000201t13qrpdyfh",
  Dark: "mapbox://styles/mapbox/dark-v11",
  Satellite: "mapbox://styles/ishah-bautista/cmgt5kx9h000401r58j677d1l",
};