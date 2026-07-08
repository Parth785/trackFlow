const getStatusIndex = (status) => {
  const order = ["ASSIGNED", "PICKED_UP", "DELIVERED"];
  return order.indexOf(status);
};

const statusLabel = (status) => {
  const labels = {
    ASSIGNED: "🛵 Agent heading to pickup",
    PICKED_UP: "📦 Order picked up",
    DELIVERED: "✅ Delivered!",
  };
  return labels[status] || status;
};

export default function OrderPanel({
  step,
  pickup,
  drop,
  order,
  orderStatus,
  eta,
  etaCountdown,
  loading,
  error,
  onPlace,
  onClear,
  onStartNew,
  isDelivered,
  hasActiveOrder,
}) {
  return (
    <div style={{
      position: "fixed",
      top: "90px",
      left: "9%",
      transform: "translateX(-50%)",
      background: "rgba(15, 23, 42, 0.95)",
      border: "1px solid #334155",
      borderRadius: "16px",
      padding: "16px 24px",
      zIndex: 1000,
      minWidth: "320px",
      maxWidth: "480px",
      backdropFilter: "blur(8px)",
      color: "#e2e8f0",
      fontFamily: "sans-serif",
    }}>

      {/* Header */}
      <div style={{
        fontSize: "13px",
        fontWeight: "600",
        color: "#FF5200",
        marginBottom: "12px",
        textTransform: "uppercase",
        letterSpacing: "0.05em",
      }}>
        🛵 TrackFlow — Place Order
      </div>

      {/* Active order view */}
      {order && (
        <>
          <div style={{ fontSize: "12px", color: "#94a3b8", marginBottom: "4px" }}>
            Order ID: <span style={{ color: "#e2e8f0" }}>{order.id.slice(-8)}</span>
          </div>
          <div style={{ fontSize: "12px", color: "#94a3b8", marginBottom: "16px" }}>
            Agent: <span style={{ color: "#e2e8f0" }}>{order.agentId}</span>
          </div>

          {/* Status timeline */}
          <div style={{ display: "flex", flexDirection: "column", marginBottom: "12px" }}>
            {["ASSIGNED", "PICKED_UP", "DELIVERED"].map((s, i, arr) => {
              const reached = getStatusIndex(orderStatus) >= getStatusIndex(s);
              const isLast = i === arr.length - 1;
              return (
                <div key={s}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{
                      width: "10px", height: "10px",
                      borderRadius: "50%",
                      background: reached ? "#22c55e" : "#334155",
                      border: reached ? "none" : "1px solid #475569",
                      flexShrink: 0,
                      transition: "background 0.4s ease",
                    }}/>
                    <div style={{
                      fontSize: "12px",
                      color: reached ? "#e2e8f0" : "#475569",
                      fontWeight: reached ? "600" : "400",
                      transition: "color 0.4s ease",
                    }}>
                      {statusLabel(s)}
                    </div>
                  </div>
                  {!isLast && (
                    <div style={{
                      marginLeft: "4px",
                      width: "2px",
                      height: "16px",
                      background: getStatusIndex(orderStatus) > getStatusIndex(s)
                        ? "#22c55e" : "#334155",
                      transition: "background 0.4s ease",
                    }}/>
                  )}
                </div>
              );
            })}
          </div>

          {/* ETA countdown */}
          {orderStatus === "PICKED_UP" && etaCountdown !== null && (
            <div style={{
              background: "rgba(255, 82, 0, 0.1)",
              border: "1px solid #FF5200",
              borderRadius: "8px",
              padding: "10px 14px",
              marginBottom: "12px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}>
              <span style={{ fontSize: "20px" }}>🕐</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "11px", color: "#94a3b8", marginBottom: "2px" }}>
                  Estimated delivery
                </div>
                {etaCountdown?.totalSeconds > 120 && (
                  <div style={{ fontSize: "18px", fontWeight: "700", color: "#FF5200" }}>
                    {etaCountdown.mins} min{etaCountdown.mins !== 1 ? "s" : ""}
                  </div>
                )}
                {etaCountdown?.totalSeconds <= 120 && etaCountdown?.totalSeconds > 0 && (
                  <div style={{ fontSize: "18px", fontWeight: "700", color: "#f97316" }}>
                    {etaCountdown.mins}:{String(etaCountdown.secs).padStart(2, "0")}
                  </div>
                )}
                {etaCountdown === 0 && (
                  <div style={{ fontSize: "14px", fontWeight: "700", color: "#22c55e" }}>
                    Arriving now!
                  </div>
                )}
              </div>
              <div style={{
                width: "8px", height: "8px",
                borderRadius: "50%",
                background: "#FF5200",
                animation: "pulse 1.5s infinite",
                flexShrink: 0,
              }}/>
            </div>
          )}

          {/* Delivered */}
          {isDelivered && (
            <div style={{
              background: "rgba(34, 197, 94, 0.1)",
              border: "1px solid #22c55e",
              borderRadius: "8px",
              padding: "10px",
              fontSize: "13px",
              color: "#22c55e",
              textAlign: "center",
              marginBottom: "12px",
              fontWeight: "600",
            }}>
              🎉 Your order has been delivered!
            </div>
          )}

          {/* Route legend */}
          <div style={{
            fontSize: "11px",
            color: "#64748b",
            marginBottom: "14px",
            lineHeight: "1.8",
          }}>
            <span style={{ color: "#3b82f6" }}>━ ━</span> Agent coming to you
            {"   "}
            <span style={{ color: "#FF5200" }}>━━</span> Your order's route
          </div>

          {/* Place another order button — only after delivery */}
          {isDelivered && (
            <button
              onClick={onStartNew}
              style={{
                width: "100%",
                background: "#FF5200",
                color: "white",
                border: "none",
                borderRadius: "8px",
                padding: "10px",
                fontSize: "14px",
                fontWeight: "600",
                cursor: "pointer",
                marginBottom: "8px",
              }}
            >
              Place Another Order
            </button>
          )}

          <button
            onClick={onClear}
            style={{
              width: "100%",
              background: "#1e293b",
              color: "#94a3b8",
              border: "1px solid #334155",
              borderRadius: "8px",
              padding: "10px",
              fontSize: "14px",
              cursor: "pointer",
            }}
          >
            Reset
          </button>
        </>
      )}

      {/* Pre-order / new order flow */}
      {!order && (
        <>
          <div style={{ fontSize: "13px", color: "#94a3b8", marginBottom: "8px" }}>
            {step === "pickup" && "👆 Click on map to set pickup location"}
            {step === "drop"   && "👆 Now click to set drop location"}
            {step === "confirm" && "✅ Ready to place order"}
          </div>

          {pickup && (
            <div style={{ fontSize: "12px", color: "#22c55e", marginBottom: "4px" }}>
              📦 Pickup: {pickup.lat.toFixed(4)}, {pickup.lng.toFixed(4)}
            </div>
          )}

          {drop && (
            <div style={{ fontSize: "12px", color: "#ef4444", marginBottom: "4px" }}>
              🏁 Drop: {drop.lat.toFixed(4)}, {drop.lng.toFixed(4)}
            </div>
          )}

          {step === "confirm" && (
            <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
              <button
                onClick={onPlace}
                disabled={loading}
                style={{
                  flex: 1,
                  background: "#FF5200",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  padding: "10px",
                  fontSize: "14px",
                  fontWeight: "600",
                  cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? "Placing..." : "Place Order"}
              </button>
              <button
                onClick={onClear}
                style={{
                  background: "#1e293b",
                  color: "#94a3b8",
                  border: "1px solid #334155",
                  borderRadius: "8px",
                  padding: "10px 16px",
                  fontSize: "14px",
                  cursor: "pointer",
                }}
              >
                Reset
              </button>
            </div>
          )}

          {error && (
            <div style={{ marginTop: "8px", color: "#ef4444", fontSize: "12px" }}>
              ❌ {error}
            </div>
          )}
        </>
      )}
    </div>
  );
}