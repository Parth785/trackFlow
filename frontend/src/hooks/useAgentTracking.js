import { useEffect, useState, useRef } from "react";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";

const TRACKING_WS_URL = "http://localhost:8082/ws-tracking";

export function useAgentTracking() {
  const [agents, setAgents] = useState({});
  const [connected, setConnected] = useState(false);
  const [stompClient, setStompClient] = useState(null);
  const clientRef = useRef(null);

  useEffect(() => {
    const client = new Client({
      webSocketFactory: () => new SockJS(TRACKING_WS_URL),

      onConnect: () => {
        setConnected(true);
        setStompClient(client);
        console.log("WebSocket connected");

        client.subscribe("/topic/agents", (message) => {
          const data = JSON.parse(message.body);
          console.log(`Agent ${data.agentId} bearing: ${data.bearing}`);

          setAgents((prev) => {
            const existing = prev[data.agentId];
            const prevTrail = existing?.trail || [];
            const newTrail = [
              ...prevTrail,
              [data.lat, data.lng]
            ].slice(-50);

            return {
              ...prev,
              [data.agentId]: {
                agentId: data.agentId,
                lat: data.lat,
                lng: data.lng,
                bearing: data.bearing,
                timestamp: data.timestamp,
                lastSeen: Date.now(),
                trail: newTrail,
              },
            };
          });
        });
      },

      onDisconnect: () => {
        setConnected(false);
        setStompClient(null);
        console.log("WebSocket disconnected");
      },

      onStompError: (frame) => {
        console.error("STOMP error:", frame);
      },

      reconnectDelay: 3000,
    });

    client.activate();
    clientRef.current = client;

    return () => client.deactivate();
  }, []);

  return { agents, connected, stompClient };
}