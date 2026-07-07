import { useState } from "react";
import LiveMap from "./components/LiveMap";
import StatsPanel from "./components/StatsPanel";
import OrderPanel from "./components/OrderPanel";
import { useAgentTracking } from "./hooks/useAgentTracking";
import { usePlaceOrder } from "./hooks/usePlaceOrder";
import { useOrderStatus } from "./hooks/useOrderStatus";
import { useRouteProgress } from "./hooks/useRouteProgress";

export default function App() {
  const { agents, connected, stompClient } = useAgentTracking();
  const { placeOrder, order, routes, loading, error, clearOrder } = usePlaceOrder();

  const [step, setStep] = useState("pickup");
  const [pickup, setPickup] = useState(null);
  const [drop, setDrop] = useState(null);

  const assignedAgent = order?.agentId ? agents[order.agentId] : null;

  const handleClear = () => {
    clearOrder();
    setPickup(null);
    setDrop(null);
    setStep("pickup");
  };

  const { status: orderStatus, eta, etaCountdown } = useOrderStatus(
    stompClient,
    order?.id,
    handleClear
  );

  const trimmedRoutes = useRouteProgress(routes, assignedAgent, orderStatus);

  const handleMapClick = (lat, lng) => {
    if (order) return;
    if (step === "pickup") {
      setPickup({ lat, lng });
      setStep("drop");
    } else if (step === "drop") {
      setDrop({ lat, lng });
      setStep("confirm");
    }
  };

  const handlePlaceOrder = async () => {
    if (!pickup || !drop) return;
    await placeOrder(pickup.lat, pickup.lng, drop.lat, drop.lng);
  };

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh" }}>
      <LiveMap
        agents={agents}
        routes={trimmedRoutes}
        assignedAgentId={order?.agentId}
        onMapClick={handleMapClick}
        orderStatus={orderStatus}
      />
      <StatsPanel agents={agents} connected={connected} />
      <OrderPanel
        step={step}
        pickup={pickup}
        drop={drop}
        order={order}
        orderStatus={orderStatus}
        eta={eta}
        etaCountdown={etaCountdown}
        loading={loading}
        error={error}
        onPlace={handlePlaceOrder}
        onClear={handleClear}
      />
    </div>
  );
}