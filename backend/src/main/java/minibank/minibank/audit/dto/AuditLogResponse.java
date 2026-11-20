package minibank.minibank.audit.dto;

import minibank.minibank.audit.entity.AuditAction;
import minibank.minibank.audit.entity.AuditEntityType;

import java.time.Instant;
import java.util.UUID;

public record AuditLogResponse(
        UUID id,
        UUID userId,
        AuditAction action,
        AuditEntityType entityType,
        UUID entityId,
        String details,
        String ipAddress,
        Instant createdAt
) {
}
