package minibank.minibank.accounts.service;

import minibank.minibank.accounts.dto.CreditAccountRequest;
import minibank.minibank.accounts.entity.AccountStatus;
import minibank.minibank.accounts.repository.AccountRepository;
import minibank.minibank.audit.entity.AuditAction;
import minibank.minibank.audit.entity.AuditEntityType;
import minibank.minibank.audit.service.AuditService;
import minibank.minibank.common.exception.BusinessException;
import minibank.minibank.common.exception.NotFoundException;
import minibank.minibank.movements.entity.Movement;
import minibank.minibank.movements.entity.MovementOrigin;
import minibank.minibank.movements.entity.MovementType;
import minibank.minibank.movements.repository.MovementRepository;
import org.mockito.ArgumentCaptor;
import minibank.minibank.support.TestAccountFactory;
import minibank.minibank.support.TestUserFactory;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AdminAccountServiceTest {

    @Mock
    private AccountRepository accountRepository;

    @Mock
    private MovementRepository movementRepository;

    @Mock
    private AuditService auditService;

    @Test
    void blockChangesActiveAccountToBlockedAndAuditsChange() {
        AdminAccountService service = new AdminAccountService(accountRepository, movementRepository, auditService);
        UUID adminId = UUID.randomUUID();
        var owner = TestUserFactory.customer();
        var account = TestAccountFactory.activeArsAccount(owner, "111111111111", "100.00");

        when(accountRepository.findById(account.getId())).thenReturn(Optional.of(account));
        when(accountRepository.saveAndFlush(account)).thenReturn(account);

        var response = service.block(adminId, account.getId(), "127.0.0.1");

        assertThat(account.getStatus()).isEqualTo(AccountStatus.BLOCKED);
        assertThat(response.status()).isEqualTo(AccountStatus.BLOCKED);
        verify(auditService).record(
                adminId,
                AuditAction.ACCOUNT_BLOCKED,
                AuditEntityType.ACCOUNT,
                account.getId(),
                "accountId=%s,userId=%s,previousStatus=ACTIVE,newStatus=BLOCKED".formatted(account.getId(), owner.getId()),
                "127.0.0.1"
        );
    }

    @Test
    void blockRejectsAccountThatIsNotActive() {
        AdminAccountService service = new AdminAccountService(accountRepository, movementRepository, auditService);
        var owner = TestUserFactory.customer();
        var account = TestAccountFactory.account(
                owner,
                UUID.randomUUID(),
                "111111111111",
                minibank.minibank.accounts.entity.Currency.ARS,
                "main",
                "100.00",
                AccountStatus.BLOCKED
        );

        when(accountRepository.findById(account.getId())).thenReturn(Optional.of(account));

        assertThatThrownBy(() -> service.block(UUID.randomUUID(), account.getId(), "127.0.0.1"))
                .isInstanceOf(BusinessException.class)
                .hasMessage("Only active accounts can be blocked");

        verify(accountRepository, never()).saveAndFlush(any());
        verify(auditService, never()).record(any(), any(), any(), any(), any(), any());
    }

    @Test
    void activateRejectsMissingAccount() {
        AdminAccountService service = new AdminAccountService(accountRepository, movementRepository, auditService);
        UUID accountId = UUID.randomUUID();

        when(accountRepository.findById(accountId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.activate(UUID.randomUUID(), accountId, "127.0.0.1"))
                .isInstanceOf(NotFoundException.class)
                .hasMessage("Account not found");
    }

    @Test
    void creditBalanceCreditsActiveAccountAndAuditsChange() {
        AdminAccountService service = new AdminAccountService(accountRepository, movementRepository, auditService);
        UUID adminId = UUID.randomUUID();
        var owner = TestUserFactory.customer();
        var account = TestAccountFactory.activeArsAccount(owner, "111111111111", "100.00");
        var request = new CreditAccountRequest(new BigDecimal("250.50"));

        when(accountRepository.findByIdForUpdate(account.getId())).thenReturn(Optional.of(account));
        when(accountRepository.saveAndFlush(account)).thenReturn(account);

        var response = service.creditBalance(adminId, account.getId(), request, "127.0.0.1");

        assertThat(account.getBalance()).isEqualByComparingTo("350.50");
        assertThat(response.balance()).isEqualByComparingTo("350.50");
        verify(accountRepository).findByIdForUpdate(account.getId());
        ArgumentCaptor<Movement> movement = ArgumentCaptor.forClass(Movement.class);
        verify(movementRepository).save(movement.capture());
        assertThat(movement.getValue().getAccount()).isSameAs(account);
        assertThat(movement.getValue().getTransfer()).isNull();
        assertThat(movement.getValue().getType()).isEqualTo(MovementType.CREDIT);
        assertThat(movement.getValue().getOrigin()).isEqualTo(MovementOrigin.ADMIN_CREDIT);
        assertThat(movement.getValue().getAmount()).isEqualByComparingTo("250.50");
        assertThat(movement.getValue().getBalanceAfter()).isEqualByComparingTo("350.50");
        verify(auditService).record(
                adminId,
                AuditAction.ACCOUNT_CREDITED,
                AuditEntityType.ACCOUNT,
                account.getId(),
                "accountId=%s,userId=%s,amount=250.50,previousBalance=100.00,newBalance=350.50".formatted(
                        account.getId(),
                        owner.getId()
                ),
                "127.0.0.1"
        );
    }

    @Test
    void creditBalanceRejectsMissingAccount() {
        AdminAccountService service = new AdminAccountService(accountRepository, movementRepository, auditService);
        UUID accountId = UUID.randomUUID();

        when(accountRepository.findByIdForUpdate(accountId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.creditBalance(
                UUID.randomUUID(),
                accountId,
                new CreditAccountRequest(new BigDecimal("100.00")),
                "127.0.0.1"
        ))
                .isInstanceOf(NotFoundException.class)
                .hasMessage("Account not found");

        verify(accountRepository, never()).saveAndFlush(any());
        verify(auditService, never()).record(any(), any(), any(), any(), any(), any());
    }

    @Test
    void creditBalanceRejectsInactiveAccount() {
        AdminAccountService service = new AdminAccountService(accountRepository, movementRepository, auditService);
        var owner = TestUserFactory.customer();
        var account = TestAccountFactory.account(
                owner,
                UUID.randomUUID(),
                "111111111111",
                minibank.minibank.accounts.entity.Currency.ARS,
                "main",
                "100.00",
                AccountStatus.BLOCKED
        );

        when(accountRepository.findByIdForUpdate(account.getId())).thenReturn(Optional.of(account));

        assertThatThrownBy(() -> service.creditBalance(
                UUID.randomUUID(),
                account.getId(),
                new CreditAccountRequest(new BigDecimal("100.00")),
                "127.0.0.1"
        ))
                .isInstanceOf(BusinessException.class)
                .hasMessage("Only active accounts can be credited");

        verify(accountRepository, never()).saveAndFlush(any());
        verify(auditService, never()).record(any(), any(), any(), any(), any(), any());
    }
}
