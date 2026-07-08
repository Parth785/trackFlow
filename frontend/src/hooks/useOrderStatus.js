import { useEffect, useState, useRef } from "react";
import { fetchOsrmEta } from "../utils/osrm";

export function useOrderStatus(stompClient, orderId, onDelivered) {
  const [status, setStatus] = useState(null);
  const [eta, setEta] = useState(null);
  const [etaCountdown, setEtaCountdown] = useState(null);
  const deliveredRef = useRef(false);
  const countdownRef = useRef(null);
  const autoClearRef = useRef(null);

  const startCountdown = (etaMinutes) => {
    if (countdownRef.current) clearInterval(countdownRef.current);

    let remainingSeconds = etaMinutes * 60;
    setEtaCountdown({ mins: etaMinutes, secs: 0, totalSeconds: remainingSeconds });

    countdownRef.current = setInterval(() => {
      remainingSeconds -= 1;

      if (remainingSeconds <= 0) {
        clearInterval(countdownRef.current);
        setEtaCountdown(0);
        return;
      }

      const mins = Math.floor(remainingSeconds / 60);
      const secs = remainingSeconds % 60;
      setEtaCountdown({ mins, secs, totalSeconds: remainingSeconds });
    }, 1000);
  };

  useEffect(() => {
    // Reset everything on new order
    setStatus("ASSIGNED");
    setEta(null);
    setEtaCountdown(null);
    deliveredRef.current = false;

    // Cancel any pending auto-clear from previous order
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (autoClearRef.current) {
      clearTimeout(autoClearRef.current);
      autoClearRef.current = null;
    }

    if (!stompClient || !orderId) return;

    const topic = `/topic/order/${orderId}/status`;
    console.log(`Subscribing to: ${topic}`);

    let subscription;
    try {
      subscription = stompClient.subscribe(topic, async (message) => {
        const data = JSON.parse(message.body);
        console.log("Order status received:", data);
        setStatus(data.status);

        if (data.status === "PICKED_UP") {
          let etaMinutes = data.eta || null;

          if (data.pickupLat && data.dropLat) {
            const osrmEta = await fetchOsrmEta(
              data.pickupLat, data.pickupLng,
              data.dropLat, data.dropLng
            );
            if (osrmEta) etaMinutes = osrmEta;
          }

          if (etaMinutes) {
            setEta(etaMinutes);
            startCountdown(etaMinutes);
          }
        }

        if (data.status === "DELIVERED" && !deliveredRef.current) {
          deliveredRef.current = true;
          if (countdownRef.current) clearInterval(countdownRef.current);
          setEtaCountdown(null);

          // Store timeout ref so we can cancel it if user places new order
          autoClearRef.current = setTimeout(() => {
            autoClearRef.current = null;
            if (onDelivered) onDelivered();
          }, 4000);
        }
      });
    } catch (e) {
      console.error("Failed to subscribe:", e);
    }

    return () => {
      if (subscription) {
        try { subscription.unsubscribe(); } catch (e) { }
      }
      if (countdownRef.current) clearInterval(countdownRef.current);
      // Don't cancel autoClearRef here — let it fire unless new order cancels it
    };
  }, [stompClient, orderId]);

  return { status, eta, etaCountdown };
}