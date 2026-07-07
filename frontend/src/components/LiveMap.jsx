import { MapContainer, TileLayer } from "react-leaflet";
import AgentMarker from "./AgentMarker";
import OrderRoutes from "./OrderRoutes";
import MapClickHandler from "./MapClickHandler";

const AHMEDABAD_CENTER = [23.0225, 72.5714];
const DEFAULT_ZOOM = 13;

export default function LiveMap({
  agents,
  routes,
  assignedAgentId,
  onMapClick,
  orderStatus,
}) {
  const agentList = Object.values(agents);

  return (
    <MapContainer
      center={AHMEDABAD_CENTER}
      zoom={DEFAULT_ZOOM}
      style={{ width: "100%", height: "100vh" }}
    >
      <TileLayer
        attribution='&copy; OpenStreetMap &copy; CARTO'
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        subdomains="abcd"
      />

      <MapClickHandler onClick={onMapClick} />

      <OrderRoutes routes={routes} orderStatus={orderStatus} />

      {agentList.map((agent) => (
      <AgentMarker
        key={agent.agentId}
        agent={agent}
        isAssigned={
          agent.agentId === assignedAgentId &&
          orderStatus !== "DELIVERED" &&
          orderStatus !== null
        }
      />
    ))}
    </MapContainer>
  );
}