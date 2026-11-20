package minibank.minibank;

import com.fasterxml.jackson.databind.ObjectMapper;
import minibank.minibank.accounts.entity.Account;
import minibank.minibank.accounts.entity.AccountStatus;
import minibank.minibank.accounts.entity.Currency;
import minibank.minibank.accounts.repository.AccountRepository;
import minibank.minibank.audit.repository.AuditLogRepository;
import minibank.minibank.users.entity.User;
import minibank.minibank.users.repository.UserRepository;
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
import static org.hamcrest.Matchers.matchesPattern;
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
class AccountIntegrationTest {

    private final MockMvc mockMvc;
    private final ObjectMapper objectMapper;
    private final UserRepository userRepository;
    private final AuditLogRepository auditLogRepository;
    private final AccountRepository accountRepository;

    @Autowired
    AccountIntegrationTest(
            MockMvc mockMvc,
            UserRepository userRepository,
            AuditLogRepository auditLogRepository,
            AccountRepository accountRepository
    ) {
        this.mockMvc = mockMvc;
        this.objectMapper = new ObjectMapper().findAndRegisterModules();
        this.userRepository = userRepository;
        this.auditLogRepository = auditLogRepository;
        this.accountRepository = accountRepository;
    }

    @BeforeEach
    void setUp() {
        auditLogRepository.deleteAll();
        accountRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    void createAccountRequiresAuthentication() throws Exception {
        mockMvc.perform(post("/accounts")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createAccountJson("ARS", "main-account")))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
    }

