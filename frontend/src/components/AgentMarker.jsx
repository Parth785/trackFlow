import { useEffect, useRef } from "react";
import { Marker, Popup } from "react-leaflet";
import L from "leaflet";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const PING_INTERVAL_MS = 3000;

const createDeliveryIcon = (agentId, bearing = 0, isAssigned = false) => {
  return L.divIcon({
    className: "",
    html: `
      <div
        id="agent-icon-${agentId}"
        style="
          width: 50px;
          height: 62px;
          transform: rotate(${bearing}deg);
          transform-origin: 25px 31px;
          transition: transform 0.6s ease;
          filter: ${isAssigned
            ? "drop-shadow(0 0 8px #22c55e) drop-shadow(0 0 16px #22c55e)"
            : "none"};
        "
      >
        <img src="/scooter.svg" width="50" height="62" style="display:block;"/>
      </div>
    `,
    iconSize: [50, 62],
    iconAnchor: [25, 31],
    popupAnchor: [0, -31],
  });
};

const easeInOut = (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

export default function AgentMarker({ agent, isAssigned = false }) {
  const markerRef = useRef(null);
  const animationRef = useRef(null);
  const currentPosRef = useRef({ lat: agent.lat, lng: agent.lng });
  const startPosRef = useRef({ lat: agent.lat, lng: agent.lng });
  const targetPosRef = useRef({ lat: agent.lat, lng: agent.lng });
  const startTimeRef = useRef(null);
  const isFirstRender = useRef(true);

  const startAnimation = (fromLat, fromLng, toLat, toLng) => {
    if (animationRef.current) cancelAnimationFrame(animationRef.current);

    startPosRef.current = { lat: fromLat, lng: fromLng };
    targetPosRef.current = { lat: toLat, lng: toLng };
    startTimeRef.current = performance.now();

    const animate = (now) => {
      if (!markerRef.current) return;
      const elapsed = now - startTimeRef.current;
      const progress = Math.min(elapsed / PING_INTERVAL_MS, 1);
      const eased = easeInOut(progress);

      const lat = startPosRef.current.lat +
        (targetPosRef.current.lat - startPosRef.current.lat) * eased;
      const lng = startPosRef.current.lng +
        (targetPosRef.current.lng - startPosRef.current.lng) * eased;

      markerRef.current.setLatLng([lat, lng]);
      currentPosRef.current = { lat, lng };

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    animationRef.current = requestAnimationFrame(animate);
  };

  // Handle position updates
  useEffect(() => {
    if (!markerRef.current) return;

    if (isFirstRender.current) {
      isFirstRender.current = false;
      currentPosRef.current = { lat: agent.lat, lng: agent.lng };
      return;
    }

    startAnimation(
      currentPosRef.current.lat,
      currentPosRef.current.lng,
      agent.lat,
      agent.lng
    );

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [agent.lat, agent.lng]);

  // Handle bearing updates separately — directly manipulate DOM
  // This avoids recreating the icon which breaks the transition
  useEffect(() => {
    const el = document.getElementById(`agent-icon-${agent.agentId}`);
    if (el) {
      el.style.transform = `rotate(${agent.bearing || 0}deg)`;
      el.style.filter = isAssigned
        ? "drop-shadow(0 0 8px #22c55e) drop-shadow(0 0 16px #22c55e)"
        : "none";
    }
  }, [agent.bearing, isAssigned]);

  return (
    <Marker
      ref={markerRef}
      position={[agent.lat, agent.lng]}
      icon={createDeliveryIcon(agent.agentId, agent.bearing || 0, isAssigned)}
    >
      <Popup>
        <div style={{ fontSize: "13px", lineHeight: "1.8", minWidth: "160px" }}>
          <div style={{ fontWeight: "700", color: "#FF5200", marginBottom: "6px" }}>
            🛵 {agent.agentId}
            {isAssigned && (
              <span style={{
                marginLeft: "8px",
                background: "#22c55e",
                color: "white",
                fontSize: "10px",
                padding: "2px 6px",
                borderRadius: "4px"
              }}>
                YOUR ORDER
              </span>
            )}
          </div>
          <div>📍 {agent.lat.toFixed(5)}, {agent.lng.toFixed(5)}</div>
          <div>🧭 {Math.round(agent.bearing || 0)}°</div>
          <div>🕐 {new Date(agent.lastSeen).toLocaleTimeString()}</div>
        </div>
      </Popup>
    </Marker>
  );
}