package minibank.minibank;

import minibank.minibank.accounts.repository.AccountRepository;
import minibank.minibank.audit.entity.AuditAction;
import minibank.minibank.audit.entity.AuditEntityType;
import minibank.minibank.audit.repository.AuditLogRepository;
import minibank.minibank.auth.service.JwtService;
import minibank.minibank.limits.repository.DailyLimitRepository;
import minibank.minibank.movements.repository.MovementRepository;
import minibank.minibank.transfers.repository.TransferRepository;
import minibank.minibank.users.entity.Role;
import minibank.minibank.users.entity.User;
import minibank.minibank.users.entity.UserStatus;
import minibank.minibank.users.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.notNullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ActiveProfiles("test")
@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
class AdminUserIntegrationTest {

    private final MockMvc mockMvc;
    private final UserRepository userRepository;
    private final AuditLogRepository auditLogRepository;
    private final MovementRepository movementRepository;
    private final TransferRepository transferRepository;
    private final DailyLimitRepository dailyLimitRepository;
    private final AccountRepository accountRepository;
    private final JwtService jwtService;
    private final PasswordEncoder passwordEncoder;

    @Autowired
    AdminUserIntegrationTest(
            MockMvc mockMvc,
            UserRepository userRepository,
            AuditLogRepository auditLogRepository,
            MovementRepository movementRepository,
            TransferRepository transferRepository,
            DailyLimitRepository dailyLimitRepository,
            AccountRepository accountRepository,
            JwtService jwtService,
            PasswordEncoder passwordEncoder
    ) {
        this.mockMvc = mockMvc;
        this.userRepository = userRepository;
        this.auditLogRepository = auditLogRepository;
        this.movementRepository = movementRepository;
        this.transferRepository = transferRepository;
        this.dailyLimitRepository = dailyLimitRepository;
        this.accountRepository = accountRepository;
        this.jwtService = jwtService;
        this.passwordEncoder = passwordEncoder;
    }

