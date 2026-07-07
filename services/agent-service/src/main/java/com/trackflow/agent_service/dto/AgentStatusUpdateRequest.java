package com.trackflow.agent_service.dto;


import com.trackflow.agent_service.model.AgentStatus;
import lombok.Data;

@Data
public class AgentStatusUpdateRequest {
    private AgentStatus status;
}