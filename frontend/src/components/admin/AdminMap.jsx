import { MapContainer, TileLayer } from "react-leaflet";
import AgentMarker from "../AgentMarker";

const AHMEDABAD_CENTER = [23.0225, 72.5714];

export default function AdminMap({ agents }) {
  const agentList = Object.values(agents);

  return (
    <MapContainer
      center={AHMEDABAD_CENTER}
      zoom={12}
      style={{ width: "100%", height: "100vh" }}
    >
      <TileLayer
        attribution='&copy; OpenStreetMap &copy; CARTO'
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        subdomains="abcd"
      />
      {agentList.map((agent) => (
        <AgentMarker
          key={agent.agentId}
          agent={agent}
          isAssigned={false}
        />
      ))}
    </MapContainer>
  );
}