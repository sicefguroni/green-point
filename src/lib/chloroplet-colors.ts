export function getGreeneryColor(value: number): string {
  return value >= 0.7 ? '#006400' :   // dark green - dense
         value >= 0.5 ? '#31a354' :   // medium green
         value >= 0.3 ? '#addd8e' :   // light green
         value >= 0.1 ? '#ffffcc' :   // pale yellow
                        '#d73027';   // reddish - barren
}

export function getGreeneryClassColor(value: number): string {
  return value >= 0.7 ? 'text-green-600 bg-green-100' :   // dark green - dense
         value >= 0.5 ? 'text-lime-600 bg-lime-100' :   // medium green
         value >= 0.3 ? 'text-yellow-600 bg-yellow-50' :   // pale yellow
         value >= 0.01 ? 'text-red-600 bg-red-50' :   // reddish - barren
                        'text-gray-600 bg-gray-100';   // gray - empty
}

export function getTemperatureColor(value: number): string {
  return value >= 35 ? 'text-red-500 bg-red-100' :      // Very hot - red
         value >= 30 ? 'text-orange-500 bg-orange-100' :   // Hot - orange
         value >= 25 ? 'text-yellow-500 bg-yellow-100' :   // Warm - yellow
         value >= 20 ? 'text-green-500 bg-green-100' :    // Moderate - green
         value >= 15 ? 'text-blue-500 bg-blue-100' :     // Cool - blue
                       'text-gray-600 bg-gray-100';      // Cold - dark blue
}