    @BeforeEach
    void setUp() {
        auditLogRepository.deleteAll();
        movementRepository.deleteAll();
        transferRepository.deleteAll();
        dailyLimitRepository.deleteAll();
        accountRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    void adminCanListUsersWithFilters() throws Exception {
        User admin = saveUser("admin@example.com", "99999999", Role.ADMIN, UserStatus.ACTIVE);
        saveUser("active@example.com", "12345678", Role.CUSTOMER, UserStatus.ACTIVE);
        User blocked = saveUser("blocked@example.com", "87654321", Role.CUSTOMER, UserStatus.BLOCKED);

        mockMvc.perform(get("/admin/users")
                        .header("Authorization", "Bearer " + jwtService.generateToken(admin))
                        .param("role", "CUSTOMER")
                        .param("status", "BLOCKED"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(1)))
                .andExpect(jsonPath("$.content[0].id").value(blocked.getId().toString()))
                .andExpect(jsonPath("$.content[0].email").value("blocked@example.com"))
                .andExpect(jsonPath("$.content[0].documentNumber").value("87654321"))
                .andExpect(jsonPath("$.content[0].role").value("CUSTOMER"))
                .andExpect(jsonPath("$.content[0].status").value("BLOCKED"))
                .andExpect(jsonPath("$.content[0].password").doesNotExist())
                .andExpect(jsonPath("$.content[0].passwordHash").doesNotExist())
                .andExpect(jsonPath("$.totalElements").value(1));
    }

    @Test
    void adminCanGetUserById() throws Exception {
        User admin = saveUser("admin@example.com", "99999999", Role.ADMIN, UserStatus.ACTIVE);
        User customer = saveUser("customer@example.com", "12345678", Role.CUSTOMER, UserStatus.ACTIVE);

        mockMvc.perform(get("/admin/users/{id}", customer.getId())
                        .header("Authorization", "Bearer " + jwtService.generateToken(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(customer.getId().toString()))
                .andExpect(jsonPath("$.firstName").value("Jane"))
                .andExpect(jsonPath("$.lastName").value("Doe"))
                .andExpect(jsonPath("$.email").value("customer@example.com"))
                .andExpect(jsonPath("$.documentNumber").value("12345678"))
                .andExpect(jsonPath("$.createdAt", notNullValue()))
                .andExpect(jsonPath("$.updatedAt", notNullValue()))
                .andExpect(jsonPath("$.passwordHash").doesNotExist());
    }

    @Test
    void getUserRejectsMissingUserAsNotFound() throws Exception {
        User admin = saveUser("admin@example.com", "99999999", Role.ADMIN, UserStatus.ACTIVE);

        mockMvc.perform(get("/admin/users/{id}", UUID.randomUUID())
                        .header("Authorization", "Bearer " + jwtService.generateToken(admin)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"))
                .andExpect(jsonPath("$.message").value("User not found"));
    }

    @Test
    void customerCannotAccessAdminUsers() throws Exception {
        User customer = saveUser("customer@example.com", "12345678", Role.CUSTOMER, UserStatus.ACTIVE);

        mockMvc.perform(get("/admin/users")
                        .header("Authorization", "Bearer " + jwtService.generateToken(customer)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }

    @Test
    void adminUsersRequireAuthentication() throws Exception {
        mockMvc.perform(get("/admin/users"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
    }

    @Test
    void adminCanBlockUserAndExistingTokenStopsWorking() throws Exception {
        User admin = saveUser("admin@example.com", "99999999", Role.ADMIN, UserStatus.ACTIVE);
        User customer = saveUser("customer@example.com", "12345678", Role.CUSTOMER, UserStatus.ACTIVE);
        String customerToken = jwtService.generateToken(customer);

        mockMvc.perform(patch("/admin/users/{id}/block", customer.getId())
                        .header("Authorization", "Bearer " + jwtService.generateToken(admin))
                        .header("X-Forwarded-For", "203.0.113.10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(customer.getId().toString()))
                .andExpect(jsonPath("$.status").value("BLOCKED"));

        assertThat(userRepository.findById(customer.getId()).orElseThrow().getStatus()).isEqualTo(UserStatus.BLOCKED);

        mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginJson("customer@example.com", "password123")))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));

        mockMvc.perform(get("/auth/me")
                        .header("Authorization", "Bearer " + customerToken))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));

        assertThat(auditLogRepository.findAll())
                .anySatisfy(log -> {
                    assertThat(log.getUser().getId()).isEqualTo(admin.getId());
                    assertThat(log.getAction()).isEqualTo(AuditAction.USER_BLOCKED);
                    assertThat(log.getEntityType()).isEqualTo(AuditEntityType.USER);
                    assertThat(log.getEntityId()).isEqualTo(customer.getId());
                    assertThat(log.getDetails()).contains("previousStatus=ACTIVE", "newStatus=BLOCKED");
                });
    }

    @Test
    void adminCanActivateBlockedUserAndUserCanLoginAgain() throws Exception {
        User admin = saveUser("admin@example.com", "99999999", Role.ADMIN, UserStatus.ACTIVE);
        User customer = saveUser("customer@example.com", "12345678", Role.CUSTOMER, UserStatus.BLOCKED);

        mockMvc.perform(patch("/admin/users/{id}/activate", customer.getId())
                        .header("Authorization", "Bearer " + jwtService.generateToken(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(customer.getId().toString()))
                .andExpect(jsonPath("$.status").value("ACTIVE"));

        assertThat(userRepository.findById(customer.getId()).orElseThrow().getStatus()).isEqualTo(UserStatus.ACTIVE);

        mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginJson("customer@example.com", "password123")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken", notNullValue()));

        assertThat(auditLogRepository.findAll())
                .anySatisfy(log -> {
                    assertThat(log.getUser().getId()).isEqualTo(admin.getId());
                    assertThat(log.getAction()).isEqualTo(AuditAction.USER_ACTIVATED);
                    assertThat(log.getEntityType()).isEqualTo(AuditEntityType.USER);
                    assertThat(log.getEntityId()).isEqualTo(customer.getId());
                    assertThat(log.getDetails()).contains("previousStatus=BLOCKED", "newStatus=ACTIVE");
                });
    }

    @Test
    void adminCannotBlockThemself() throws Exception {
        User admin = saveUser("admin@example.com", "99999999", Role.ADMIN, UserStatus.ACTIVE);

        mockMvc.perform(patch("/admin/users/{id}/block", admin.getId())
                        .header("Authorization", "Bearer " + jwtService.generateToken(admin)))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("BUSINESS_RULE_VIOLATION"))
                .andExpect(jsonPath("$.message").value("Admin users cannot block themselves"));

        assertThat(userRepository.findById(admin.getId()).orElseThrow().getStatus()).isEqualTo(UserStatus.ACTIVE);
    }

    @Test
    void adminCannotChangeClosedUserStatus() throws Exception {
        User admin = saveUser("admin@example.com", "99999999", Role.ADMIN, UserStatus.ACTIVE);
        User closed = saveUser("closed@example.com", "12345678", Role.CUSTOMER, UserStatus.CLOSED);
        String adminToken = jwtService.generateToken(admin);

        mockMvc.perform(patch("/admin/users/{id}/activate", closed.getId())
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("BUSINESS_RULE_VIOLATION"))
                .andExpect(jsonPath("$.message").value("Only blocked users can be activated"));

        mockMvc.perform(patch("/admin/users/{id}/block", closed.getId())
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("BUSINESS_RULE_VIOLATION"))
                .andExpect(jsonPath("$.message").value("Only active users can be blocked"));

        assertThat(userRepository.findById(closed.getId()).orElseThrow().getStatus()).isEqualTo(UserStatus.CLOSED);
        assertThat(auditLogRepository.findAll()).isEmpty();
    }

    private User saveUser(String email, String documentNumber, Role role, UserStatus status) {
        return userRepository.save(new User(
                "Jane",
                "Doe",
                email,
                documentNumber,
                passwordEncoder.encode("password123"),
                role,
                status
        ));
    }

    private String loginJson(String email, String password) {
        return """
                {
                  "email": "%s",
                  "password": "%s"
                }
                """.formatted(email, password);
    }
}
