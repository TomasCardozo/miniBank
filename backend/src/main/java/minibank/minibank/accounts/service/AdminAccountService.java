package minibank.minibank.accounts.service;

import jakarta.persistence.criteria.Predicate;
import minibank.minibank.accounts.dto.AccountResponse;
import minibank.minibank.accounts.dto.AdminAccountFilterRequest;
import minibank.minibank.accounts.dto.AdminAccountResponse;
import minibank.minibank.accounts.dto.CreditAccountRequest;
import minibank.minibank.accounts.entity.Account;
import minibank.minibank.accounts.entity.AccountStatus;
import minibank.minibank.accounts.repository.AccountRepository;
import minibank.minibank.audit.entity.AuditAction;
import minibank.minibank.audit.entity.AuditEntityType;
import minibank.minibank.audit.service.AuditService;
import minibank.minibank.common.error.ErrorCodes;
import minibank.minibank.common.exception.BusinessException;
import minibank.minibank.common.exception.NotFoundException;
import minibank.minibank.movements.entity.Movement;
import minibank.minibank.movements.repository.MovementRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
public class AdminAccountService {

    private static final String ACCOUNT_NOT_FOUND = "Account not found";
    static final String ADMIN_CREDIT_DESCRIPTION = "Acreditacion administrativa";

    private final AccountRepository accountRepository;
    private final MovementRepository movementRepository;
    private final AuditService auditService;

    public AdminAccountService(
            AccountRepository accountRepository,
            MovementRepository movementRepository,
            AuditService auditService
    ) {
        this.accountRepository = accountRepository;
        this.movementRepository = movementRepository;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public Page<AdminAccountResponse> list(AdminAccountFilterRequest filter, Pageable pageable) {
        return accountRepository.findAll(accounts(filter), pageable)
                .map(this::toAdminResponse);
    }

    @Transactional
    public AccountResponse block(UUID adminUserId, UUID accountId, String ipAddress) {
        Account account = findAccount(accountId);
        if (account.getStatus() != AccountStatus.ACTIVE) {
            throw new BusinessException(
                    ErrorCodes.BUSINESS_RULE_VIOLATION,
                    "Only active accounts can be blocked",
                    HttpStatus.UNPROCESSABLE_ENTITY
            );
        }

        AccountStatus previousStatus = account.getStatus();
        account.block();
        auditAccountStatusChange(adminUserId, account, previousStatus, AuditAction.ACCOUNT_BLOCKED, ipAddress);
        return toResponse(accountRepository.saveAndFlush(account));
    }

    @Transactional
    public AccountResponse activate(UUID adminUserId, UUID accountId, String ipAddress) {
        Account account = findAccount(accountId);
        if (account.getStatus() != AccountStatus.BLOCKED) {
            throw new BusinessException(
                    ErrorCodes.BUSINESS_RULE_VIOLATION,
                    "Only blocked accounts can be activated",
                    HttpStatus.UNPROCESSABLE_ENTITY
            );
        }

        AccountStatus previousStatus = account.getStatus();
        account.activate();
        auditAccountStatusChange(adminUserId, account, previousStatus, AuditAction.ACCOUNT_ACTIVATED, ipAddress);
        return toResponse(accountRepository.saveAndFlush(account));
    }

    @Transactional
    public AccountResponse creditBalance(UUID adminUserId, UUID accountId, CreditAccountRequest request, String ipAddress) {
        Account account = findAccountForUpdate(accountId);
        if (account.getStatus() != AccountStatus.ACTIVE) {
            throw new BusinessException(
                    ErrorCodes.BUSINESS_RULE_VIOLATION,
                    "Only active accounts can be credited",
                    HttpStatus.UNPROCESSABLE_ENTITY
            );
        }

        BigDecimal previousBalance = account.getBalance();
        account.credit(request.amount());
        movementRepository.save(Movement.adminCredit(
                account,
                request.amount(),
                account.getBalance(),
                ADMIN_CREDIT_DESCRIPTION
        ));
        auditAccountCredit(adminUserId, account, request.amount(), previousBalance, ipAddress);
        return toResponse(accountRepository.saveAndFlush(account));
    }

    private Account findAccount(UUID accountId) {
        return accountRepository.findById(accountId)
                .orElseThrow(() -> new NotFoundException(ACCOUNT_NOT_FOUND));
    }

    private Account findAccountForUpdate(UUID accountId) {
        return accountRepository.findByIdForUpdate(accountId)
                .orElseThrow(() -> new NotFoundException(ACCOUNT_NOT_FOUND));
    }

    private void auditAccountStatusChange(
            UUID adminUserId,
            Account account,
            AccountStatus previousStatus,
            AuditAction action,
            String ipAddress
    ) {
        auditService.record(
                adminUserId,
                action,
                AuditEntityType.ACCOUNT,
                account.getId(),
                "accountId=%s,userId=%s,previousStatus=%s,newStatus=%s".formatted(
                        account.getId(),
                        account.getUser().getId(),
                        previousStatus,
                        account.getStatus()
                ),
                ipAddress
        );
    }

    private void auditAccountCredit(
            UUID adminUserId,
            Account account,
            BigDecimal amount,
            BigDecimal previousBalance,
            String ipAddress
    ) {
        auditService.record(
                adminUserId,
                AuditAction.ACCOUNT_CREDITED,
                AuditEntityType.ACCOUNT,
                account.getId(),
                "accountId=%s,userId=%s,amount=%s,previousBalance=%s,newBalance=%s".formatted(
                        account.getId(),
                        account.getUser().getId(),
                        amount,
                        previousBalance,
                        account.getBalance()
                ),
                ipAddress
        );
    }

    private Specification<Account> accounts(AdminAccountFilterRequest filter) {
        return (root, query, criteriaBuilder) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (filter.userId() != null) {
                predicates.add(criteriaBuilder.equal(root.get("user").get("id"), filter.userId()));
            }
            if (filter.status() != null) {
                predicates.add(criteriaBuilder.equal(root.get("status"), filter.status()));
            }
            if (filter.currency() != null) {
                predicates.add(criteriaBuilder.equal(root.get("currency"), filter.currency()));
            }

            return criteriaBuilder.and(predicates.toArray(Predicate[]::new));
        };
    }

    private AdminAccountResponse toAdminResponse(Account account) {
        return new AdminAccountResponse(
                account.getId(),
                account.getUser().getId(),
                account.getUser().getFirstName(),
                account.getUser().getLastName(),
                account.getUser().getEmail(),
                account.getAccountNumber(),
                account.getAlias(),
                account.getCurrency(),
                account.getBalance(),
                account.getStatus(),
                account.getCreatedAt(),
                account.getUpdatedAt()
        );
    }

    private AccountResponse toResponse(Account account) {
        return new AccountResponse(
                account.getId(),
                account.getUser().getId(),
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
