import { useState } from "react";
import axios from "axios";

const ORDER_SERVICE_URL = "http://localhost:8095";

export function usePlaceOrder() {
  const [order, setOrder] = useState(null);
  const [routes, setRoutes] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const placeOrder = async (pickupLat, pickupLng, dropLat, dropLng) => {
    setLoading(true);
    setError(null);

    try {
      // Step 1 — place the order
      const orderRes = await axios.post(`${ORDER_SERVICE_URL}/api/orders`, {
        customerId: "customer-web-01",
        pickupLat,
        pickupLng,
        pickupAddress: `${pickupLat.toFixed(4)}, ${pickupLng.toFixed(4)}`,
        dropLat,
        dropLng,
        dropAddress: `${dropLat.toFixed(4)}, ${dropLng.toFixed(4)}`,
      });

      const placedOrder = orderRes.data;
      console.log("Order placed:", placedOrder);

      // Step 2 — set order so useOrderStatus subscribes immediately
      setOrder(placedOrder);

      // Step 3 — wait for subscription to be set up before route fetch
      // This prevents missing status updates that fire quickly
      await new Promise(resolve => setTimeout(resolve, 800));

      // Step 4 — fetch route lines
      const routeRes = await axios.get(
        `${ORDER_SERVICE_URL}/api/orders/${placedOrder.id}/route`
      );

      console.log("Routes fetched:", routeRes.data);
      setRoutes(routeRes.data);

      return { order: placedOrder, routes: routeRes.data };

    } catch (err) {
      const message = err.response?.data?.message
        || err.response?.data
        || err.message;
      console.error("Order placement failed:", err);
      setError(String(message));
    } finally {
      setLoading(false);
    }
  };

  const clearOrder = () => {
    setOrder(null);
    setRoutes(null);
    setError(null);
  };

  return { placeOrder, order, routes, loading, error, clearOrder };
}