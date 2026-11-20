package minibank.minibank.users.controller;

import jakarta.servlet.http.HttpServletRequest;
import minibank.minibank.auth.security.AuthenticatedUser;
import minibank.minibank.common.dto.PageResponse;
import minibank.minibank.common.error.ErrorCodes;
import minibank.minibank.common.exception.BusinessException;
import minibank.minibank.common.web.ClientIpResolver;
import minibank.minibank.users.dto.AdminUserFilterRequest;
import minibank.minibank.users.dto.AdminUserResponse;
import minibank.minibank.users.entity.Role;
import minibank.minibank.users.entity.UserStatus;
import minibank.minibank.users.service.AdminUserService;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Set;
import java.util.UUID;

@RestController
@RequestMapping("/admin/users")
public class AdminUserController {

    private static final Sort DEFAULT_SORT = Sort.by(
            Sort.Order.desc("createdAt"),
            Sort.Order.desc("id")
    );
    private static final Set<String> ALLOWED_SORT_FIELDS = Set.of("createdAt", "email", "lastName", "status", "role");

    private final AdminUserService adminUserService;

    public AdminUserController(AdminUserService adminUserService) {
        this.adminUserService = adminUserService;
    }

    @GetMapping
    PageResponse<AdminUserResponse> list(
            @RequestParam(required = false) Role role,
            @RequestParam(required = false) UserStatus status,
            Pageable pageable
    ) {
        return PageResponse.from(adminUserService.list(
                new AdminUserFilterRequest(role, status),
                withDefaultSort(pageable)
        ));
    }

    @GetMapping("/{id}")
    AdminUserResponse get(@PathVariable UUID id) {
        return adminUserService.get(id);
    }

    @PatchMapping("/{id}/block")
    AdminUserResponse block(
            @AuthenticationPrincipal AuthenticatedUser currentUser,
            @PathVariable UUID id,
            HttpServletRequest servletRequest
    ) {
        return adminUserService.block(userId(currentUser), id, ClientIpResolver.resolve(servletRequest));
    }

    @PatchMapping("/{id}/activate")
    AdminUserResponse activate(
            @AuthenticationPrincipal AuthenticatedUser currentUser,
            @PathVariable UUID id,
            HttpServletRequest servletRequest
    ) {
        return adminUserService.activate(userId(currentUser), id, ClientIpResolver.resolve(servletRequest));
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
                        "Unsupported user sort field",
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
