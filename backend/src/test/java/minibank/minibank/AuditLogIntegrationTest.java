package minibank.minibank;

import com.fasterxml.jackson.databind.ObjectMapper;
import minibank.minibank.accounts.entity.Account;
import minibank.minibank.accounts.entity.AccountStatus;
import minibank.minibank.accounts.entity.Currency;
import minibank.minibank.accounts.repository.AccountRepository;
import minibank.minibank.audit.entity.AuditAction;
import minibank.minibank.audit.entity.AuditEntityType;
import minibank.minibank.audit.repository.AuditLogRepository;
import minibank.minibank.auth.service.JwtService;
import minibank.minibank.limits.entity.DailyLimit;
import minibank.minibank.limits.repository.DailyLimitRepository;
import minibank.minibank.movements.repository.MovementRepository;
import minibank.minibank.transfers.repository.TransferRepository;
import minibank.minibank.users.entity.Role;
import minibank.minibank.users.entity.User;
import minibank.minibank.users.entity.UserStatus;
import minibank.minibank.users.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ActiveProfiles("test")
@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
class AuditLogIntegrationTest {

    private final MockMvc mockMvc;
    private final ObjectMapper objectMapper;
    private final UserRepository userRepository;
    private final AccountRepository accountRepository;
    private final TransferRepository transferRepository;
    private final MovementRepository movementRepository;
    private final DailyLimitRepository dailyLimitRepository;
    private final AuditLogRepository auditLogRepository;
    private final JwtService jwtService;

    @Autowired
    AuditLogIntegrationTest(
            MockMvc mockMvc,
            UserRepository userRepository,
            AccountRepository accountRepository,
            TransferRepository transferRepository,
            MovementRepository movementRepository,
            DailyLimitRepository dailyLimitRepository,
            AuditLogRepository auditLogRepository,
            JwtService jwtService
    ) {
        this.mockMvc = mockMvc;
        this.objectMapper = new ObjectMapper().findAndRegisterModules();
        this.userRepository = userRepository;
        this.accountRepository = accountRepository;
        this.transferRepository = transferRepository;
        this.movementRepository = movementRepository;
        this.dailyLimitRepository = dailyLimitRepository;
        this.auditLogRepository = auditLogRepository;
        this.jwtService = jwtService;
    }

    @BeforeEach
    void setUp() {
        cleanDatabase();
    }

    @AfterEach
    void tearDown() {
        cleanDatabase();
    }

    private void cleanDatabase() {
        auditLogRepository.deleteAll();
        movementRepository.deleteAll();
        transferRepository.deleteAll();
        dailyLimitRepository.deleteAll();
        accountRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    void successfulLoginCreatesAuditLogWithClientIp() throws Exception {
        register("user@example.com", "12345678");
        User user = userRepository.findByEmail("user@example.com").orElseThrow();

        mockMvc.perform(post("/auth/login")
                        .header("X-Forwarded-For", "203.0.113.10, 10.0.0.1")
                        .with(request -> {
                            request.setRemoteAddr("198.51.100.20");
                            return request;
                        })
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginJson("user@example.com", "password123")))
                .andExpect(status().isOk());

        assertThat(auditLogRepository.findAll())
                .hasSize(1)
                .first()
                .satisfies(log -> {
                    assertThat(log.getUser().getId()).isEqualTo(user.getId());
                    assertThat(log.getAction()).isEqualTo(AuditAction.LOGIN_SUCCESS);
                    assertThat(log.getEntityType()).isEqualTo(AuditEntityType.AUTH);
                    assertThat(log.getEntityId()).isEqualTo(user.getId());
                    assertThat(log.getDetails()).isEqualTo("Login successful");
                    assertThat(log.getIpAddress()).isEqualTo("198.51.100.20");
                });
    }

