package minibank.minibank.accounts.service;

import minibank.minibank.accounts.dto.CreateAccountRequest;
import minibank.minibank.accounts.dto.UpdateAliasRequest;
import minibank.minibank.accounts.entity.Account;
import minibank.minibank.accounts.entity.AccountStatus;
import minibank.minibank.accounts.entity.Currency;
import minibank.minibank.accounts.repository.AccountRepository;
import minibank.minibank.common.exception.NotFoundException;
import minibank.minibank.users.entity.Role;
import minibank.minibank.users.entity.User;
import minibank.minibank.users.entity.UserStatus;
import minibank.minibank.users.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AccountServiceTest {

    private static final Instant NOW = Instant.parse("2026-07-26T10:00:00Z");

    @Mock
    private AccountRepository accountRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private AccountNumberGenerator accountNumberGenerator;

    @Test
    void createCreatesActiveAccountWithZeroBalance() {
        AccountService accountService = new AccountService(accountRepository, userRepository, accountNumberGenerator);
        User user = user(UUID.randomUUID(), "user@example.com");
        CreateAccountRequest request = new CreateAccountRequest(Currency.ARS, "main-account");

        when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));
        when(accountNumberGenerator.generateUniqueAccountNumber()).thenReturn("123456789012");
        when(accountRepository.save(any(Account.class))).thenAnswer(invocation -> {
            Account account = invocation.getArgument(0);
            setAccountPersistenceFields(account, UUID.randomUUID());
            return account;
        });

        var response = accountService.create(user.getId(), request);

        ArgumentCaptor<Account> accountCaptor = ArgumentCaptor.forClass(Account.class);
        verify(accountRepository).save(accountCaptor.capture());
        Account accountToSave = accountCaptor.getValue();

        assertThat(accountToSave.getUser()).isEqualTo(user);
        assertThat(accountToSave.getAccountNumber()).isEqualTo("123456789012");
        assertThat(accountToSave.getAlias()).isEqualTo("main-account");
        assertThat(accountToSave.getCurrency()).isEqualTo(Currency.ARS);
        assertThat(accountToSave.getBalance()).isEqualByComparingTo("0.00");
        assertThat(accountToSave.getStatus()).isEqualTo(AccountStatus.ACTIVE);
        assertThat(response.balance()).isEqualByComparingTo("0.00");
        assertThat(response.status()).isEqualTo(AccountStatus.ACTIVE);
    }

    @Test
    void createRejectsMissingAuthenticatedUser() {
        AccountService accountService = new AccountService(accountRepository, userRepository, accountNumberGenerator);
        UUID userId = UUID.randomUUID();

        when(userRepository.findById(userId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> accountService.create(userId, new CreateAccountRequest(Currency.ARS, null)))
                .isInstanceOf(NotFoundException.class)
                .hasMessage("User not found");

        verify(accountRepository, never()).save(any(Account.class));
    }

    @Test
    void listOwnAccountsReturnsRepositoryAccounts() {
        AccountService accountService = new AccountService(accountRepository, userRepository, accountNumberGenerator);
        User user = user(UUID.randomUUID(), "user@example.com");
        Account account = account(user, UUID.randomUUID(), "123456789012", Currency.USD, "savings");

        when(accountRepository.findByUserIdOrderByCreatedAtDesc(user.getId())).thenReturn(List.of(account));

        var response = accountService.listOwnAccounts(user.getId());

        assertThat(response).hasSize(1);
        assertThat(response.getFirst().id()).isEqualTo(account.getId());
        assertThat(response.getFirst().userId()).isEqualTo(user.getId());
    }

    @Test
    void getOwnAccountReturnsAccountWhenOwned() {
        AccountService accountService = new AccountService(accountRepository, userRepository, accountNumberGenerator);
        User user = user(UUID.randomUUID(), "user@example.com");
        Account account = account(user, UUID.randomUUID(), "123456789012", Currency.ARS, "main");

        when(accountRepository.findByIdAndUserId(account.getId(), user.getId())).thenReturn(Optional.of(account));

        var response = accountService.getOwnAccount(user.getId(), account.getId());

        assertThat(response.id()).isEqualTo(account.getId());
        assertThat(response.accountNumber()).isEqualTo("123456789012");
    }

    @Test
    void getOwnAccountRejectsForeignOrMissingAccountAsNotFound() {
        AccountService accountService = new AccountService(accountRepository, userRepository, accountNumberGenerator);
        UUID userId = UUID.randomUUID();
        UUID accountId = UUID.randomUUID();

        when(accountRepository.findByIdAndUserId(accountId, userId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> accountService.getOwnAccount(userId, accountId))
                .isInstanceOf(NotFoundException.class)
                .hasMessage("Account not found");
    }

    @Test
    void getOwnBalanceReturnsBalanceWhenOwned() {
        AccountService accountService = new AccountService(accountRepository, userRepository, accountNumberGenerator);
        User user = user(UUID.randomUUID(), "user@example.com");
        Account account = account(user, UUID.randomUUID(), "123456789012", Currency.USD, "savings");

        when(accountRepository.findByIdAndUserId(account.getId(), user.getId())).thenReturn(Optional.of(account));

        var response = accountService.getOwnBalance(user.getId(), account.getId());

        assertThat(response.accountId()).isEqualTo(account.getId());
        assertThat(response.accountNumber()).isEqualTo("123456789012");
        assertThat(response.currency()).isEqualTo(Currency.USD);
        assertThat(response.balance()).isEqualByComparingTo("0.00");
    }

    @Test
    void getOwnBalanceRejectsForeignOrMissingAccountAsNotFound() {
        AccountService accountService = new AccountService(accountRepository, userRepository, accountNumberGenerator);
        UUID userId = UUID.randomUUID();
        UUID accountId = UUID.randomUUID();

        when(accountRepository.findByIdAndUserId(accountId, userId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> accountService.getOwnBalance(userId, accountId))
                .isInstanceOf(NotFoundException.class)
                .hasMessage("Account not found");
    }

    @Test
    void updateAliasUpdatesOwnedAccount() {
        AccountService accountService = new AccountService(accountRepository, userRepository, accountNumberGenerator);
        User user = user(UUID.randomUUID(), "user@example.com");
        Account account = account(user, UUID.randomUUID(), "123456789012", Currency.ARS, "old-alias");

        when(accountRepository.findByIdAndUserId(account.getId(), user.getId())).thenReturn(Optional.of(account));
        when(accountRepository.saveAndFlush(account)).thenReturn(account);

        var response = accountService.updateAlias(user.getId(), account.getId(), new UpdateAliasRequest("new-alias"));

        assertThat(account.getAlias()).isEqualTo("new-alias");
        assertThat(response.alias()).isEqualTo("new-alias");
    }

    @Test
    void updateAliasRejectsForeignOrMissingAccountAsNotFound() {
        AccountService accountService = new AccountService(accountRepository, userRepository, accountNumberGenerator);
        UUID userId = UUID.randomUUID();
        UUID accountId = UUID.randomUUID();

        when(accountRepository.findByIdAndUserId(accountId, userId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> accountService.updateAlias(userId, accountId, new UpdateAliasRequest("new-alias")))
                .isInstanceOf(NotFoundException.class)
                .hasMessage("Account not found");
    }

    private User user(UUID id, String email) {
        User user = new User("Jane", "Doe", email, id.toString(), "hashed-password", Role.CUSTOMER, UserStatus.ACTIVE);
        ReflectionTestUtils.setField(user, "id", id);
        ReflectionTestUtils.setField(user, "createdAt", NOW);
        ReflectionTestUtils.setField(user, "updatedAt", NOW);
        return user;
    }

    private Account account(User user, UUID id, String accountNumber, Currency currency, String alias) {
        Account account = new Account(user, accountNumber, alias, currency, new BigDecimal("0.00"), AccountStatus.ACTIVE);
        setAccountPersistenceFields(account, id);
        return account;
    }

    private void setAccountPersistenceFields(Account account, UUID id) {
        ReflectionTestUtils.setField(account, "id", id);
        ReflectionTestUtils.setField(account, "createdAt", NOW);
        ReflectionTestUtils.setField(account, "updatedAt", NOW);
    }
}
