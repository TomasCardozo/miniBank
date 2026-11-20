package minibank.minibank.audit.service;

import minibank.minibank.audit.entity.AuditAction;
import minibank.minibank.audit.entity.AuditEntityType;
import minibank.minibank.audit.entity.AuditLog;
import minibank.minibank.audit.repository.AuditLogRepository;
import minibank.minibank.users.entity.Role;
import minibank.minibank.users.repository.UserRepository;
import minibank.minibank.support.TestUserFactory;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class AuditServiceTest {

    @Mock
    private AuditLogRepository auditLogRepository;

    @Mock
    private UserRepository userRepository;

    @Test
    void recordPersistsAuditLogWithReferencedUserWhenUserIdIsPresent() {
        AuditService auditService = new AuditService(auditLogRepository, userRepository);
        UUID userId = UUID.randomUUID();
        UUID entityId = UUID.randomUUID();
        var user = TestUserFactory.jwtOnlyUser(userId, "admin@example.com", Role.ADMIN);

        org.mockito.Mockito.when(userRepository.getReferenceById(userId)).thenReturn(user);

        auditService.record(
                userId,
                AuditAction.USER_BLOCKED,
                AuditEntityType.USER,
                entityId,
                "details",
                "127.0.0.1"
        );

        ArgumentCaptor<AuditLog> auditCaptor = ArgumentCaptor.forClass(AuditLog.class);
        verify(auditLogRepository).save(auditCaptor.capture());
        AuditLog auditLog = auditCaptor.getValue();
        assertThat(auditLog.getUser()).isEqualTo(user);
        assertThat(auditLog.getAction()).isEqualTo(AuditAction.USER_BLOCKED);
        assertThat(auditLog.getEntityType()).isEqualTo(AuditEntityType.USER);
        assertThat(auditLog.getEntityId()).isEqualTo(entityId);
        assertThat(auditLog.getDetails()).isEqualTo("details");
        assertThat(auditLog.getIpAddress()).isEqualTo("127.0.0.1");
    }

    @Test
    void recordAllowsSystemAuditLogWithoutUser() {
        AuditService auditService = new AuditService(auditLogRepository, userRepository);

        auditService.record(null, AuditAction.LOGIN_FAILURE, AuditEntityType.AUTH, null, "bad credentials", null);

        ArgumentCaptor<AuditLog> auditCaptor = ArgumentCaptor.forClass(AuditLog.class);
        verify(auditLogRepository).save(auditCaptor.capture());
        assertThat(auditCaptor.getValue().getUser()).isNull();
        assertThat(auditCaptor.getValue().getAction()).isEqualTo(AuditAction.LOGIN_FAILURE);
    }
}
