package minibank.minibank.movements.controller;

import minibank.minibank.auth.security.AuthenticatedUser;
import minibank.minibank.common.dto.PageResponse;
import minibank.minibank.common.error.ErrorCodes;
import minibank.minibank.common.exception.BusinessException;
import minibank.minibank.movements.dto.MovementFilterRequest;
import minibank.minibank.movements.dto.MovementResponse;
import minibank.minibank.movements.entity.MovementType;
import minibank.minibank.movements.service.MovementService;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Set;
import java.util.UUID;

@RestController
@RequestMapping("/accounts/{accountId}/movements")
public class MovementController {

    private static final Sort ID_TIE_BREAKER = Sort.by(Sort.Direction.DESC, "id");
    private static final Sort DEFAULT_SORT = Sort.by(Sort.Direction.DESC, "createdAt").and(ID_TIE_BREAKER);
    private static final Set<String> ALLOWED_SORT_FIELDS = Set.of("createdAt", "amount", "type");

    private final MovementService movementService;

    public MovementController(MovementService movementService) {
        this.movementService = movementService;
    }

    @GetMapping
    PageResponse<MovementResponse> list(
            @AuthenticationPrincipal AuthenticatedUser currentUser,
            @PathVariable UUID accountId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to,
            @RequestParam(required = false) MovementType type,
            Pageable pageable
    ) {
        return PageResponse.from(movementService.listOwnAccountMovements(
                userId(currentUser),
                accountId,
                new MovementFilterRequest(from, to, type),
                withDefaultSort(pageable)
        ));
    }

    private Pageable withDefaultSort(Pageable pageable) {
        if (pageable.getSort().isSorted()) {
            validateSort(pageable.getSort());
            return PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(), pageable.getSort().and(ID_TIE_BREAKER));
        }

        return PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(), DEFAULT_SORT);
    }

    private void validateSort(Sort sort) {
        for (Sort.Order order : sort) {
            if (!ALLOWED_SORT_FIELDS.contains(order.getProperty())) {
                throw new BusinessException(
                        ErrorCodes.VALIDATION_ERROR,
                        "Unsupported movement sort field",
                        HttpStatus.BAD_REQUEST
                );
            }
        }
    }

    private UUID userId(AuthenticatedUser currentUser) {
        if (currentUser == null) {
            throw new BusinessException(ErrorCodes.UNAUTHORIZED, "Authentication required", HttpStatus.UNAUTHORIZED);
        }

        return currentUser.id();
    }
}
