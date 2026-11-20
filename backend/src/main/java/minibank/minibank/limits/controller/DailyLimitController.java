package minibank.minibank.limits.controller;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import minibank.minibank.auth.security.AuthenticatedUser;
import minibank.minibank.common.error.ErrorCodes;
import minibank.minibank.common.exception.BusinessException;
import minibank.minibank.common.web.ClientIpResolver;
import minibank.minibank.limits.dto.DailyLimitResponse;
import minibank.minibank.limits.dto.UpdateDailyLimitRequest;
import minibank.minibank.limits.service.DailyLimitService;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/accounts/{accountId}/limits")
public class DailyLimitController {

    private final DailyLimitService dailyLimitService;

    public DailyLimitController(DailyLimitService dailyLimitService) {
        this.dailyLimitService = dailyLimitService;
    }

    @GetMapping
    DailyLimitResponse get(
            @AuthenticationPrincipal AuthenticatedUser currentUser,
            @PathVariable UUID accountId
    ) {
        return dailyLimitService.getLimit(userId(currentUser), currentUser.role(), accountId);
    }

    @PatchMapping
    DailyLimitResponse update(
            @AuthenticationPrincipal AuthenticatedUser currentUser,
            @PathVariable UUID accountId,
            @Valid @RequestBody UpdateDailyLimitRequest request,
            HttpServletRequest servletRequest
    ) {
        return dailyLimitService.updateLimit(
                userId(currentUser),
                currentUser.role(),
                accountId,
                request,
                ClientIpResolver.resolve(servletRequest)
        );
    }

    private UUID userId(AuthenticatedUser currentUser) {
        if (currentUser == null) {
            throw new BusinessException(ErrorCodes.UNAUTHORIZED, "Authentication required", HttpStatus.UNAUTHORIZED);
        }

        return currentUser.id();
    }
}
