import { useEffect, useState, useRef } from "react";

export function useOrderStatus(stompClient, orderId, onDelivered) {
  const [status, setStatus] = useState(null);
  const [eta, setEta] = useState(null);
  const [etaCountdown, setEtaCountdown] = useState(null);
  const deliveredRef = useRef(false);
  const countdownRef = useRef(null);

  // Start countdown timer when ETA is received
  const startCountdown = (etaMinutes) => {
    // Clear any existing countdown
    if (countdownRef.current) clearInterval(countdownRef.current);

    // Convert ETA to seconds for precision
    let remainingSeconds = etaMinutes * 60;
    const totalSeconds = etaMinutes * 60;
    setEtaCountdown({ mins: etaMinutes, secs: 0, totalSeconds });

    countdownRef.current = setInterval(() => {
      remainingSeconds -= 1;

      if (remainingSeconds <= 0) {
        clearInterval(countdownRef.current);
        setEtaCountdown(0);
        return;
      }

      // Convert back to minutes — show "X mins Y secs" when under 2 mins
      const mins = Math.floor(remainingSeconds / 60);
      const secs = remainingSeconds % 60;

      setEtaCountdown({ mins, secs, totalSeconds: remainingSeconds });
    }, 1000);
  };

  useEffect(() => {
    setStatus("ASSIGNED");
    setEta(null);
    setEtaCountdown(null);
    deliveredRef.current = false;

    if (countdownRef.current) {
      clearInterval(countdownRef.current);
    }

    if (!stompClient || !orderId) return;

    const topic = `/topic/order/${orderId}/status`;
    console.log(`Subscribing to: ${topic}`);

    let subscription;
    try {
      subscription = stompClient.subscribe(topic, (message) => {
        const data = JSON.parse(message.body);
        console.log("Order status received:", data);
        setStatus(data.status);

        if (data.eta) {
          setEta(data.eta);
          startCountdown(data.eta);
        }

        if (data.status === "DELIVERED" && !deliveredRef.current) {
          deliveredRef.current = true;
          if (countdownRef.current) clearInterval(countdownRef.current);
          setEtaCountdown(null);
          setTimeout(() => {
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
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    };
  }, [stompClient, orderId]);

  return { status, eta, etaCountdown };
}