    @Test
    void listAccountsRequiresAuthentication() throws Exception {
        mockMvc.perform(get("/accounts"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
    }

    @Test
    void getAccountRequiresAuthentication() throws Exception {
        mockMvc.perform(get("/accounts/{id}", UUID.randomUUID()))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
    }

    @Test
    void getBalanceRequiresAuthentication() throws Exception {
        mockMvc.perform(get("/accounts/{id}/balance", UUID.randomUUID()))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
    }

    @Test
    void updateAliasRequiresAuthentication() throws Exception {
        mockMvc.perform(patch("/accounts/{id}/alias", UUID.randomUUID())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(updateAliasJson("new-alias")))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
    }

    @Test
    void createAccountCreatesZeroBalanceActiveAccount() throws Exception {
        String token = register("user@example.com", "12345678");

        mockMvc.perform(post("/accounts")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createAccountJson("ARS", "main-account")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id", notNullValue()))
                .andExpect(jsonPath("$.accountNumber", matchesPattern("^[0-9]{12}$")))
                .andExpect(jsonPath("$.alias").value("main-account"))
                .andExpect(jsonPath("$.currency").value("ARS"))
                .andExpect(jsonPath("$.balance").value(0.00))
                .andExpect(jsonPath("$.status").value("ACTIVE"));

        Account savedAccount = accountRepository.findAll().getFirst();
        assertThat(savedAccount.getBalance()).isEqualByComparingTo("0.00");
        assertThat(savedAccount.getStatus()).isEqualTo(AccountStatus.ACTIVE);
    }

    @Test
    void createAccountRejectsMissingCurrency() throws Exception {
        String token = register("user@example.com", "12345678");

        mockMvc.perform(post("/accounts")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "alias": "main-account"
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("currency"));
    }

    @Test
    void createAccountRejectsInvalidCurrency() throws Exception {
        String token = register("user@example.com", "12345678");

        mockMvc.perform(post("/accounts")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createAccountJson("EUR", "main-account")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.message").value("Request body is invalid"));
    }

    @Test
    void createAccountRejectsAliasLongerThanOneHundredCharacters() throws Exception {
        String token = register("user@example.com", "12345678");

        mockMvc.perform(post("/accounts")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createAccountJson("ARS", "a".repeat(101))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("alias"));
    }

    @Test
    void listAccountsReturnsOnlyAuthenticatedUserAccounts() throws Exception {
        String firstToken = register("first@example.com", "12345678");
        register("second@example.com", "87654321");
        User firstUser = userRepository.findByEmail("first@example.com").orElseThrow();
        User secondUser = userRepository.findByEmail("second@example.com").orElseThrow();
        Account firstAccount = saveAccount(firstUser, "111111111111", Currency.ARS, "first");
        saveAccount(secondUser, "222222222222", Currency.USD, "second");

        mockMvc.perform(get("/accounts")
                        .header("Authorization", "Bearer " + firstToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].id").value(firstAccount.getId().toString()))
                .andExpect(jsonPath("$[0].alias").value("first"));
    }

    @Test
    void getAccountReturnsOwnAccount() throws Exception {
        String token = register("user@example.com", "12345678");
        User user = userRepository.findByEmail("user@example.com").orElseThrow();
        Account account = saveAccount(user, "111111111111", Currency.ARS, "main");

        mockMvc.perform(get("/accounts/{id}", account.getId())
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(account.getId().toString()))
                .andExpect(jsonPath("$.accountNumber").value("111111111111"));
    }

    @Test
    void getAccountRejectsForeignAccountAsNotFound() throws Exception {
        String firstToken = register("first@example.com", "12345678");
        register("second@example.com", "87654321");
        User secondUser = userRepository.findByEmail("second@example.com").orElseThrow();
        Account foreignAccount = saveAccount(secondUser, "222222222222", Currency.USD, "second");

        mockMvc.perform(get("/accounts/{id}", foreignAccount.getId())
                        .header("Authorization", "Bearer " + firstToken))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"))
                .andExpect(jsonPath("$.message").value("Account not found"));
    }

    @Test
    void getAccountRejectsMissingAccountAsNotFound() throws Exception {
        String token = register("user@example.com", "12345678");

        mockMvc.perform(get("/accounts/{id}", UUID.randomUUID())
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"))
                .andExpect(jsonPath("$.message").value("Account not found"));
    }

    @Test
    void getAccountRejectsInvalidUuid() throws Exception {
        String token = register("user@example.com", "12345678");

        mockMvc.perform(get("/accounts/not-a-uuid")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.message").value("Request parameter is invalid"));
    }

    @Test
    void getBalanceReturnsOwnAccountBalance() throws Exception {
        String token = register("user@example.com", "12345678");
        User user = userRepository.findByEmail("user@example.com").orElseThrow();
        Account account = saveAccount(user, "111111111111", Currency.USD, "savings");

        mockMvc.perform(get("/accounts/{id}/balance", account.getId())
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accountId").value(account.getId().toString()))
                .andExpect(jsonPath("$.accountNumber").value("111111111111"))
                .andExpect(jsonPath("$.currency").value("USD"))
                .andExpect(jsonPath("$.balance").value(0.00));
    }

    @Test
    void getBalanceRejectsForeignAccountAsNotFound() throws Exception {
        String firstToken = register("first@example.com", "12345678");
        register("second@example.com", "87654321");
        User secondUser = userRepository.findByEmail("second@example.com").orElseThrow();
        Account foreignAccount = saveAccount(secondUser, "222222222222", Currency.USD, "second");

        mockMvc.perform(get("/accounts/{id}/balance", foreignAccount.getId())
                        .header("Authorization", "Bearer " + firstToken))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }

    @Test
    void getBalanceRejectsMissingAccountAsNotFound() throws Exception {
        String token = register("user@example.com", "12345678");

        mockMvc.perform(get("/accounts/{id}/balance", UUID.randomUUID())
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"))
                .andExpect(jsonPath("$.message").value("Account not found"));
    }

    @Test
    void updateAliasUpdatesOwnAccount() throws Exception {
        String token = register("user@example.com", "12345678");
        User user = userRepository.findByEmail("user@example.com").orElseThrow();
        Account account = saveAccount(user, "111111111111", Currency.ARS, "old-alias");

        mockMvc.perform(patch("/accounts/{id}/alias", account.getId())
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(updateAliasJson("new-alias")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(account.getId().toString()))
                .andExpect(jsonPath("$.alias").value("new-alias"));

        Account updatedAccount = accountRepository.findById(account.getId()).orElseThrow();
        assertThat(updatedAccount.getAlias()).isEqualTo("new-alias");
    }

    @Test
    void updateAliasAllowsNullAlias() throws Exception {
        String token = register("user@example.com", "12345678");
        User user = userRepository.findByEmail("user@example.com").orElseThrow();
        Account account = saveAccount(user, "111111111111", Currency.ARS, "old-alias");

        mockMvc.perform(patch("/accounts/{id}/alias", account.getId())
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "alias": null
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.alias").doesNotExist());

        Account updatedAccount = accountRepository.findById(account.getId()).orElseThrow();
        assertThat(updatedAccount.getAlias()).isNull();
    }

    @Test
    void updateAliasRejectsAliasLongerThanOneHundredCharacters() throws Exception {
        String token = register("user@example.com", "12345678");
        User user = userRepository.findByEmail("user@example.com").orElseThrow();
        Account account = saveAccount(user, "111111111111", Currency.ARS, "old-alias");

        mockMvc.perform(patch("/accounts/{id}/alias", account.getId())
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(updateAliasJson("a".repeat(101))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("alias"));
    }

    @Test
    void updateAliasRejectsForeignAccountAsNotFound() throws Exception {
        String firstToken = register("first@example.com", "12345678");
        register("second@example.com", "87654321");
        User secondUser = userRepository.findByEmail("second@example.com").orElseThrow();
        Account foreignAccount = saveAccount(secondUser, "222222222222", Currency.USD, "second");

        mockMvc.perform(patch("/accounts/{id}/alias", foreignAccount.getId())
                        .header("Authorization", "Bearer " + firstToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(updateAliasJson("hacked")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));

        Account unchangedAccount = accountRepository.findById(foreignAccount.getId()).orElseThrow();
        assertThat(unchangedAccount.getAlias()).isEqualTo("second");
    }

    @Test
    void updateAliasRejectsMissingAccountAsNotFound() throws Exception {
        String token = register("user@example.com", "12345678");

        mockMvc.perform(patch("/accounts/{id}/alias", UUID.randomUUID())
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(updateAliasJson("new-alias")))
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

    private String createAccountJson(String currency, String alias) {
        return """
                {
                  "currency": "%s",
                  "alias": "%s"
                }
                """.formatted(currency, alias);
    }

    private String updateAliasJson(String alias) {
        return """
                {
                  "alias": "%s"
                }
                """.formatted(alias);
    }
}
