package com.trackflow.tracking_service.service;

import com.trackflow.tracking_service.dto.LocationBroadcast;
import com.trackflow.tracking_service.dto.LocationPingRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.geo.Point;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class TrackingService {

    private final RedisTemplate<String, String> redisTemplate;
    private final SimpMessagingTemplate messagingTemplate;

    private static final String REDIS_GEO_KEY = "agents:live";

    public void processLocationPing(LocationPingRequest request) {

        // 1. Update Redis GEO with new coordinates
        redisTemplate.opsForGeo().add(
                REDIS_GEO_KEY,
                new Point(request.getLng(), request.getLat()),
                request.getAgentId()
        );

        // 2. Build broadcast payload
        LocationBroadcast broadcast = LocationBroadcast.builder()
                .agentId(request.getAgentId())
                .lat(request.getLat())
                .lng(request.getLng())
                .bearing(request.getBearing())
                .timestamp(request.getTimestamp())
                .build();

        // 3. Push to ALL clients subscribed to /topic/agents (admin dashboard view)
        messagingTemplate.convertAndSend("/topic/agents", broadcast);

        // 4. Push to clients subscribed to this SPECIFIC agent's channel
        messagingTemplate.convertAndSend("/topic/agent/" + request.getAgentId(), broadcast);

        log.info("Location processed for agent {}: ({}, {})",
                request.getAgentId(), request.getLat(), request.getLng());
    }
}
