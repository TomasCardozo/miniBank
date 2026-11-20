package minibank.minibank.limits.service;

import minibank.minibank.accounts.entity.Account;
import minibank.minibank.accounts.repository.AccountRepository;
import minibank.minibank.audit.entity.AuditAction;
import minibank.minibank.audit.entity.AuditEntityType;
import minibank.minibank.audit.service.AuditService;
import minibank.minibank.common.error.ErrorCodes;
import minibank.minibank.common.exception.BusinessException;
import minibank.minibank.common.exception.ForbiddenOperationException;
import minibank.minibank.common.exception.NotFoundException;
import minibank.minibank.limits.dto.DailyLimitResponse;
import minibank.minibank.limits.dto.UpdateDailyLimitRequest;
import minibank.minibank.limits.entity.DailyLimit;
import minibank.minibank.limits.repository.DailyLimitRepository;
import minibank.minibank.transfers.repository.TransferRepository;
import minibank.minibank.users.entity.Role;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.UUID;

@Service
public class DailyLimitService {

    private static final BigDecimal DEFAULT_DAILY_LIMIT = new BigDecimal("500000.00");
    private static final String ACCOUNT_NOT_FOUND = "Account not found";

    private final DailyLimitRepository dailyLimitRepository;
    private final AccountRepository accountRepository;
    private final TransferRepository transferRepository;
    private final Clock clock;
    private final AuditService auditService;

    public DailyLimitService(
            DailyLimitRepository dailyLimitRepository,
            AccountRepository accountRepository,
            TransferRepository transferRepository,
            Clock clock,
            AuditService auditService
    ) {
        this.dailyLimitRepository = dailyLimitRepository;
        this.accountRepository = accountRepository;
        this.transferRepository = transferRepository;
        this.clock = clock;
        this.auditService = auditService;
    }

    @Transactional
    public DailyLimitResponse getLimit(UUID currentUserId, Role currentUserRole, UUID accountId) {
        Account account = findAccessibleAccount(currentUserId, currentUserRole, accountId);
        DailyLimit dailyLimit = getOrCreateDailyLimit(account);
        return toResponse(account, dailyLimit);
    }

    @Transactional
    public DailyLimitResponse updateLimit(
            UUID currentUserId,
            Role currentUserRole,
            UUID accountId,
            UpdateDailyLimitRequest request,
            String ipAddress
    ) {
        Account account = findAccessibleAccount(currentUserId, currentUserRole, accountId);
        DailyLimit dailyLimit = getOrCreateDailyLimit(account);
        BigDecimal previousLimit = dailyLimit.getDailyLimit();

        if (currentUserRole == Role.CUSTOMER && request.dailyLimit().compareTo(dailyLimit.getDailyLimit()) > 0) {
            throw new ForbiddenOperationException("Customers can only decrease their daily limit");
        }

        dailyLimit.updateLimit(request.dailyLimit());
        DailyLimit savedDailyLimit = dailyLimitRepository.saveAndFlush(dailyLimit);
        auditService.record(
                currentUserId,
                AuditAction.DAILY_LIMIT_UPDATED,
                AuditEntityType.DAILY_LIMIT,
                savedDailyLimit.getId(),
                "accountId=%s,previousLimit=%s,newLimit=%s,role=%s".formatted(
                        account.getId(),
                        previousLimit,
                        savedDailyLimit.getDailyLimit(),
                        currentUserRole
                ),
                ipAddress
        );
        return toResponse(account, savedDailyLimit);
    }

    @Transactional
    public void validateTransferWithinDailyLimit(Account sourceAccount, BigDecimal amount) {
        DailyLimit dailyLimit = dailyLimitRepository.findByAccountId(sourceAccount.getId())
                .orElseGet(() -> new DailyLimit(sourceAccount, DEFAULT_DAILY_LIMIT));
        BigDecimal usedToday = usedToday(sourceAccount.getId());

        if (usedToday.add(amount).compareTo(dailyLimit.getDailyLimit()) > 0) {
            throw new BusinessException(
                    ErrorCodes.DAILY_LIMIT_EXCEEDED,
                    "Daily transfer limit exceeded",
                    HttpStatus.UNPROCESSABLE_ENTITY
            );
        }
    }

    private Account findAccessibleAccount(UUID currentUserId, Role currentUserRole, UUID accountId) {
        if (currentUserRole == Role.ADMIN) {
            return accountRepository.findByIdForUpdate(accountId)
                    .orElseThrow(() -> new NotFoundException(ACCOUNT_NOT_FOUND));
        }

        if (currentUserRole == Role.CUSTOMER) {
            return accountRepository.findOwnByIdForUpdate(accountId, currentUserId)
                    .orElseThrow(() -> new NotFoundException(ACCOUNT_NOT_FOUND));
        }

        throw new ForbiddenOperationException("Only customers and admins can manage daily limits");
    }

    private DailyLimit getOrCreateDailyLimit(Account account) {
        return dailyLimitRepository.findByAccountId(account.getId())
                .orElseGet(() -> dailyLimitRepository.save(new DailyLimit(account, DEFAULT_DAILY_LIMIT)));
    }

    private DailyLimitResponse toResponse(Account account, DailyLimit dailyLimit) {
        BigDecimal usedToday = usedToday(account.getId());
        BigDecimal availableToday = dailyLimit.getDailyLimit().subtract(usedToday).max(BigDecimal.ZERO);

        return new DailyLimitResponse(
                account.getId(),
                account.getAccountNumber(),
                account.getCurrency(),
                dailyLimit.getDailyLimit(),
                usedToday,
                availableToday,
                todayUtc(),
                dailyLimit.getUpdatedAt()
        );
    }

    private BigDecimal usedToday(UUID accountId) {
        LocalDate today = todayUtc();
        Instant from = today.atStartOfDay(ZoneOffset.UTC).toInstant();
        Instant to = today.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant();
        return transferRepository.sumCompletedAmountBySourceAccountBetween(accountId, from, to);
    }

    private LocalDate todayUtc() {
        return LocalDate.now(clock.withZone(ZoneOffset.UTC));
    }
}
