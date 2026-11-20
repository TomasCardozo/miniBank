package minibank.minibank.transfers.service;

import jakarta.persistence.criteria.Predicate;
import minibank.minibank.accounts.entity.Account;
import minibank.minibank.accounts.entity.AccountStatus;
import minibank.minibank.accounts.repository.AccountRepository;
import minibank.minibank.audit.entity.AuditAction;
import minibank.minibank.audit.entity.AuditEntityType;
import minibank.minibank.audit.service.AuditService;
import minibank.minibank.common.error.ErrorCodes;
import minibank.minibank.common.exception.BusinessException;
import minibank.minibank.common.exception.ForbiddenOperationException;
import minibank.minibank.common.exception.NotFoundException;
import minibank.minibank.limits.service.DailyLimitService;
import minibank.minibank.movements.entity.Movement;
import minibank.minibank.movements.entity.MovementType;
import minibank.minibank.movements.repository.MovementRepository;
import minibank.minibank.transfers.dto.CreateTransferRequest;
import minibank.minibank.transfers.dto.TransferFilterRequest;
import minibank.minibank.transfers.dto.TransferResponse;
import minibank.minibank.transfers.entity.Transfer;
import minibank.minibank.transfers.entity.TransferStatus;
import minibank.minibank.transfers.repository.TransferRepository;
import minibank.minibank.users.entity.Role;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
public class TransferService {

    private static final String TRANSFER_NOT_FOUND = "Transfer not found";
    private static final String SOURCE_ACCOUNT_NOT_FOUND = "Source account not found";
    private static final String TARGET_ACCOUNT_NOT_FOUND = "Target account not found";

    private final AccountRepository accountRepository;
    private final TransferRepository transferRepository;
    private final MovementRepository movementRepository;
    private final DailyLimitService dailyLimitService;
    private final AuditService auditService;

    public TransferService(
            AccountRepository accountRepository,
            TransferRepository transferRepository,
            MovementRepository movementRepository,
            DailyLimitService dailyLimitService,
            AuditService auditService
    ) {
        this.accountRepository = accountRepository;
        this.transferRepository = transferRepository;
        this.movementRepository = movementRepository;
        this.dailyLimitService = dailyLimitService;
        this.auditService = auditService;
    }

    @Transactional
    public TransferResponse create(UUID currentUserId, Role currentUserRole, CreateTransferRequest request, String ipAddress) {
        try {
            return createTransfer(currentUserId, currentUserRole, request, ipAddress);
        } catch (BusinessException exception) {
            auditRejectedTransfer(currentUserId, request, exception, ipAddress);
            throw exception;
        }
    }

    private TransferResponse createTransfer(
            UUID currentUserId,
            Role currentUserRole,
            CreateTransferRequest request,
            String ipAddress
    ) {
        if (currentUserRole != Role.CUSTOMER) {
            throw new ForbiddenOperationException("Only customers can create transfers");
        }

        UUID sourceAccountId = accountRepository.findOwnIdByIdAndUserId(request.sourceAccountId(), currentUserId)
                .orElseThrow(() -> new NotFoundException(SOURCE_ACCOUNT_NOT_FOUND));
        UUID targetAccountId = accountRepository.findIdByAccountNumber(request.targetAccountNumber())
                .orElseThrow(this::invalidTarget);

        LockedAccounts lockedAccounts = lockAccounts(sourceAccountId, targetAccountId);
        Account sourceAccount = lockedAccounts.sourceAccount();
        Account targetAccount = lockedAccounts.targetAccount();

        validateTransfer(sourceAccount, targetAccount, request.amount());
        dailyLimitService.validateTransferWithinDailyLimit(sourceAccount, request.amount());

        Transfer transfer = new Transfer(
                sourceAccount,
                targetAccount,
                request.amount(),
                sourceAccount.getCurrency(),
                request.description(),
                TransferStatus.PENDING,
                null,
                null
        );
        Transfer savedTransfer = transferRepository.save(transfer);

        sourceAccount.debit(request.amount());
        targetAccount.credit(request.amount());

        movementRepository.save(new Movement(
                sourceAccount,
                savedTransfer,
                MovementType.DEBIT,
                request.amount(),
                sourceAccount.getBalance(),
                request.description()
        ));
        movementRepository.save(new Movement(
                targetAccount,
                savedTransfer,
                MovementType.CREDIT,
                request.amount(),
                targetAccount.getBalance(),
                request.description()
        ));

        savedTransfer.complete(Instant.now());
        auditService.record(
                currentUserId,
                AuditAction.TRANSFER_COMPLETED,
                AuditEntityType.TRANSFER,
                savedTransfer.getId(),
                "sourceAccountId=%s,targetAccountId=%s,amount=%s,currency=%s".formatted(
                        sourceAccount.getId(),
                        targetAccount.getId(),
                        savedTransfer.getAmount(),
                        savedTransfer.getCurrency()
                ),
                ipAddress
        );

        return toTransferResponse(savedTransfer);
    }

    private void auditRejectedTransfer(
            UUID currentUserId,
            CreateTransferRequest request,
            BusinessException exception,
            String ipAddress
    ) {
        auditService.recordRequiresNew(
                currentUserId,
                AuditAction.TRANSFER_REJECTED,
                AuditEntityType.TRANSFER,
                null,
                "reason=%s,sourceAccountId=%s,amount=%s".formatted(
                        exception.getCode(),
                        request.sourceAccountId(),
                        request.amount()
                ),
                ipAddress
        );
    }

