package minibank.minibank.movements.service;

import jakarta.persistence.criteria.Predicate;
import minibank.minibank.accounts.repository.AccountRepository;
import minibank.minibank.common.error.ErrorCodes;
import minibank.minibank.common.exception.BusinessException;
import minibank.minibank.common.exception.NotFoundException;
import minibank.minibank.movements.dto.MovementFilterRequest;
import minibank.minibank.movements.dto.MovementResponse;
import minibank.minibank.movements.entity.Movement;
import minibank.minibank.movements.repository.MovementRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
public class MovementService {

    private static final String ACCOUNT_NOT_FOUND = "Account not found";

    private final AccountRepository accountRepository;
    private final MovementRepository movementRepository;

    public MovementService(AccountRepository accountRepository, MovementRepository movementRepository) {
        this.accountRepository = accountRepository;
        this.movementRepository = movementRepository;
    }

    @Transactional(readOnly = true)
    public Page<MovementResponse> listOwnAccountMovements(
            UUID currentUserId,
            UUID accountId,
            MovementFilterRequest filter,
            Pageable pageable
    ) {
        validateFilter(filter);

        if (!accountRepository.existsByIdAndUserId(accountId, currentUserId)) {
            throw new NotFoundException(ACCOUNT_NOT_FOUND);
        }

        return movementRepository.findAll(ownAccountMovements(currentUserId, accountId, filter), pageable)
                .map(this::toMovementResponse);
    }

    private void validateFilter(MovementFilterRequest filter) {
        if (filter.from() != null && filter.to() != null && filter.from().isAfter(filter.to())) {
            throw new BusinessException(
                    ErrorCodes.VALIDATION_ERROR,
                    "from must be before or equal to to",
                    HttpStatus.BAD_REQUEST
            );
        }
    }

    private Specification<Movement> ownAccountMovements(UUID currentUserId, UUID accountId, MovementFilterRequest filter) {
        return (root, query, criteriaBuilder) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(criteriaBuilder.equal(root.get("account").get("id"), accountId));
            predicates.add(criteriaBuilder.equal(root.get("account").get("user").get("id"), currentUserId));

            if (filter.from() != null) {
                predicates.add(criteriaBuilder.greaterThanOrEqualTo(root.get("createdAt"), filter.from()));
            }
            if (filter.to() != null) {
                predicates.add(criteriaBuilder.lessThanOrEqualTo(root.get("createdAt"), filter.to()));
            }
            if (filter.type() != null) {
                predicates.add(criteriaBuilder.equal(root.get("type"), filter.type()));
            }

            return criteriaBuilder.and(predicates.toArray(Predicate[]::new));
        };
    }

    private MovementResponse toMovementResponse(Movement movement) {
        return new MovementResponse(
                movement.getId(),
                movement.getAccount().getId(),
                movement.getAccount().getAccountNumber(),
                movement.getTransfer() == null ? null : movement.getTransfer().getId(),
                movement.getType(),
                movement.getOrigin(),
                movement.getAmount(),
                movement.getBalanceAfter(),
                movement.getDescription(),
                movement.getCreatedAt()
        );
    }
}
