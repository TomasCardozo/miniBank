package minibank.minibank.users.service;

import minibank.minibank.audit.entity.AuditAction;
import minibank.minibank.audit.entity.AuditEntityType;
import minibank.minibank.audit.service.AuditService;
import minibank.minibank.common.exception.BusinessException;
import minibank.minibank.common.exception.NotFoundException;
import minibank.minibank.support.TestUserFactory;
import minibank.minibank.users.entity.Role;
import minibank.minibank.users.entity.UserStatus;
import minibank.minibank.users.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AdminUserServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private AuditService auditService;

    @Test
    void blockRejectsSelfBlockBeforeLoadingTargetUser() {
        AdminUserService service = new AdminUserService(userRepository, auditService);
        UUID adminId = UUID.randomUUID();

        assertThatThrownBy(() -> service.block(adminId, adminId, "127.0.0.1"))
                .isInstanceOf(BusinessException.class)
                .hasMessage("Admin users cannot block themselves");

        verify(userRepository, never()).findById(any());
        verify(auditService, never()).record(any(), any(), any(), any(), any(), any());
    }

    @Test
    void blockChangesActiveUserToBlockedAndAuditsChange() {
        AdminUserService service = new AdminUserService(userRepository, auditService);
        UUID adminId = UUID.randomUUID();
        var user = TestUserFactory.user(Role.CUSTOMER, UserStatus.ACTIVE);

        when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));
        when(userRepository.saveAndFlush(user)).thenReturn(user);

        var response = service.block(adminId, user.getId(), "127.0.0.1");

        assertThat(user.getStatus()).isEqualTo(UserStatus.BLOCKED);
        assertThat(response.status()).isEqualTo(UserStatus.BLOCKED);
        verify(auditService).record(
                adminId,
                AuditAction.USER_BLOCKED,
                AuditEntityType.USER,
                user.getId(),
                "targetUserId=%s,previousStatus=ACTIVE,newStatus=BLOCKED".formatted(user.getId()),
                "127.0.0.1"
        );
    }

    @Test
    void activateRejectsMissingUser() {
        AdminUserService service = new AdminUserService(userRepository, auditService);
        UUID targetUserId = UUID.randomUUID();

        when(userRepository.findById(targetUserId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.activate(UUID.randomUUID(), targetUserId, "127.0.0.1"))
                .isInstanceOf(NotFoundException.class)
                .hasMessage("User not found");
    }
}
