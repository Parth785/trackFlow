import { useState, useEffect, useRef, useCallback } from "react";

function distanceBetween(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function findClosestIndex(agentLat, agentLng, waypoints) {
  if (!waypoints || waypoints.length < 2) return 0;
  let closestIndex = 0;
  let closestDistance = Infinity;
  waypoints.forEach(([lat, lng], index) => {
    const dist = distanceBetween(agentLat, agentLng, lat, lng);
    if (dist < closestDistance) {
      closestDistance = dist;
      closestIndex = index;
    }
  });
  return closestIndex;
}

export function useRouteProgress(agentPos, orderStatus) {
  const [trimmedRoutes, setTrimmedRoutes] = useState(null);
  const originalRoutes = useRef(null);

  const setRoutes = useCallback((routes) => {
    if (!routes) {
      originalRoutes.current = null;
      setTrimmedRoutes(null);
      return;
    }
    originalRoutes.current = routes;
    setTrimmedRoutes({
      ...routes,
      agentToPickup: routes.agentToPickup || [],
      pickupToDrop: [],
    });
  }, []);

  useEffect(() => {
    // Nothing to trim without position or routes
    if (!agentPos || !originalRoutes.current) return;

    const { lat: agentLat, lng: agentLng } = agentPos;

    setTrimmedRoutes(prev => {
      // Guard against null prev
      if (!prev || !originalRoutes.current) return prev;

      if (orderStatus === "ASSIGNED" || orderStatus === null) {
        const agentToPickup = originalRoutes.current.agentToPickup;
        if (!agentToPickup || agentToPickup.length < 2) return prev;

        const trimIndex = findClosestIndex(agentLat, agentLng, agentToPickup);
        const remaining = agentToPickup.slice(trimIndex);

        return {
          ...prev,
          agentToPickup: remaining.length >= 2 ? remaining : [],
          pickupToDrop: [],
        };
      }

      if (orderStatus === "PICKED_UP") {
        const pickupToDrop = originalRoutes.current.pickupToDrop;
        if (!pickupToDrop || pickupToDrop.length < 2) return prev;

        const trimIndex = findClosestIndex(agentLat, agentLng, pickupToDrop);
        const remaining = pickupToDrop.slice(trimIndex);

        return {
          ...prev,
          agentToPickup: [],
          pickupToDrop: remaining.length >= 2 ? remaining : [],
        };
      }

      if (orderStatus === "DELIVERED") {
        return {
          ...prev,
          agentToPickup: [],
          pickupToDrop: [],
        };
      }

      return prev;
    });

  }, [agentPos?.lat, agentPos?.lng, orderStatus]);

  return { trimmedRoutes, setRoutes };
}