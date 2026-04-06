
async function testOSM() {
  const query = `
    [out:json][timeout:25];
    (
      way["landuse"~"forest|grass|meadow|orchard"](10.30,123.90,10.35,123.95);
      way["natural"~"wood|scrub"](10.30,123.90,10.35,123.95);
      way["leisure"~"park|garden|golf_course"](10.30,123.90,10.35,123.95);
    );
    out stats;
  `;
  const url = "https://overpass-api.de/api/interpreter";
  const res = await fetch(url, { method: "POST", body: query });
  const data = await res.json();
  console.log(data);
}
testOSM();

