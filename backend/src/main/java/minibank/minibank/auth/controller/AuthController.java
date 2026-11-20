package minibank.minibank.auth.controller;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import minibank.minibank.auth.dto.AuthResponse;
import minibank.minibank.auth.dto.LoginRequest;
import minibank.minibank.auth.dto.MeResponse;
import minibank.minibank.auth.dto.RegisterRequest;
import minibank.minibank.auth.security.AuthenticatedUser;
import minibank.minibank.auth.service.AuthService;
import minibank.minibank.common.error.ErrorCodes;
import minibank.minibank.common.exception.BusinessException;
import minibank.minibank.common.web.ClientIpResolver;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/register")
    ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(authService.register(request));
    }

    @PostMapping("/login")
    AuthResponse login(@Valid @RequestBody LoginRequest request, HttpServletRequest servletRequest) {
        return authService.login(request, ClientIpResolver.resolve(servletRequest));
    }

    @GetMapping("/me")
    MeResponse me(@AuthenticationPrincipal AuthenticatedUser currentUser) {
        if (currentUser == null) {
            throw new BusinessException(ErrorCodes.UNAUTHORIZED, "Authentication required", HttpStatus.UNAUTHORIZED);
        }

        return authService.me(currentUser.id());
    }
}
