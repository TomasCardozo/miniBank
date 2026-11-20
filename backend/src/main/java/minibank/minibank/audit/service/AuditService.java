package minibank.minibank.audit.service;

import jakarta.persistence.criteria.Predicate;
import minibank.minibank.audit.dto.AuditLogFilterRequest;
import minibank.minibank.audit.dto.AuditLogResponse;
import minibank.minibank.audit.entity.AuditAction;
import minibank.minibank.audit.entity.AuditEntityType;
import minibank.minibank.audit.entity.AuditLog;
import minibank.minibank.audit.repository.AuditLogRepository;
import minibank.minibank.users.entity.User;
import minibank.minibank.users.repository.UserRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

@Service
public class AuditService {

    private final AuditLogRepository auditLogRepository;
    private final UserRepository userRepository;

    public AuditService(AuditLogRepository auditLogRepository, UserRepository userRepository) {
        this.auditLogRepository = auditLogRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public void record(
            UUID userId,
            AuditAction action,
            AuditEntityType entityType,
            UUID entityId,
            String details,
            String ipAddress
    ) {
        save(userId, action, entityType, entityId, details, ipAddress);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordRequiresNew(
            UUID userId,
            AuditAction action,
            AuditEntityType entityType,
            UUID entityId,
            String details,
            String ipAddress
    ) {
        save(userId, action, entityType, entityId, details, ipAddress);
    }

    @Transactional(readOnly = true)
    public Page<AuditLogResponse> list(AuditLogFilterRequest filter, Pageable pageable) {
        return auditLogRepository.findAll(auditLogs(filter), pageable)
                .map(this::toResponse);
    }

    private Specification<AuditLog> auditLogs(AuditLogFilterRequest filter) {
        return (root, query, criteriaBuilder) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (filter.userId() != null) {
                predicates.add(criteriaBuilder.equal(root.get("user").get("id"), filter.userId()));
            }
            if (filter.action() != null) {
                predicates.add(criteriaBuilder.equal(root.get("action"), filter.action()));
            }
            if (filter.entityType() != null) {
                predicates.add(criteriaBuilder.equal(root.get("entityType"), filter.entityType()));
            }
            if (filter.entityId() != null) {
                predicates.add(criteriaBuilder.equal(root.get("entityId"), filter.entityId()));
            }
            if (filter.from() != null) {
                predicates.add(criteriaBuilder.greaterThanOrEqualTo(root.get("createdAt"), filter.from()));
            }
            if (filter.to() != null) {
                predicates.add(criteriaBuilder.lessThanOrEqualTo(root.get("createdAt"), filter.to()));
            }

            return criteriaBuilder.and(predicates.toArray(Predicate[]::new));
        };
    }

    private void save(
            UUID userId,
            AuditAction action,
            AuditEntityType entityType,
            UUID entityId,
            String details,
            String ipAddress
    ) {
        Objects.requireNonNull(action, "action is required");
        Objects.requireNonNull(entityType, "entityType is required");
        User user = userId == null ? null : userRepository.getReferenceById(userId);
        auditLogRepository.save(new AuditLog(user, action, entityType, entityId, details, ipAddress));
    }

    private AuditLogResponse toResponse(AuditLog auditLog) {
        return new AuditLogResponse(
                auditLog.getId(),
                auditLog.getUser() == null ? null : auditLog.getUser().getId(),
                auditLog.getAction(),
                auditLog.getEntityType(),
                auditLog.getEntityId(),
                auditLog.getDetails(),
                auditLog.getIpAddress(),
                auditLog.getCreatedAt()
        );
    }
}
