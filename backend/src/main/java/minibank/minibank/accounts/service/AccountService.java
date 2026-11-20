package minibank.minibank.accounts.service;

import minibank.minibank.accounts.dto.AccountResponse;
import minibank.minibank.accounts.dto.BalanceResponse;
import minibank.minibank.accounts.dto.CreateAccountRequest;
import minibank.minibank.accounts.dto.UpdateAliasRequest;
import minibank.minibank.accounts.entity.Account;
import minibank.minibank.accounts.entity.AccountStatus;
import minibank.minibank.accounts.repository.AccountRepository;
import minibank.minibank.common.exception.NotFoundException;
import minibank.minibank.users.entity.User;
import minibank.minibank.users.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Service
public class AccountService {

    private static final BigDecimal ZERO_BALANCE = new BigDecimal("0.00");
    private static final String ACCOUNT_NOT_FOUND = "Account not found";

    private final AccountRepository accountRepository;
    private final UserRepository userRepository;
    private final AccountNumberGenerator accountNumberGenerator;

    public AccountService(
            AccountRepository accountRepository,
            UserRepository userRepository,
            AccountNumberGenerator accountNumberGenerator
    ) {
        this.accountRepository = accountRepository;
        this.userRepository = userRepository;
        this.accountNumberGenerator = accountNumberGenerator;
    }

    @Transactional
    public AccountResponse create(UUID currentUserId, CreateAccountRequest request) {
        User user = userRepository.findById(currentUserId)
                .orElseThrow(() -> new NotFoundException("User not found"));

        Account account = new Account(
                user,
                accountNumberGenerator.generateUniqueAccountNumber(),
                request.alias(),
                request.currency(),
                ZERO_BALANCE,
                AccountStatus.ACTIVE
        );

        return toAccountResponse(accountRepository.save(account), currentUserId);
    }

    @Transactional(readOnly = true)
    public List<AccountResponse> listOwnAccounts(UUID currentUserId) {
        return accountRepository.findByUserIdOrderByCreatedAtDesc(currentUserId)
                .stream()
                .map(account -> toAccountResponse(account, currentUserId))
                .toList();
    }

    @Transactional(readOnly = true)
    public AccountResponse getOwnAccount(UUID currentUserId, UUID accountId) {
        return toAccountResponse(findOwnAccount(currentUserId, accountId), currentUserId);
    }

    @Transactional(readOnly = true)
    public BalanceResponse getOwnBalance(UUID currentUserId, UUID accountId) {
        Account account = findOwnAccount(currentUserId, accountId);
        return new BalanceResponse(
                account.getId(),
                account.getAccountNumber(),
                account.getCurrency(),
                account.getBalance()
        );
    }

    @Transactional
    public AccountResponse updateAlias(UUID currentUserId, UUID accountId, UpdateAliasRequest request) {
        Account account = findOwnAccount(currentUserId, accountId);
        account.updateAlias(request.alias());
        return toAccountResponse(accountRepository.saveAndFlush(account), currentUserId);
    }

    private Account findOwnAccount(UUID currentUserId, UUID accountId) {
        return accountRepository.findByIdAndUserId(accountId, currentUserId)
                .orElseThrow(() -> new NotFoundException(ACCOUNT_NOT_FOUND));
    }

    private AccountResponse toAccountResponse(Account account, UUID userId) {
        return new AccountResponse(
                account.getId(),
                userId,
                account.getAccountNumber(),
                account.getAlias(),
                account.getCurrency(),
                account.getBalance(),
                account.getStatus(),
                account.getCreatedAt(),
                account.getUpdatedAt()
        );
    }
}
