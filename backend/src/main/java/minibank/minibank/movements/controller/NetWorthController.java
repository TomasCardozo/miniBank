package minibank.minibank.movements.controller;

import minibank.minibank.auth.security.AuthenticatedUser;
import minibank.minibank.common.error.ErrorCodes;
import minibank.minibank.common.exception.BusinessException;
import minibank.minibank.movements.dto.NetWorthHistoryResponse;
import minibank.minibank.movements.service.NetWorthService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

@RestController
@RequestMapping("/me/net-worth")
public class NetWorthController {

    private final NetWorthService netWorthService;

    public NetWorthController(NetWorthService netWorthService) {
        this.netWorthService = netWorthService;
    }

    @GetMapping("/history")
    NetWorthHistoryResponse history(
            @AuthenticationPrincipal AuthenticatedUser currentUser,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to
    ) {
        if (currentUser == null) {
            throw new BusinessException(ErrorCodes.UNAUTHORIZED, "Authentication required", HttpStatus.UNAUTHORIZED);
        }

        return netWorthService.history(currentUser.id(), from, to);
    }
}
