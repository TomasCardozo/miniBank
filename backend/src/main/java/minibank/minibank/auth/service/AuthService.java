package minibank.minibank.auth.service;

import minibank.minibank.auth.dto.AuthUserResponse;
import minibank.minibank.auth.dto.AuthResponse;
import minibank.minibank.auth.dto.LoginRequest;
import minibank.minibank.auth.dto.MeResponse;
import minibank.minibank.auth.dto.RegisterRequest;
import minibank.minibank.auth.dto.UserResponse;
import minibank.minibank.audit.entity.AuditAction;
import minibank.minibank.audit.entity.AuditEntityType;
import minibank.minibank.audit.service.AuditService;
import minibank.minibank.common.error.ErrorCodes;
import minibank.minibank.common.exception.BusinessException;
import minibank.minibank.common.exception.ConflictException;
import minibank.minibank.users.entity.Role;
import minibank.minibank.users.entity.User;
import minibank.minibank.users.entity.UserStatus;
import minibank.minibank.users.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class AuthService {

    private static final String TOKEN_TYPE = "Bearer";

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuditService auditService;

    public AuthService(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            AuditService auditService
    ) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.auditService = auditService;
    }

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.email())) {
            throw new ConflictException("Email is already registered");
        }
        if (userRepository.existsByDocumentNumber(request.documentNumber())) {
            throw new ConflictException("Document number is already registered");
        }

        User user = new User(
                request.firstName(),
                request.lastName(),
                request.email(),
                request.documentNumber(),
                passwordEncoder.encode(request.password()),
                Role.CUSTOMER,
                UserStatus.ACTIVE
        );

        User savedUser = userRepository.save(user);
        return authResponse(savedUser);
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest request, String ipAddress) {
        User user = userRepository.findByEmail(request.email())
                .orElse(null);

        if (user == null) {
            auditLoginFailure(null, null, "Unknown email login attempt", ipAddress);
            throw invalidCredentials();
        }

        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            auditLoginFailure(user.getId(), user.getId(), "Invalid credentials", ipAddress);
            throw invalidCredentials();
        }
        if (user.getStatus() != UserStatus.ACTIVE) {
            auditLoginFailure(user.getId(), user.getId(), "Inactive user login attempt", ipAddress);
            throw invalidCredentials();
        }

        auditService.recordRequiresNew(
                user.getId(),
                AuditAction.LOGIN_SUCCESS,
                AuditEntityType.AUTH,
                user.getId(),
                "Login successful",
                ipAddress
        );
        return authResponse(user);
    }

    @Transactional(readOnly = true)
    public MeResponse me(UUID userId) {
        User user = userRepository.findById(userId)
                .filter(foundUser -> foundUser.getStatus() == UserStatus.ACTIVE)
                .orElseThrow(this::invalidCredentials);

        return new MeResponse(toUserResponse(user));
    }

    private AuthResponse authResponse(User user) {
        return new AuthResponse(
                jwtService.generateToken(user),
                TOKEN_TYPE,
                jwtService.getExpirationMillis(),
                toAuthUserResponse(user)
        );
    }

    private AuthUserResponse toAuthUserResponse(User user) {
        return new AuthUserResponse(
                user.getId(),
                user.getFirstName(),
                user.getLastName(),
                user.getEmail(),
                user.getRole(),
                user.getStatus(),
                user.getCreatedAt()
        );
    }

    private UserResponse toUserResponse(User user) {
        return new UserResponse(
                user.getId(),
                user.getFirstName(),
                user.getLastName(),
                user.getEmail(),
                user.getDocumentNumber(),
                user.getRole(),
                user.getStatus(),
                user.getCreatedAt()
        );
    }

    private BusinessException invalidCredentials() {
        return new BusinessException(
                ErrorCodes.UNAUTHORIZED,
                "Invalid email or password",
                HttpStatus.UNAUTHORIZED
        );
    }

    private void auditLoginFailure(UUID userId, UUID entityId, String details, String ipAddress) {
        auditService.recordRequiresNew(
                userId,
                AuditAction.LOGIN_FAILURE,
                AuditEntityType.AUTH,
                entityId,
                details,
                ipAddress
        );
    }
}
