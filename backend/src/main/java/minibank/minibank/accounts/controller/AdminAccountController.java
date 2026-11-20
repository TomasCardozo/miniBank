package minibank.minibank.accounts.controller;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import minibank.minibank.accounts.dto.AccountResponse;
import minibank.minibank.accounts.dto.AdminAccountFilterRequest;
import minibank.minibank.accounts.dto.AdminAccountResponse;
import minibank.minibank.accounts.entity.AccountStatus;
import minibank.minibank.accounts.entity.Currency;
import minibank.minibank.accounts.dto.CreditAccountRequest;
import minibank.minibank.accounts.service.AdminAccountService;
import minibank.minibank.auth.security.AuthenticatedUser;
import minibank.minibank.common.dto.PageResponse;
import minibank.minibank.common.error.ErrorCodes;
import minibank.minibank.common.exception.BusinessException;
import minibank.minibank.common.web.ClientIpResolver;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Set;
import java.util.UUID;

@RestController
@RequestMapping("/admin/accounts")
public class AdminAccountController {

    private static final Sort DEFAULT_SORT = Sort.by(
            Sort.Order.desc("createdAt"),
            Sort.Order.desc("id")
    );
    private static final Set<String> ALLOWED_SORT_FIELDS = Set.of("createdAt", "accountNumber", "balance", "status", "currency");

    private final AdminAccountService adminAccountService;

    public AdminAccountController(AdminAccountService adminAccountService) {
        this.adminAccountService = adminAccountService;
    }

    @GetMapping
    PageResponse<AdminAccountResponse> list(
            @RequestParam(required = false) UUID userId,
            @RequestParam(required = false) AccountStatus status,
            @RequestParam(required = false) Currency currency,
            Pageable pageable
    ) {
        return PageResponse.from(adminAccountService.list(
                new AdminAccountFilterRequest(userId, status, currency),
                withDefaultSort(pageable)
        ));
    }

    @PatchMapping("/{id}/block")
    AccountResponse block(
            @AuthenticationPrincipal AuthenticatedUser currentUser,
            @PathVariable UUID id,
            HttpServletRequest servletRequest
    ) {
        return adminAccountService.block(userId(currentUser), id, ClientIpResolver.resolve(servletRequest));
    }

    @PatchMapping("/{id}/activate")
    AccountResponse activate(
            @AuthenticationPrincipal AuthenticatedUser currentUser,
            @PathVariable UUID id,
            HttpServletRequest servletRequest
    ) {
        return adminAccountService.activate(userId(currentUser), id, ClientIpResolver.resolve(servletRequest));
    }

    @PatchMapping("/{id}/balance/credit")
    AccountResponse creditBalance(
            @AuthenticationPrincipal AuthenticatedUser currentUser,
            @PathVariable UUID id,
            @Valid @RequestBody CreditAccountRequest request,
            HttpServletRequest servletRequest
    ) {
        return adminAccountService.creditBalance(userId(currentUser), id, request, ClientIpResolver.resolve(servletRequest));
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
                        "Unsupported account sort field",
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
