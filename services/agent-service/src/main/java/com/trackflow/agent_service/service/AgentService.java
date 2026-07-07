package com.trackflow.agent_service.service;


import com.trackflow.agent_service.dto.AgentRegistrationRequest;
import com.trackflow.agent_service.dto.AgentResponse;
import com.trackflow.agent_service.dto.AgentStatusUpdateRequest;
import com.trackflow.agent_service.model.Agent;
import com.trackflow.agent_service.model.AgentStatus;
import com.trackflow.agent_service.repository.AgentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.geo.Point;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class AgentService {

    private final AgentRepository agentRepository;
    private final RedisTemplate<String, String> redisTemplate;

    private static final String REDIS_GEO_KEY = "agents:live";

    public AgentResponse registerAgent(AgentRegistrationRequest request) {
        Agent agent = Agent.builder()
                .name(request.getName())
                .phone(request.getPhone())
                .vehicleType(request.getVehicleType())
                .status(AgentStatus.AVAILABLE)
                .lastKnownLat(request.getInitialLat())
                .lastKnownLng(request.getInitialLng())
                .registeredAt(LocalDateTime.now())
                .lastActiveAt(LocalDateTime.now())
                .build();

        Agent saved = agentRepository.save(agent);

        redisTemplate.opsForGeo().add(
                REDIS_GEO_KEY,
                new Point(request.getInitialLng(), request.getInitialLat()),
                saved.getId()
        );

        log.info("Agent registered: {} at ({}, {})",
                saved.getId(), request.getInitialLat(), request.getInitialLng());

        return toResponse(saved);
    }

    public AgentResponse updateStatus(String agentId, AgentStatusUpdateRequest request) {
        Agent agent = agentRepository.findById(agentId)
                .orElseThrow(() -> new RuntimeException("Agent not found: " + agentId));

        agent.setStatus(request.getStatus());
        agent.setLastActiveAt(LocalDateTime.now());

        Agent saved = agentRepository.save(agent);
        log.info("Agent {} status updated to {}", agentId, request.getStatus());

        return toResponse(saved);
    }

    public List<AgentResponse> getAllAgents() {
        return agentRepository.findAll()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    public AgentResponse getAgent(String agentId) {
        Agent agent = agentRepository.findById(agentId)
                .orElseThrow(() -> new RuntimeException("Agent not found: " + agentId));
        return toResponse(agent);
    }

    private AgentResponse toResponse(Agent agent) {
        return AgentResponse.builder()
                .id(agent.getId())
                .name(agent.getName())
                .phone(agent.getPhone())
                .vehicleType(agent.getVehicleType())
                .status(agent.getStatus())
                .lastKnownLat(agent.getLastKnownLat())
                .lastKnownLng(agent.getLastKnownLng())
                .build();
    }
}