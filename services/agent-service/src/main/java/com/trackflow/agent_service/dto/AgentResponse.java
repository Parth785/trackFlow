package com.trackflow.agent_service.dto;

import com.trackflow.agent_service.model.AgentStatus;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class AgentResponse {
    private String id;
    private String name;
    private String phone;
    private String vehicleType;
    private AgentStatus status;
    private double lastKnownLat;
    private double lastKnownLng;
}
