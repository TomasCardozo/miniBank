package minibank.minibank;

import com.fasterxml.jackson.databind.ObjectMapper;
import minibank.minibank.accounts.entity.Account;
import minibank.minibank.accounts.entity.AccountStatus;
import minibank.minibank.accounts.entity.Currency;
import minibank.minibank.accounts.repository.AccountRepository;
import minibank.minibank.audit.repository.AuditLogRepository;
import minibank.minibank.auth.service.JwtService;
import minibank.minibank.limits.entity.DailyLimit;
import minibank.minibank.limits.repository.DailyLimitRepository;
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
class DailyLimitIntegrationTest {

    private final MockMvc mockMvc;
    private final ObjectMapper objectMapper;
    private final UserRepository userRepository;
    private final AuditLogRepository auditLogRepository;
    private final AccountRepository accountRepository;
    private final DailyLimitRepository dailyLimitRepository;
    private final JwtService jwtService;

    @Autowired
    DailyLimitIntegrationTest(
            MockMvc mockMvc,
            UserRepository userRepository,
            AuditLogRepository auditLogRepository,
            AccountRepository accountRepository,
            DailyLimitRepository dailyLimitRepository,
            JwtService jwtService
    ) {
        this.mockMvc = mockMvc;
        this.objectMapper = new ObjectMapper().findAndRegisterModules();
        this.userRepository = userRepository;
        this.auditLogRepository = auditLogRepository;
        this.accountRepository = accountRepository;
        this.dailyLimitRepository = dailyLimitRepository;
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
        dailyLimitRepository.deleteAll();
        accountRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    void getLimitRequiresAuthentication() throws Exception {
        mockMvc.perform(get("/accounts/{accountId}/limits", UUID.randomUUID()))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
    }

    @Test
    void getLimitCreatesDefaultLimitForOwnAccount() throws Exception {
        String token = register("owner@example.com", "12345678");
        User owner = userRepository.findByEmail("owner@example.com").orElseThrow();
        Account account = saveAccount(owner, "111111111111", Currency.ARS, "main");

        mockMvc.perform(get("/accounts/{accountId}/limits", account.getId())
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accountId").value(account.getId().toString()))
                .andExpect(jsonPath("$.accountNumber").value("111111111111"))
                .andExpect(jsonPath("$.currency").value("ARS"))
                .andExpect(jsonPath("$.dailyLimit").value(500000.00))
                .andExpect(jsonPath("$.usedToday").value(0.00))
                .andExpect(jsonPath("$.availableToday").value(500000.00))
                .andExpect(jsonPath("$.date", notNullValue()))
                .andExpect(jsonPath("$.updatedAt", notNullValue()));

        DailyLimit savedLimit = dailyLimitRepository.findByAccountId(account.getId()).orElseThrow();
        assertThat(savedLimit.getDailyLimit()).isEqualByComparingTo("500000.00");
    }

    @Test
    void customerCanDecreaseOwnLimit() throws Exception {
        String token = register("owner@example.com", "12345678");
        User owner = userRepository.findByEmail("owner@example.com").orElseThrow();
        Account account = saveAccount(owner, "111111111111", Currency.ARS, "main");
        dailyLimitRepository.save(new DailyLimit(account, new BigDecimal("500000.00")));

        mockMvc.perform(patch("/accounts/{accountId}/limits", account.getId())
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(updateLimitJson("250000.00")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dailyLimit").value(250000.00))
                .andExpect(jsonPath("$.availableToday").value(250000.00));

        DailyLimit savedLimit = dailyLimitRepository.findByAccountId(account.getId()).orElseThrow();
        assertThat(savedLimit.getDailyLimit()).isEqualByComparingTo("250000.00");
    }

    @Test
    void customerCannotIncreaseOwnLimit() throws Exception {
        String token = register("owner@example.com", "12345678");
        User owner = userRepository.findByEmail("owner@example.com").orElseThrow();
        Account account = saveAccount(owner, "111111111111", Currency.ARS, "main");
        dailyLimitRepository.save(new DailyLimit(account, new BigDecimal("500000.00")));

        mockMvc.perform(patch("/accounts/{accountId}/limits", account.getId())
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(updateLimitJson("500000.01")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"))
                .andExpect(jsonPath("$.message").value("Customers can only decrease their daily limit"));

        DailyLimit savedLimit = dailyLimitRepository.findByAccountId(account.getId()).orElseThrow();
        assertThat(savedLimit.getDailyLimit()).isEqualByComparingTo("500000.00");
    }

    @Test
    void adminCanModifyAnyAccountLimit() throws Exception {
        register("owner@example.com", "12345678");
        User owner = userRepository.findByEmail("owner@example.com").orElseThrow();
        Account account = saveAccount(owner, "111111111111", Currency.ARS, "main");
        dailyLimitRepository.save(new DailyLimit(account, new BigDecimal("500000.00")));
        String adminToken = createAdminToken("admin@example.com", "99999999");

        mockMvc.perform(patch("/accounts/{accountId}/limits", account.getId())
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(updateLimitJson("750000.00")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dailyLimit").value(750000.00))
                .andExpect(jsonPath("$.availableToday").value(750000.00));

        DailyLimit savedLimit = dailyLimitRepository.findByAccountId(account.getId()).orElseThrow();
        assertThat(savedLimit.getDailyLimit()).isEqualByComparingTo("750000.00");
    }

    @Test
    void customerCannotManageForeignAccountLimit() throws Exception {
        String token = register("owner@example.com", "12345678");
        register("other@example.com", "87654321");
        User other = userRepository.findByEmail("other@example.com").orElseThrow();
        Account foreignAccount = saveAccount(other, "111111111111", Currency.ARS, "foreign");

        mockMvc.perform(get("/accounts/{accountId}/limits", foreignAccount.getId())
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"))
                .andExpect(jsonPath("$.message").value("Account not found"));

        mockMvc.perform(patch("/accounts/{accountId}/limits", foreignAccount.getId())
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(updateLimitJson("250000.00")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"))
                .andExpect(jsonPath("$.message").value("Account not found"));
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

    private Account saveAccount(User user, String accountNumber, Currency currency, String alias) {
        return accountRepository.save(new Account(
                user,
                accountNumber,
                alias,
                currency,
                new BigDecimal("0.00"),
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
}
