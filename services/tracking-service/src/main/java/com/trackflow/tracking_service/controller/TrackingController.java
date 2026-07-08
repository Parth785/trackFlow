package com.trackflow.tracking_service.controller;

import com.trackflow.tracking_service.dto.LocationPingRequest;
import com.trackflow.tracking_service.service.TrackingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@Slf4j
@RestController
@RequiredArgsConstructor
public class TrackingController {

    private final TrackingService trackingService;
    private final SimpMessagingTemplate messagingTemplate;

    @PostMapping("/api/tracking/location")
    public ResponseEntity<Void> receiveLocationPing(
            @RequestBody LocationPingRequest request) {
        trackingService.processLocationPing(request);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/api/tracking/order-status")
    public ResponseEntity<Void> receiveOrderStatus(
            @RequestBody Map<String, Object> request) {

        String orderId = (String) request.get("orderId");
        String agentId = (String) request.get("agentId");
        String status = (String) request.get("status");

        Map<String, Object> payload = new java.util.HashMap<>(request);

        messagingTemplate.convertAndSend(
                "/topic/order/" + orderId + "/status",
                payload
        );

        log.info("Order status broadcast: {} -> {}", orderId, status);
        return ResponseEntity.ok().build();
    }
}