    @Test
    void failedLoginCreatesAuditLog() throws Exception {
        register("user@example.com", "12345678");
        User user = userRepository.findByEmail("user@example.com").orElseThrow();

        mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginJson("user@example.com", "wrong-password")))
                .andExpect(status().isUnauthorized());

        assertThat(auditLogRepository.findAll())
                .hasSize(1)
                .first()
                .satisfies(log -> {
                    assertThat(log.getUser().getId()).isEqualTo(user.getId());
                    assertThat(log.getAction()).isEqualTo(AuditAction.LOGIN_FAILURE);
                    assertThat(log.getEntityType()).isEqualTo(AuditEntityType.AUTH);
                    assertThat(log.getEntityId()).isEqualTo(user.getId());
                    assertThat(log.getDetails()).isEqualTo("Invalid credentials");
                });
    }

    @Test
    void unknownEmailFailedLoginCreatesAuditLogWithoutUser() throws Exception {
        mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginJson("missing@example.com", "password123")))
                .andExpect(status().isUnauthorized());

        assertThat(auditLogRepository.findAll())
                .hasSize(1)
                .first()
                .satisfies(log -> {
                    assertThat(log.getUser()).isNull();
                    assertThat(log.getAction()).isEqualTo(AuditAction.LOGIN_FAILURE);
                    assertThat(log.getEntityId()).isNull();
                    assertThat(log.getDetails()).isEqualTo("Unknown email login attempt");
                });
    }

    @Test
    void completedAndRejectedTransfersCreateAuditLogs() throws Exception {
        String token = register("owner@example.com", "12345678");
        register("target@example.com", "87654321");
        User owner = userRepository.findByEmail("owner@example.com").orElseThrow();
        User target = userRepository.findByEmail("target@example.com").orElseThrow();
        Account source = saveAccount(owner, "111111111111", Currency.ARS, "source", "500.00");
        Account targetAccount = saveAccount(target, "222222222222", Currency.ARS, "target", "100.00");

        mockMvc.perform(post("/transfers")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createTransferJson(source.getId(), targetAccount.getAccountNumber(), "100.00")))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/transfers")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createTransferJson(source.getId(), targetAccount.getAccountNumber(), "1000.00")))
                .andExpect(status().isUnprocessableEntity());

        assertThat(auditLogRepository.findAll())
                .hasSize(2)
                .anySatisfy(log -> {
                    assertThat(log.getAction()).isEqualTo(AuditAction.TRANSFER_COMPLETED);
                    assertThat(log.getEntityType()).isEqualTo(AuditEntityType.TRANSFER);
                    assertThat(log.getEntityId()).isNotNull();
                    assertThat(log.getDetails()).contains("amount=100.00", "currency=ARS");
                })
                .anySatisfy(log -> {
                    assertThat(log.getAction()).isEqualTo(AuditAction.TRANSFER_REJECTED);
                    assertThat(log.getEntityType()).isEqualTo(AuditEntityType.TRANSFER);
                    assertThat(log.getEntityId()).isNull();
                    assertThat(log.getDetails()).contains("reason=TRANSFER_INSUFFICIENT_FUNDS");
                });
    }

    @Test
    void dailyLimitUpdateCreatesAuditLog() throws Exception {
        String token = register("owner@example.com", "12345678");
        User owner = userRepository.findByEmail("owner@example.com").orElseThrow();
        Account account = saveAccount(owner, "111111111111", Currency.ARS, "main", "0.00");
        dailyLimitRepository.save(new DailyLimit(account, new BigDecimal("500000.00")));

        mockMvc.perform(patch("/accounts/{accountId}/limits", account.getId())
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(updateLimitJson("250000.00")))
                .andExpect(status().isOk());

        assertThat(auditLogRepository.findAll())
                .hasSize(1)
                .first()
                .satisfies(log -> {
                    assertThat(log.getAction()).isEqualTo(AuditAction.DAILY_LIMIT_UPDATED);
                    assertThat(log.getEntityType()).isEqualTo(AuditEntityType.DAILY_LIMIT);
                    assertThat(log.getEntityId()).isNotNull();
                    assertThat(log.getDetails()).contains("previousLimit=500000.00", "newLimit=250000.00", "role=CUSTOMER");
                });
    }

    @Test
    void adminCanListAuditLogsWithFiltersButCustomerCannot() throws Exception {
        String customerToken = register("owner@example.com", "12345678");
        mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginJson("owner@example.com", "password123")))
                .andExpect(status().isOk());
        User owner = userRepository.findByEmail("owner@example.com").orElseThrow();
        String adminToken = createAdminToken("admin@example.com", "99999999");

        mockMvc.perform(get("/admin/audit-logs"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/admin/audit-logs")
                        .header("Authorization", "Bearer " + customerToken))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/admin/audit-logs")
                        .header("Authorization", "Bearer " + adminToken)
                        .param("action", "LOGIN_SUCCESS")
                        .param("entityType", "AUTH")
                        .param("userId", owner.getId().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(1)))
                .andExpect(jsonPath("$.content[0].userId").value(owner.getId().toString()))
                .andExpect(jsonPath("$.content[0].action").value("LOGIN_SUCCESS"))
                .andExpect(jsonPath("$.content[0].entityType").value("AUTH"))
                .andExpect(jsonPath("$.content[0].entityId").value(owner.getId().toString()))
                .andExpect(jsonPath("$.content[0].details").value("Login successful"))
                .andExpect(jsonPath("$.content[0].createdAt", notNullValue()));
    }

    private String register(String email, String documentNumber) throws Exception {
        String response = mockMvc.perform(post("/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(registerJson(email, documentNumber)))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();

        return objectMapper.readTree(response).get("accessToken").asText();
    }

    private Account saveAccount(User user, String accountNumber, Currency currency, String alias, String balance) {
        return accountRepository.save(new Account(
                user,
                accountNumber,
                alias,
                currency,
                new BigDecimal(balance),
                AccountStatus.ACTIVE
        ));
    }

    private String createAdminToken(String email, String documentNumber) {
        User admin = userRepository.save(new User(
                "Admin",
                "User",
                email,
                documentNumber,
                "unused",
                Role.ADMIN,
                UserStatus.ACTIVE
        ));
        return jwtService.generateToken(admin);
    }

    private String createTransferJson(UUID sourceAccountId, String targetAccountNumber, String amount) {
        return """
                {
                  "sourceAccountId": "%s",
                  "targetAccountNumber": "%s",
                  "amount": %s,
                  "description": "test transfer"
                }
                """.formatted(sourceAccountId, targetAccountNumber, amount);
    }

    private String updateLimitJson(String dailyLimit) {
        return """
                {
                  "dailyLimit": %s
                }
                """.formatted(dailyLimit);
    }

    private String registerJson(String email, String documentNumber) {
        return """
                {
                  "firstName": "Jane",
                  "lastName": "Doe",
                  "email": "%s",
                  "documentNumber": "%s",
                  "password": "password123"
                }
                """.formatted(email, documentNumber);
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
