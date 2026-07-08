import { useState, useEffect, useCallback } from "react";
import LiveMap from "./components/LiveMap";
import StatsPanel from "./components/StatsPanel";
import OrderPanel from "./components/OrderPanel";
import { useAgentTracking } from "./hooks/useAgentTracking";
import { usePlaceOrder } from "./hooks/usePlaceOrder";
import { useOrderStatus } from "./hooks/useOrderStatus";
import { useRouteProgress } from "./hooks/useRouteProgress";
import { useAnimatedPosition } from "./hooks/useAnimatedPosition";

export default function App() {
  const { agents, connected, stompClient } = useAgentTracking();
  const { placeOrder, order, routes, loading, error, clearOrder } = usePlaceOrder();

  const [step, setStep] = useState("pickup");
  const [pickup, setPickup] = useState(null);
  const [drop, setDrop] = useState(null);
  const [isPlacingNew, setIsPlacingNew] = useState(false);

  const assignedAgent = order?.agentId ? agents[order.agentId] : null;
  const animatedAgentPos = useAnimatedPosition(assignedAgent);

  // After delivery — just unlock the step, keep order visible
  const handleDelivered = useCallback(() => {
    setStep("pickup");
    setIsPlacingNew(false);
  }, []);

  // Full reset — only when user explicitly wants to start over
  const handleClear = useCallback(() => {
    clearOrder();
    setPickup(null);
    setDrop(null);
    setStep("pickup");
    setIsPlacingNew(false);
  }, [clearOrder]);

  const { status: orderStatus, eta, etaCountdown } = useOrderStatus(
    stompClient,
    order?.id,
    handleDelivered
  );

  const { trimmedRoutes, setRoutes } = useRouteProgress(
    animatedAgentPos,
    orderStatus
  );

  useEffect(() => {
    setRoutes(routes);
  }, [routes]);

  const isDelivered = orderStatus === "DELIVERED";
  const hasActiveOrder = !!order && !isPlacingNew;

  const handleMapClick = (lat, lng) => {
    // Block map clicks if order is active and not yet delivered
    if (order && !isDelivered && !isPlacingNew) return;
    // Block if already selecting points for new order
    if (loading) return;

    if (step === "pickup") {
      setPickup({ lat, lng });
      setStep("drop");
    } else if (step === "drop") {
      setDrop({ lat, lng });
      setStep("confirm");
    }
  };

  const handleStartNewOrder = () => {
    // Mark that we're placing a new order
    // This keeps the old order visible while new one loads
    setIsPlacingNew(true);
    setPickup(null);
    setDrop(null);
    setStep("pickup");
  };

  const handlePlaceOrder = async () => {
    if (!pickup || !drop) return;

    // Clear old order right before new one arrives
    // NOT before — keeps old order visible during map click phase
    clearOrder();
    setRoutes(null);

    await placeOrder(pickup.lat, pickup.lng, drop.lat, drop.lng);
    setIsPlacingNew(false);
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
        order={isPlacingNew ? null : order}
        orderStatus={orderStatus}
        eta={eta}
        etaCountdown={etaCountdown}
        loading={loading}
        error={error}
        onPlace={handlePlaceOrder}
        onClear={handleClear}
        onStartNew={handleStartNewOrder}
        isDelivered={isDelivered}
        hasActiveOrder={hasActiveOrder}
      />
    </div>
  );
}