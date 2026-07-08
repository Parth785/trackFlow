export async function fetchOsrmEta(fromLat, fromLng, toLat, toLng) {
    try {
      const url =
        `http://router.project-osrm.org/route/v1/driving/` +
        `${fromLng},${fromLat};${toLng},${toLat}` +
        `?overview=false`;
  
      const res = await fetch(url, { timeout: 8000 });
      const data = await res.json();
  
      if (data.code === "Ok" && data.routes?.length > 0) {
        // OSRM returns duration in seconds
        const durationSeconds = data.routes[0].duration;
        const minutes = Math.ceil(durationSeconds / 60);
        return Math.max(1, minutes);
      }
    } catch (e) {
      console.log("OSRM ETA fetch failed:", e);
    }
  
    return null;
  }