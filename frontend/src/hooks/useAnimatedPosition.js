import { useEffect, useRef, useState } from "react";

const PING_INTERVAL_MS = 3000;

const easeInOut = (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

export function useAnimatedPosition(agent) {
  const [animatedPos, setAnimatedPos] = useState(
    agent ? { lat: agent.lat, lng: agent.lng } : null
  );

  const animationRef = useRef(null);
  const startPosRef = useRef(null);
  const targetPosRef = useRef(null);
  const startTimeRef = useRef(null);

  useEffect(() => {
    if (!agent) return;

    // First render — just set position
    if (!startPosRef.current) {
      startPosRef.current = { lat: agent.lat, lng: agent.lng };
      targetPosRef.current = { lat: agent.lat, lng: agent.lng };
      setAnimatedPos({ lat: agent.lat, lng: agent.lng });
      return;
    }

    // New position arrived — animate from current to new
    if (animationRef.current) cancelAnimationFrame(animationRef.current);

    startPosRef.current = { ...animatedPos };
    targetPosRef.current = { lat: agent.lat, lng: agent.lng };
    startTimeRef.current = performance.now();

    const animate = (now) => {
      const elapsed = now - startTimeRef.current;
      const progress = Math.min(elapsed / PING_INTERVAL_MS, 1);
      const eased = easeInOut(progress);

      const lat = startPosRef.current.lat +
        (targetPosRef.current.lat - startPosRef.current.lat) * eased;
      const lng = startPosRef.current.lng +
        (targetPosRef.current.lng - startPosRef.current.lng) * eased;

      setAnimatedPos({ lat, lng });

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [agent?.lat, agent?.lng]);

  return animatedPos;
}