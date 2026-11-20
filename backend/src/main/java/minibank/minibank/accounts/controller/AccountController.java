package minibank.minibank.accounts.controller;

import jakarta.validation.Valid;
import minibank.minibank.accounts.dto.AccountResponse;
import minibank.minibank.accounts.dto.BalanceResponse;
import minibank.minibank.accounts.dto.CreateAccountRequest;
import minibank.minibank.accounts.dto.UpdateAliasRequest;
import minibank.minibank.accounts.service.AccountService;
import minibank.minibank.auth.security.AuthenticatedUser;
import minibank.minibank.common.error.ErrorCodes;
import minibank.minibank.common.exception.BusinessException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/accounts")
public class AccountController {

    private final AccountService accountService;

    public AccountController(AccountService accountService) {
        this.accountService = accountService;
    }

    @PostMapping
    ResponseEntity<AccountResponse> create(
            @AuthenticationPrincipal AuthenticatedUser currentUser,
            @Valid @RequestBody CreateAccountRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED).body(accountService.create(userId(currentUser), request));
    }

    @GetMapping
    List<AccountResponse> list(@AuthenticationPrincipal AuthenticatedUser currentUser) {
        return accountService.listOwnAccounts(userId(currentUser));
    }

    @GetMapping("/{id}")
    AccountResponse get(
            @AuthenticationPrincipal AuthenticatedUser currentUser,
            @PathVariable UUID id
    ) {
        return accountService.getOwnAccount(userId(currentUser), id);
    }

    @GetMapping("/{id}/balance")
    BalanceResponse balance(
            @AuthenticationPrincipal AuthenticatedUser currentUser,
            @PathVariable UUID id
    ) {
        return accountService.getOwnBalance(userId(currentUser), id);
    }

    @PatchMapping("/{id}/alias")
    AccountResponse updateAlias(
            @AuthenticationPrincipal AuthenticatedUser currentUser,
            @PathVariable UUID id,
            @Valid @RequestBody UpdateAliasRequest request
    ) {
        return accountService.updateAlias(userId(currentUser), id, request);
    }

    private UUID userId(AuthenticatedUser currentUser) {
        if (currentUser == null) {
            throw new BusinessException(ErrorCodes.UNAUTHORIZED, "Authentication required", HttpStatus.UNAUTHORIZED);
        }

        return currentUser.id();
    }
}
