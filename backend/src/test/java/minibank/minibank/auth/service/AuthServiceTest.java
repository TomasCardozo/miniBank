package minibank.minibank.auth.service;

import minibank.minibank.auth.dto.LoginRequest;
import minibank.minibank.auth.dto.RegisterRequest;
import minibank.minibank.audit.service.AuditService;
import minibank.minibank.common.exception.BusinessException;
import minibank.minibank.common.exception.ConflictException;
import minibank.minibank.users.entity.Role;
import minibank.minibank.users.entity.User;
import minibank.minibank.users.entity.UserStatus;
import minibank.minibank.users.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    private static final String RAW_PASSWORD = "password123";
    private static final String HASHED_PASSWORD = "hashed-password";

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private JwtService jwtService;

    @Mock
    private AuditService auditService;

    @Test
    void registerCreatesActiveCustomerWithHashedPassword() {
        AuthService authService = service();
        RegisterRequest request = registerRequest();
        User savedUser = user("user@example.com", HASHED_PASSWORD, Role.CUSTOMER, UserStatus.ACTIVE);

        when(userRepository.existsByEmail(request.email())).thenReturn(false);
        when(userRepository.existsByDocumentNumber(request.documentNumber())).thenReturn(false);
        when(passwordEncoder.encode(RAW_PASSWORD)).thenReturn(HASHED_PASSWORD);
        when(userRepository.save(any(User.class))).thenReturn(savedUser);
        when(jwtService.generateToken(savedUser)).thenReturn("jwt-token");
        when(jwtService.getExpirationMillis()).thenReturn(3600000L);

        var response = authService.register(request);

        ArgumentCaptor<User> userCaptor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(userCaptor.capture());
        User userToSave = userCaptor.getValue();

        assertThat(userToSave.getRole()).isEqualTo(Role.CUSTOMER);
        assertThat(userToSave.getStatus()).isEqualTo(UserStatus.ACTIVE);
        assertThat(userToSave.getPasswordHash()).isEqualTo(HASHED_PASSWORD);
        assertThat(userToSave.getPasswordHash()).isNotEqualTo(RAW_PASSWORD);
        assertThat(response.accessToken()).isEqualTo("jwt-token");
        assertThat(response.user().role()).isEqualTo(Role.CUSTOMER);
    }

    @Test
    void registerRejectsDuplicatedEmail() {
        AuthService authService = service();
        RegisterRequest request = registerRequest();

        when(userRepository.existsByEmail(request.email())).thenReturn(true);

        assertThatThrownBy(() -> authService.register(request))
                .isInstanceOf(ConflictException.class)
                .hasMessage("Email is already registered");

        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    void registerRejectsDuplicatedDocumentNumber() {
        AuthService authService = service();
        RegisterRequest request = registerRequest();

        when(userRepository.existsByEmail(request.email())).thenReturn(false);
        when(userRepository.existsByDocumentNumber(request.documentNumber())).thenReturn(true);

        assertThatThrownBy(() -> authService.register(request))
                .isInstanceOf(ConflictException.class)
                .hasMessage("Document number is already registered");

        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    void loginReturnsTokenForValidCredentials() {
        AuthService authService = service();
        LoginRequest request = new LoginRequest("user@example.com", RAW_PASSWORD);
        User user = user(request.email(), HASHED_PASSWORD, Role.CUSTOMER, UserStatus.ACTIVE);

        when(userRepository.findByEmail(request.email())).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(RAW_PASSWORD, HASHED_PASSWORD)).thenReturn(true);
        when(jwtService.generateToken(user)).thenReturn("jwt-token");
        when(jwtService.getExpirationMillis()).thenReturn(3600000L);

        var response = authService.login(request, "127.0.0.1");

        assertThat(response.accessToken()).isEqualTo("jwt-token");
        assertThat(response.tokenType()).isEqualTo("Bearer");
        assertThat(response.user().email()).isEqualTo("user@example.com");
    }

    @Test
    void loginRejectsInvalidPassword() {
        AuthService authService = service();
        LoginRequest request = new LoginRequest("user@example.com", "wrong-password");
        User user = user(request.email(), HASHED_PASSWORD, Role.CUSTOMER, UserStatus.ACTIVE);

        when(userRepository.findByEmail(request.email())).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(request.password(), HASHED_PASSWORD)).thenReturn(false);

        assertThatThrownBy(() -> authService.login(request, "127.0.0.1"))
                .isInstanceOf(BusinessException.class)
                .hasMessage("Invalid email or password");
    }

    @Test
    void loginRejectsUnknownEmail() {
        AuthService authService = service();
        LoginRequest request = new LoginRequest("missing@example.com", RAW_PASSWORD);

        when(userRepository.findByEmail(request.email())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.login(request, "127.0.0.1"))
                .isInstanceOf(BusinessException.class)
                .hasMessage("Invalid email or password");
    }

    @Test
    void loginRejectsInactiveUser() {
        AuthService authService = service();
        LoginRequest request = new LoginRequest("user@example.com", RAW_PASSWORD);
        User user = user(request.email(), HASHED_PASSWORD, Role.CUSTOMER, UserStatus.BLOCKED);

        when(userRepository.findByEmail(request.email())).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(RAW_PASSWORD, HASHED_PASSWORD)).thenReturn(true);

        assertThatThrownBy(() -> authService.login(request, "127.0.0.1"))
                .isInstanceOf(BusinessException.class)
                .hasMessage("Invalid email or password");
    }

    @Test
    void loginRejectsClosedUser() {
        AuthService authService = service();
        LoginRequest request = new LoginRequest("user@example.com", RAW_PASSWORD);
        User user = user(request.email(), HASHED_PASSWORD, Role.CUSTOMER, UserStatus.CLOSED);

        when(userRepository.findByEmail(request.email())).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(RAW_PASSWORD, HASHED_PASSWORD)).thenReturn(true);

        assertThatThrownBy(() -> authService.login(request, "127.0.0.1"))
                .isInstanceOf(BusinessException.class)
                .hasMessage("Invalid email or password");
    }

    @Test
    void meReturnsActiveAuthenticatedUser() {
        AuthService authService = service();
        User user = user("user@example.com", HASHED_PASSWORD, Role.CUSTOMER, UserStatus.ACTIVE);

        when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));

        var response = authService.me(user.getId());

        assertThat(response.user().id()).isEqualTo(user.getId());
        assertThat(response.user().email()).isEqualTo("user@example.com");
    }

    @Test
    void meRejectsMissingUser() {
        AuthService authService = service();
        UUID userId = UUID.randomUUID();

        when(userRepository.findById(userId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.me(userId))
                .isInstanceOf(BusinessException.class)
                .hasMessage("Invalid email or password");
    }

    @Test
    void meRejectsInactiveUser() {
        AuthService authService = service();
        User user = user("user@example.com", HASHED_PASSWORD, Role.CUSTOMER, UserStatus.BLOCKED);

        when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> authService.me(user.getId()))
                .isInstanceOf(BusinessException.class)
                .hasMessage("Invalid email or password");
    }

    private RegisterRequest registerRequest() {
        return new RegisterRequest(
                "Jane",
                "Doe",
                "user@example.com",
                "12345678",
                RAW_PASSWORD
        );
    }

    private AuthService service() {
        return new AuthService(userRepository, passwordEncoder, jwtService, auditService);
    }

    private User user(String email, String passwordHash, Role role, UserStatus status) {
        User user = new User("Jane", "Doe", email, "12345678", passwordHash, role, status);
        ReflectionTestUtils.setField(user, "id", UUID.randomUUID());
        ReflectionTestUtils.setField(user, "createdAt", Instant.parse("2026-07-26T10:00:00Z"));
        ReflectionTestUtils.setField(user, "updatedAt", Instant.parse("2026-07-26T10:00:00Z"));
        return user;
    }
}
