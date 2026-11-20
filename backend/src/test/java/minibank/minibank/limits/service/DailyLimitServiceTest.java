package minibank.minibank.limits.service;

import minibank.minibank.accounts.entity.Account;
import minibank.minibank.accounts.entity.AccountStatus;
import minibank.minibank.accounts.entity.Currency;
import minibank.minibank.accounts.repository.AccountRepository;
import minibank.minibank.audit.service.AuditService;
import minibank.minibank.common.error.ErrorCodes;
import minibank.minibank.common.exception.BusinessException;
import minibank.minibank.common.exception.ForbiddenOperationException;
import minibank.minibank.limits.dto.UpdateDailyLimitRequest;
import minibank.minibank.limits.entity.DailyLimit;
import minibank.minibank.limits.repository.DailyLimitRepository;
import minibank.minibank.transfers.repository.TransferRepository;
import minibank.minibank.users.entity.Role;
import minibank.minibank.users.entity.User;
import minibank.minibank.users.entity.UserStatus;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DailyLimitServiceTest {

    private static final Instant NOW = Instant.parse("2026-07-26T10:15:30Z");
    private static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);

    @Mock
    private DailyLimitRepository dailyLimitRepository;

    @Mock
    private AccountRepository accountRepository;

    @Mock
    private TransferRepository transferRepository;

    @Mock
    private AuditService auditService;

    @Test
    void getLimitCreatesDefaultLimitAndCalculatesUsageForUtcDay() {
        DailyLimitService service = service();
        User user = user(UUID.randomUUID(), Role.CUSTOMER);
        Account account = account(user, UUID.randomUUID(), "111111111111", Currency.ARS);

        when(accountRepository.findOwnByIdForUpdate(account.getId(), user.getId())).thenReturn(Optional.of(account));
        when(dailyLimitRepository.findByAccountId(account.getId())).thenReturn(Optional.empty());
        when(dailyLimitRepository.save(any(DailyLimit.class))).thenAnswer(invocation -> persistedLimit(invocation.getArgument(0)));
        when(transferRepository.sumCompletedAmountBySourceAccountBetween(
                account.getId(),
                Instant.parse("2026-07-26T00:00:00Z"),
                Instant.parse("2026-07-27T00:00:00Z")
        )).thenReturn(new BigDecimal("125000.50"));

        var response = service.getLimit(user.getId(), Role.CUSTOMER, account.getId());

        ArgumentCaptor<DailyLimit> limitCaptor = ArgumentCaptor.forClass(DailyLimit.class);
        verify(dailyLimitRepository).save(limitCaptor.capture());
        assertThat(limitCaptor.getValue().getDailyLimit()).isEqualByComparingTo("500000.00");
        assertThat(response.accountId()).isEqualTo(account.getId());
        assertThat(response.accountNumber()).isEqualTo("111111111111");
        assertThat(response.currency()).isEqualTo(Currency.ARS);
        assertThat(response.dailyLimit()).isEqualByComparingTo("500000.00");
        assertThat(response.usedToday()).isEqualByComparingTo("125000.50");
        assertThat(response.availableToday()).isEqualByComparingTo("374999.50");
        assertThat(response.date()).isEqualTo("2026-07-26");
    }

    @Test
    void updateLimitAllowsCustomerToDecreaseOwnLimit() {
        DailyLimitService service = service();
        User user = user(UUID.randomUUID(), Role.CUSTOMER);
        Account account = account(user, UUID.randomUUID(), "111111111111", Currency.ARS);
        DailyLimit dailyLimit = dailyLimit(account, "500000.00");

        when(accountRepository.findOwnByIdForUpdate(account.getId(), user.getId())).thenReturn(Optional.of(account));
        when(dailyLimitRepository.findByAccountId(account.getId())).thenReturn(Optional.of(dailyLimit));
        when(dailyLimitRepository.saveAndFlush(dailyLimit)).thenReturn(dailyLimit);
        when(transferRepository.sumCompletedAmountBySourceAccountBetween(any(), any(), any()))
                .thenReturn(new BigDecimal("0.00"));

        var response = service.updateLimit(
                user.getId(),
                Role.CUSTOMER,
                account.getId(),
                new UpdateDailyLimitRequest(new BigDecimal("250000.00")),
                "127.0.0.1"
        );

        assertThat(dailyLimit.getDailyLimit()).isEqualByComparingTo("250000.00");
        assertThat(response.dailyLimit()).isEqualByComparingTo("250000.00");
    }

    @Test
    void updateLimitRejectsCustomerIncrease() {
        DailyLimitService service = service();
        User user = user(UUID.randomUUID(), Role.CUSTOMER);
        Account account = account(user, UUID.randomUUID(), "111111111111", Currency.ARS);
        DailyLimit dailyLimit = dailyLimit(account, "500000.00");

        when(accountRepository.findOwnByIdForUpdate(account.getId(), user.getId())).thenReturn(Optional.of(account));
        when(dailyLimitRepository.findByAccountId(account.getId())).thenReturn(Optional.of(dailyLimit));

        assertThatThrownBy(() -> service.updateLimit(
                user.getId(),
                Role.CUSTOMER,
                account.getId(),
                new UpdateDailyLimitRequest(new BigDecimal("500000.01")),
                "127.0.0.1"
        ))
                .isInstanceOf(ForbiddenOperationException.class)
                .hasMessage("Customers can only decrease their daily limit");

        verify(dailyLimitRepository, never()).saveAndFlush(any(DailyLimit.class));
    }

    @Test
    void updateLimitAllowsAdminIncrease() {
        DailyLimitService service = service();
        User owner = user(UUID.randomUUID(), Role.CUSTOMER);
        Account account = account(owner, UUID.randomUUID(), "111111111111", Currency.ARS);
        DailyLimit dailyLimit = dailyLimit(account, "500000.00");
        UUID adminId = UUID.randomUUID();

        when(accountRepository.findByIdForUpdate(account.getId())).thenReturn(Optional.of(account));
        when(dailyLimitRepository.findByAccountId(account.getId())).thenReturn(Optional.of(dailyLimit));
        when(dailyLimitRepository.saveAndFlush(dailyLimit)).thenReturn(dailyLimit);
        when(transferRepository.sumCompletedAmountBySourceAccountBetween(any(), any(), any()))
                .thenReturn(new BigDecimal("0.00"));

        var response = service.updateLimit(
                adminId,
                Role.ADMIN,
                account.getId(),
                new UpdateDailyLimitRequest(new BigDecimal("750000.00")),
                "127.0.0.1"
        );

        assertThat(response.dailyLimit()).isEqualByComparingTo("750000.00");
    }

    @Test
    void validateTransferWithinDailyLimitRejectsExceededLimit() {
        DailyLimitService service = service();
        User user = user(UUID.randomUUID(), Role.CUSTOMER);
        Account account = account(user, UUID.randomUUID(), "111111111111", Currency.ARS);
        DailyLimit dailyLimit = dailyLimit(account, "500000.00");

        when(dailyLimitRepository.findByAccountId(account.getId())).thenReturn(Optional.of(dailyLimit));
        when(transferRepository.sumCompletedAmountBySourceAccountBetween(
                account.getId(),
                Instant.parse("2026-07-26T00:00:00Z"),
                Instant.parse("2026-07-27T00:00:00Z")
        )).thenReturn(new BigDecimal("450000.00"));

        assertThatThrownBy(() -> service.validateTransferWithinDailyLimit(account, new BigDecimal("50000.01")))
                .isInstanceOfSatisfying(BusinessException.class, exception -> {
                    assertThat(exception.getCode()).isEqualTo(ErrorCodes.DAILY_LIMIT_EXCEEDED);
                    assertThat(exception.getMessage()).isEqualTo("Daily transfer limit exceeded");
                });
    }

    private DailyLimitService service() {
        return new DailyLimitService(dailyLimitRepository, accountRepository, transferRepository, CLOCK, auditService);
    }

    private User user(UUID id, Role role) {
        User user = new User("Jane", "Doe", id + "@example.com", id.toString(), "hashed-password", role, UserStatus.ACTIVE);
        ReflectionTestUtils.setField(user, "id", id);
        ReflectionTestUtils.setField(user, "createdAt", NOW);
        ReflectionTestUtils.setField(user, "updatedAt", NOW);
        return user;
    }

    private Account account(User user, UUID id, String accountNumber, Currency currency) {
        Account account = new Account(user, accountNumber, "main", currency, new BigDecimal("0.00"), AccountStatus.ACTIVE);
        ReflectionTestUtils.setField(account, "id", id);
        ReflectionTestUtils.setField(account, "createdAt", NOW);
        ReflectionTestUtils.setField(account, "updatedAt", NOW);
        return account;
    }

    private DailyLimit dailyLimit(Account account, String amount) {
        return persistedLimit(new DailyLimit(account, new BigDecimal(amount)));
    }

    private DailyLimit persistedLimit(DailyLimit dailyLimit) {
        ReflectionTestUtils.setField(dailyLimit, "id", UUID.randomUUID());
        ReflectionTestUtils.setField(dailyLimit, "createdAt", NOW);
        ReflectionTestUtils.setField(dailyLimit, "updatedAt", NOW);
        return dailyLimit;
    }
}
