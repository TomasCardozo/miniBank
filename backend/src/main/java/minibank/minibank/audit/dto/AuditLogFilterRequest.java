package minibank.minibank.audit.dto;

import minibank.minibank.audit.entity.AuditAction;
import minibank.minibank.audit.entity.AuditEntityType;

import java.time.Instant;
import java.util.UUID;

public record AuditLogFilterRequest(
        UUID userId,
        AuditAction action,
        AuditEntityType entityType,
        UUID entityId,
        Instant from,
        Instant to
) {
}
