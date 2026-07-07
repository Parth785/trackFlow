package com.trackflow.agent_service.repository;

import com.trackflow.agent_service.model.Agent;
import com.trackflow.agent_service.model.AgentStatus;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface AgentRepository extends MongoRepository<Agent, String> {
    List<Agent> findByStatus(AgentStatus status);
}