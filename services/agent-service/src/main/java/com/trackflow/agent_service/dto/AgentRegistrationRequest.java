package com.trackflow.agent_service.dto;

import lombok.Data;

@Data
public class AgentRegistrationRequest {
    private String name;
    private String phone;
    private String vehicleType;
    private double initialLat;
    private double initialLng;
}