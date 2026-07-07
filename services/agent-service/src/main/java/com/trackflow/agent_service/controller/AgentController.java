package com.trackflow.agent_service.controller;


import com.trackflow.agent_service.dto.AgentRegistrationRequest;
import com.trackflow.agent_service.dto.AgentResponse;
import com.trackflow.agent_service.dto.AgentStatusUpdateRequest;
import com.trackflow.agent_service.service.AgentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/agents")
@RequiredArgsConstructor
public class AgentController {

    private final AgentService agentService;

    @PostMapping("/register")
    public ResponseEntity<AgentResponse> register(
            @RequestBody AgentRegistrationRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(agentService.registerAgent(request));
    }

    @PatchMapping("/{agentId}/status")
    public ResponseEntity<AgentResponse> updateStatus(
            @PathVariable String agentId,
            @RequestBody AgentStatusUpdateRequest request) {
        return ResponseEntity.ok(agentService.updateStatus(agentId, request));
    }

    @GetMapping
    public ResponseEntity<List<AgentResponse>> getAllAgents() {
        return ResponseEntity.ok(agentService.getAllAgents());
    }

    @GetMapping("/{agentId}")
    public ResponseEntity<AgentResponse> getAgent(
            @PathVariable String agentId) {
        return ResponseEntity.ok(agentService.getAgent(agentId));
    }
}