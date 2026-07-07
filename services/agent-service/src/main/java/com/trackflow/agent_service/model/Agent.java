package com.trackflow.agent_service.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "agents")
public class Agent {

    @Id
    private String id;

    private String name;
    private String phone;
    private String vehicleType;

    private AgentStatus status;

    private double lastKnownLat;
    private double lastKnownLng;

    private LocalDateTime registeredAt;
    private LocalDateTime lastActiveAt;
}