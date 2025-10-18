export function getGreeneryColor(value: number): string {
  return value >= 0.7 ? '#006400' :   // dark green - dense
         value >= 0.5 ? '#31a354' :   // medium green
         value >= 0.3 ? '#addd8e' :   // light green
         value >= 0.1 ? '#ffffcc' :   // pale yellow
                        '#d73027';   // reddish - barren
}