    private LockedAccounts lockAccounts(UUID sourceAccountId, UUID targetAccountId) {
        if (sourceAccountId.compareTo(targetAccountId) <= 0) {
            Account sourceAccount = lockAccount(sourceAccountId);
            Account targetAccount = sourceAccountId.equals(targetAccountId) ? sourceAccount : lockAccount(targetAccountId);
            return new LockedAccounts(sourceAccount, targetAccount);
        }

        Account targetAccount = lockAccount(targetAccountId);
        Account sourceAccount = lockAccount(sourceAccountId);
        return new LockedAccounts(sourceAccount, targetAccount);
    }

    private Account lockAccount(UUID accountId) {
        return accountRepository.findByIdForUpdate(accountId)
                .orElseThrow(this::invalidTarget);
    }

    @Transactional(readOnly = true)
    public Page<TransferResponse> listOwnTransfers(
            UUID currentUserId,
            TransferFilterRequest filter,
            Pageable pageable
    ) {
        return transferRepository.findAll(ownTransfers(currentUserId, filter), pageable)
                .map(this::toTransferResponse);
    }

    @Transactional(readOnly = true)
    public Page<TransferResponse> listAllTransfers(TransferFilterRequest filter, Pageable pageable) {
        return transferRepository.findAll(transfers(filter), pageable)
                .map(this::toTransferResponse);
    }

    @Transactional(readOnly = true)
    public TransferResponse getOwnTransfer(UUID currentUserId, UUID transferId) {
        return transferRepository.findOwnById(transferId, currentUserId)
                .map(this::toTransferResponse)
                .orElseThrow(() -> new NotFoundException(TRANSFER_NOT_FOUND));
    }

    private Specification<Transfer> ownTransfers(UUID currentUserId, TransferFilterRequest filter) {
        return (root, query, criteriaBuilder) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(criteriaBuilder.or(
                    criteriaBuilder.equal(root.get("sourceAccount").get("user").get("id"), currentUserId),
                    criteriaBuilder.equal(root.get("targetAccount").get("user").get("id"), currentUserId)
            ));

            addFilterPredicates(filter, root, criteriaBuilder, predicates);

            return criteriaBuilder.and(predicates.toArray(Predicate[]::new));
        };
    }

    private Specification<Transfer> transfers(TransferFilterRequest filter) {
        return (root, query, criteriaBuilder) -> {
            List<Predicate> predicates = new ArrayList<>();
            addFilterPredicates(filter, root, criteriaBuilder, predicates);

            return criteriaBuilder.and(predicates.toArray(Predicate[]::new));
        };
    }

    private void addFilterPredicates(
            TransferFilterRequest filter,
            jakarta.persistence.criteria.Root<Transfer> root,
            jakarta.persistence.criteria.CriteriaBuilder criteriaBuilder,
            List<Predicate> predicates
    ) {
        if (filter.status() != null) {
            predicates.add(criteriaBuilder.equal(root.get("status"), filter.status()));
        }
        if (filter.from() != null) {
            predicates.add(criteriaBuilder.greaterThanOrEqualTo(root.get("createdAt"), filter.from()));
        }
        if (filter.to() != null) {
            predicates.add(criteriaBuilder.lessThanOrEqualTo(root.get("createdAt"), filter.to()));
        }
        if (filter.accountId() != null) {
            predicates.add(criteriaBuilder.or(
                    criteriaBuilder.equal(root.get("sourceAccount").get("id"), filter.accountId()),
                    criteriaBuilder.equal(root.get("targetAccount").get("id"), filter.accountId())
            ));
        }
    }

    private void validateTransfer(Account sourceAccount, Account targetAccount, BigDecimal amount) {
        if (sourceAccount.getId().equals(targetAccount.getId())) {
            throw new BusinessException(
                    ErrorCodes.TRANSFER_SAME_ACCOUNT,
                    "Source and target accounts must be different",
                    HttpStatus.UNPROCESSABLE_ENTITY
            );
        }
        if (sourceAccount.getStatus() != AccountStatus.ACTIVE) {
            throw new BusinessException(
                    ErrorCodes.TRANSFER_SOURCE_INACTIVE,
                    "Source account is not active",
                    HttpStatus.UNPROCESSABLE_ENTITY
            );
        }
        if (targetAccount.getStatus() != AccountStatus.ACTIVE) {
            throw invalidTarget();
        }
        if (amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessException(
                    ErrorCodes.TRANSFER_INVALID_AMOUNT,
                    "Amount must be greater than zero",
                    HttpStatus.UNPROCESSABLE_ENTITY
            );
        }
        if (sourceAccount.getCurrency() != targetAccount.getCurrency()) {
            throw invalidTarget();
        }
        if (sourceAccount.getBalance().compareTo(amount) < 0) {
            throw new BusinessException(
                    ErrorCodes.TRANSFER_INSUFFICIENT_FUNDS,
                    "Insufficient funds",
                    HttpStatus.UNPROCESSABLE_ENTITY
            );
        }
    }

    private BusinessException invalidTarget() {
        return new BusinessException(
                ErrorCodes.TRANSFER_INVALID_TARGET,
                TARGET_ACCOUNT_NOT_FOUND,
                HttpStatus.NOT_FOUND
        );
    }

    private TransferResponse toTransferResponse(Transfer transfer) {
        return new TransferResponse(
                transfer.getId(),
                transfer.getSourceAccount().getId(),
                transfer.getSourceAccount().getAccountNumber(),
                transfer.getTargetAccount().getId(),
                transfer.getTargetAccount().getAccountNumber(),
                transfer.getAmount(),
                transfer.getCurrency(),
                transfer.getDescription(),
                transfer.getStatus(),
                transfer.getFailureReason(),
                transfer.getCreatedAt(),
                transfer.getCompletedAt()
        );
    }

    private record LockedAccounts(Account sourceAccount, Account targetAccount) {
    }
}
