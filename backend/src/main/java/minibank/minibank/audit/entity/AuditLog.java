package minibank.minibank.audit.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import minibank.minibank.users.entity.User;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

@Getter
@Entity
@Table(name = "audit_logs")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private AuditAction action;

    @Enumerated(EnumType.STRING)
    @Column(name = "entity_type", nullable = false, length = 40)
    private AuditEntityType entityType;

    @Column(name = "entity_id")
    private UUID entityId;

    @Column(columnDefinition = "text")
    private String details;

    @Column(name = "ip_address", length = 45)
    private String ipAddress;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    public AuditLog(
            User user,
            AuditAction action,
            AuditEntityType entityType,
            UUID entityId,
            String details,
            String ipAddress
    ) {
        this.user = user;
        this.action = Objects.requireNonNull(action, "action is required");
        this.entityType = Objects.requireNonNull(entityType, "entityType is required");
        this.entityId = entityId;
        this.details = details;
        this.ipAddress = ipAddress;
    }

    @PrePersist
    void prePersist() {
        createdAt = Instant.now();
    }
}
