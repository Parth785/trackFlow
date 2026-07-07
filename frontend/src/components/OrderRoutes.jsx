import { Polyline, Marker, Popup } from "react-leaflet";
import L from "leaflet";

const pickupIcon = L.divIcon({
  className: "",
  html: `<div style="
    background:#22c55e;width:16px;height:16px;
    border-radius:50%;border:3px solid white;
    box-shadow:0 2px 8px rgba(0,0,0,0.3);
  "/>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

const dropIcon = L.divIcon({
  className: "",
  html: `<div style="
    background:#ef4444;width:16px;height:16px;
    border-radius:50%;border:3px solid white;
    box-shadow:0 2px 8px rgba(0,0,0,0.3);
  "/>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

export default function OrderRoutes({ routes, orderStatus }) {
  if (!routes) return null;

  const showPickupDot = orderStatus === "ASSIGNED" || orderStatus === null;
  const showDropDot = orderStatus !== "DELIVERED";

  return (
    <>
      {/* Blue dashed — agent to pickup */}
      {routes.agentToPickup && routes.agentToPickup.length >= 2 && (
        <Polyline
          positions={routes.agentToPickup}
          pathOptions={{
            color: "#3b82f6",
            weight: 5,
            opacity: 0.8,
            dashArray: "10 7",
            lineCap: "round",
            lineJoin: "round",
          }}
        />
      )}

      {/* Orange solid — pickup to drop */}
      {routes.pickupToDrop && routes.pickupToDrop.length >= 2 && (
        <Polyline
          positions={routes.pickupToDrop}
          pathOptions={{
            color: "#FF5200",
            weight: 5,
            opacity: 0.85,
            lineCap: "round",
            lineJoin: "round",
          }}
        />
      )}

      {/* Pickup dot — green, disappears after pickup */}
      {showPickupDot && routes.pickupLocation && (
        <Marker
          position={[routes.pickupLocation.lat, routes.pickupLocation.lng]}
          icon={pickupIcon}
        >
          <Popup>📦 Pickup point</Popup>
        </Marker>
      )}

      {/* Drop dot — red, disappears after delivery */}
      {showDropDot && routes.dropLocation && (
        <Marker
          position={[routes.dropLocation.lat, routes.dropLocation.lng]}
          icon={dropIcon}
        >
          <Popup>🏁 Drop point</Popup>
        </Marker>
      )}
    </>
  );
}