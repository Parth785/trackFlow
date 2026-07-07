import { useState, useEffect, useRef } from "react";

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

function findBestTrimIndex(agentLat, agentLng, waypoints) {
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

  // No look ahead — line disappears exactly where bike is
  return closestIndex;
}

export function useRouteProgress(routes, assignedAgent, orderStatus) {
  const [trimmedRoutes, setTrimmedRoutes] = useState(null);
  const originalRoutes = useRef(null);

  useEffect(() => {
    if (routes) {
      originalRoutes.current = routes;
      setTrimmedRoutes({
        ...routes,
        agentToPickup: routes.agentToPickup,
        pickupToDrop: [],
      });
    } else {
      originalRoutes.current = null;
      setTrimmedRoutes(null);
    }
  }, [routes]);

  useEffect(() => {
    if (!originalRoutes.current || !assignedAgent) return;

    const agentLat = assignedAgent.lat;
    const agentLng = assignedAgent.lng;

    setTrimmedRoutes(prev => {
      if (!prev) return null;

      if (orderStatus === "ASSIGNED" || orderStatus === null) {
        const agentToPickup = originalRoutes.current.agentToPickup;
        if (!agentToPickup || agentToPickup.length < 2) return prev;

        const trimIndex = findBestTrimIndex(agentLat, agentLng, agentToPickup);
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

        const trimIndex = findBestTrimIndex(agentLat, agentLng, pickupToDrop);
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

  }, [assignedAgent?.lat, assignedAgent?.lng, orderStatus]);

  return trimmedRoutes;
}