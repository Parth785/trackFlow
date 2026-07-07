package com.trackflow.order_service.kafka;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class OrderEventProducer {

    private final KafkaTemplate<String, String> kafkaTemplate;
    private final ObjectMapper objectMapper;

    public static final String ORDER_EVENTS_TOPIC = "order-events";

    public void publishOrderAssigned(
            String orderId,
            String agentId,
            double pickupLat, double pickupLng,
            double dropLat, double dropLng) {
        try {
            Map<String, Object> event = Map.of(
                    "eventType", "ORDER_ASSIGNED",
                    "orderId", orderId,
                    "agentId", agentId,
                    "pickupLat", pickupLat,
                    "pickupLng", pickupLng,
                    "dropLat", dropLat,
                    "dropLng", dropLng
            );

            String payload = objectMapper.writeValueAsString(event);
            kafkaTemplate.send(ORDER_EVENTS_TOPIC, orderId, payload);

            log.info("Published ORDER_ASSIGNED: orderId={} agentId={}", orderId, agentId);
        } catch (Exception e) {
            log.error("Failed to publish order event", e);
        }
    }

    public void publishOrderEvent(String orderId, String status, String agentId) {
        try {
            Map<String, Object> event = Map.of(
                    "eventType", status,
                    "orderId", orderId,
                    "agentId", agentId != null ? agentId : ""
            );

            String payload = objectMapper.writeValueAsString(event);
            kafkaTemplate.send(ORDER_EVENTS_TOPIC, orderId, payload);

            log.info("Published order event: orderId={} status={}", orderId, status);
        } catch (Exception e) {
            log.error("Failed to publish order event", e);
        }
    }
}