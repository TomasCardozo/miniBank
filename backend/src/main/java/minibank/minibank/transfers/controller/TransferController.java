package minibank.minibank.transfers.controller;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import minibank.minibank.auth.security.AuthenticatedUser;
import minibank.minibank.common.dto.PageResponse;
import minibank.minibank.common.error.ErrorCodes;
import minibank.minibank.common.exception.BusinessException;
import minibank.minibank.common.web.ClientIpResolver;
import minibank.minibank.transfers.dto.CreateTransferRequest;
import minibank.minibank.transfers.dto.TransferFilterRequest;
import minibank.minibank.transfers.dto.TransferResponse;
import minibank.minibank.transfers.entity.TransferStatus;
import minibank.minibank.transfers.service.TransferService;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Set;
import java.util.UUID;

@RestController
@RequestMapping("/transfers")
public class TransferController {

    private static final Sort DEFAULT_SORT = Sort.by(Sort.Direction.DESC, "createdAt");
    private static final Set<String> ALLOWED_SORT_FIELDS = Set.of("createdAt", "amount", "status");

    private final TransferService transferService;

    public TransferController(TransferService transferService) {
        this.transferService = transferService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    TransferResponse create(
            @AuthenticationPrincipal AuthenticatedUser currentUser,
            @Valid @RequestBody CreateTransferRequest request,
            HttpServletRequest servletRequest
    ) {
        return transferService.create(userId(currentUser), currentUser.role(), request, ClientIpResolver.resolve(servletRequest));
    }

    @GetMapping
    PageResponse<TransferResponse> list(
            @AuthenticationPrincipal AuthenticatedUser currentUser,
            @RequestParam(required = false) TransferStatus status,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to,
            @RequestParam(required = false) UUID accountId,
            Pageable pageable
    ) {
        return PageResponse.from(transferService.listOwnTransfers(
                userId(currentUser),
                new TransferFilterRequest(status, from, to, accountId),
                withDefaultSort(pageable)
        ));
    }

    @GetMapping("/{id}")
    TransferResponse get(
            @AuthenticationPrincipal AuthenticatedUser currentUser,
            @PathVariable UUID id
    ) {
        return transferService.getOwnTransfer(userId(currentUser), id);
    }

    private Pageable withDefaultSort(Pageable pageable) {
        if (pageable.getSort().isSorted()) {
            validateSort(pageable.getSort());
            return pageable;
        }

        return PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(), DEFAULT_SORT);
    }

    private void validateSort(Sort sort) {
        for (Sort.Order order : sort) {
            if (!ALLOWED_SORT_FIELDS.contains(order.getProperty())) {
                throw new BusinessException(
                        ErrorCodes.VALIDATION_ERROR,
                        "Unsupported transfer sort field",
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
