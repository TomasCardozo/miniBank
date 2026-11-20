package minibank.minibank;

import minibank.minibank.accounts.entity.Account;
import minibank.minibank.accounts.entity.AccountStatus;
import minibank.minibank.accounts.entity.Currency;
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
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
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
class AdminAccountIntegrationTest {

    private final MockMvc mockMvc;
    private final UserRepository userRepository;
    private final AccountRepository accountRepository;
    private final TransferRepository transferRepository;
    private final MovementRepository movementRepository;
    private final DailyLimitRepository dailyLimitRepository;
    private final AuditLogRepository auditLogRepository;
    private final JwtService jwtService;

    @Autowired
    AdminAccountIntegrationTest(
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
        auditLogRepository.deleteAll();
        movementRepository.deleteAll();
        transferRepository.deleteAll();
        dailyLimitRepository.deleteAll();
        accountRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    void adminCanBlockAndActivateAccountWithAuditLogs() throws Exception {
        User admin = saveUser("admin@example.com", "99999999", Role.ADMIN);
        User customer = saveUser("customer@example.com", "12345678", Role.CUSTOMER);
        Account account = saveAccount(customer, "111111111111", AccountStatus.ACTIVE, "500.00");
        String adminToken = jwtService.generateToken(admin);

        mockMvc.perform(patch("/admin/accounts/{id}/block", account.getId())
                        .header("Authorization", "Bearer " + adminToken)
                        .header("X-Forwarded-For", "203.0.113.10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(account.getId().toString()))
                .andExpect(jsonPath("$.userId").value(customer.getId().toString()))
                .andExpect(jsonPath("$.status").value("BLOCKED"));

        assertThat(accountRepository.findById(account.getId()).orElseThrow().getStatus()).isEqualTo(AccountStatus.BLOCKED);

        mockMvc.perform(patch("/admin/accounts/{id}/activate", account.getId())
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(account.getId().toString()))
                .andExpect(jsonPath("$.status").value("ACTIVE"));

        assertThat(accountRepository.findById(account.getId()).orElseThrow().getStatus()).isEqualTo(AccountStatus.ACTIVE);
        assertThat(auditLogRepository.findAll())
                .hasSize(2)
                .anySatisfy(log -> {
                    assertThat(log.getUser().getId()).isEqualTo(admin.getId());
                    assertThat(log.getAction()).isEqualTo(AuditAction.ACCOUNT_BLOCKED);
                    assertThat(log.getEntityType()).isEqualTo(AuditEntityType.ACCOUNT);
                    assertThat(log.getEntityId()).isEqualTo(account.getId());
                    assertThat(log.getDetails()).contains("previousStatus=ACTIVE", "newStatus=BLOCKED");
                })
                .anySatisfy(log -> {
                    assertThat(log.getUser().getId()).isEqualTo(admin.getId());
                    assertThat(log.getAction()).isEqualTo(AuditAction.ACCOUNT_ACTIVATED);
                    assertThat(log.getEntityType()).isEqualTo(AuditEntityType.ACCOUNT);
                    assertThat(log.getEntityId()).isEqualTo(account.getId());
                    assertThat(log.getDetails()).contains("previousStatus=BLOCKED", "newStatus=ACTIVE");
                });
    }

    @Test
    void adminCanListAllAccountsWithOwnerAndFilterByUser() throws Exception {
        User admin = saveUser("admin@example.com", "99999999", Role.ADMIN);
        User alice = saveUser("alice@example.com", "12345678", Role.CUSTOMER);
        User bob = saveUser("bob@example.com", "87654321", Role.CUSTOMER);
        Account aliceArs = saveAccount(alice, "111111111111", AccountStatus.ACTIVE, "500.00");
        accountRepository.save(new Account(alice, "222222222222", "usd", Currency.USD, new BigDecimal("10.00"), AccountStatus.BLOCKED));
        saveAccount(bob, "333333333333", AccountStatus.ACTIVE, "0.00");
        String adminToken = jwtService.generateToken(admin);

        mockMvc.perform(get("/admin/accounts")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(3))
                .andExpect(jsonPath("$.content[0].ownerEmail").value(notNullValue()));

        mockMvc.perform(get("/admin/accounts")
                        .param("userId", alice.getId().toString())
                        .param("sort", "accountNumber,asc")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.content[0].id").value(aliceArs.getId().toString()))
                .andExpect(jsonPath("$.content[0].userId").value(alice.getId().toString()))
                .andExpect(jsonPath("$.content[0].ownerFirstName").value("Jane"))
                .andExpect(jsonPath("$.content[0].ownerLastName").value("Doe"))
                .andExpect(jsonPath("$.content[0].ownerEmail").value("alice@example.com"))
                .andExpect(jsonPath("$.content[0].accountNumber").value("111111111111"))
                .andExpect(jsonPath("$.content[0].currency").value("ARS"))
                .andExpect(jsonPath("$.content[0].balance").value(500.00))
                .andExpect(jsonPath("$.content[0].status").value("ACTIVE"))
                .andExpect(jsonPath("$.content[1].accountNumber").value("222222222222"));

        mockMvc.perform(get("/admin/accounts")
                        .param("status", "BLOCKED")
                        .param("currency", "USD")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].accountNumber").value("222222222222"));
    }

    @Test
    void adminAccountListRejectsUnsupportedSort() throws Exception {
        User admin = saveUser("admin@example.com", "99999999", Role.ADMIN);

        mockMvc.perform(get("/admin/accounts")
                        .param("sort", "alias,asc")
                        .header("Authorization", "Bearer " + jwtService.generateToken(admin)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    @Test
    void adminAccountListRequiresAdminRole() throws Exception {
        User customer = saveUser("customer@example.com", "12345678", Role.CUSTOMER);

        mockMvc.perform(get("/admin/accounts"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/admin/accounts")
                        .header("Authorization", "Bearer " + jwtService.generateToken(customer)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }

    @Test
    void adminAccountsRequireAdminRole() throws Exception {
        User customer = saveUser("customer@example.com", "12345678", Role.CUSTOMER);
        Account account = saveAccount(customer, "111111111111", AccountStatus.ACTIVE, "0.00");
        String customerToken = jwtService.generateToken(customer);

        mockMvc.perform(patch("/admin/accounts/{id}/block", account.getId()))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));

        mockMvc.perform(patch("/admin/accounts/{id}/block", account.getId())
                        .header("Authorization", "Bearer " + customerToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }

    @Test
    void adminCanCreditActiveAccountBalanceAndAuditsChange() throws Exception {
        User admin = saveUser("admin@example.com", "99999999", Role.ADMIN);
        User customer = saveUser("customer@example.com", "12345678", Role.CUSTOMER);
        Account account = saveAccount(customer, "111111111111", AccountStatus.ACTIVE, "0.00");
        String adminToken = jwtService.generateToken(admin);

        mockMvc.perform(patch("/admin/accounts/{id}/balance/credit", account.getId())
                        .header("Authorization", "Bearer " + adminToken)
                        .header("X-Forwarded-For", "203.0.113.10")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(creditJson("1000.00")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(account.getId().toString()))
                .andExpect(jsonPath("$.userId").value(customer.getId().toString()))
                .andExpect(jsonPath("$.balance").value(1000.00));

        assertThat(accountRepository.findById(account.getId()).orElseThrow().getBalance()).isEqualByComparingTo("1000.00");
        mockMvc.perform(get("/accounts/{accountId}/movements", account.getId())
                        .header("Authorization", "Bearer " + jwtService.generateToken(customer)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].type").value("CREDIT"))
                .andExpect(jsonPath("$.content[0].origin").value("ADMIN_CREDIT"))
                .andExpect(jsonPath("$.content[0].transferId").value(nullValue()))
                .andExpect(jsonPath("$.content[0].amount").value(1000.00))
                .andExpect(jsonPath("$.content[0].balanceAfter").value(1000.00));
        assertThat(auditLogRepository.findAll())
                .singleElement()
                .satisfies(log -> {
                    assertThat(log.getUser().getId()).isEqualTo(admin.getId());
                    assertThat(log.getAction()).isEqualTo(AuditAction.ACCOUNT_CREDITED);
                    assertThat(log.getEntityType()).isEqualTo(AuditEntityType.ACCOUNT);
                    assertThat(log.getEntityId()).isEqualTo(account.getId());
                    assertThat(log.getIpAddress()).isEqualTo("127.0.0.1");
                    assertThat(log.getDetails()).contains(
                            "accountId=" + account.getId(),
                            "userId=" + customer.getId(),
                            "amount=1000.00",
                            "previousBalance=0.00",
                            "newBalance=1000.00"
                    );
                });
    }

    @Test
    void customerCannotCreditAccountBalance() throws Exception {
        User customer = saveUser("customer@example.com", "12345678", Role.CUSTOMER);
        Account account = saveAccount(customer, "111111111111", AccountStatus.ACTIVE, "0.00");
        String customerToken = jwtService.generateToken(customer);

        mockMvc.perform(patch("/admin/accounts/{id}/balance/credit", account.getId())
                        .header("Authorization", "Bearer " + customerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(creditJson("1000.00")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));

        assertThat(accountRepository.findById(account.getId()).orElseThrow().getBalance()).isEqualByComparingTo("0.00");
        assertThat(auditLogRepository.findAll()).isEmpty();
    }

    @Test
    void unauthenticatedUserCannotCreditAccountBalance() throws Exception {
        User customer = saveUser("customer@example.com", "12345678", Role.CUSTOMER);
        Account account = saveAccount(customer, "111111111111", AccountStatus.ACTIVE, "0.00");

        mockMvc.perform(patch("/admin/accounts/{id}/balance/credit", account.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(creditJson("1000.00")))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));

        assertThat(accountRepository.findById(account.getId()).orElseThrow().getBalance()).isEqualByComparingTo("0.00");
    }

    @Test
    void adminCannotCreditInvalidAmount() throws Exception {
        User admin = saveUser("admin@example.com", "99999999", Role.ADMIN);
        User customer = saveUser("customer@example.com", "12345678", Role.CUSTOMER);
        Account account = saveAccount(customer, "111111111111", AccountStatus.ACTIVE, "0.00");
        String adminToken = jwtService.generateToken(admin);

        mockMvc.perform(patch("/admin/accounts/{id}/balance/credit", account.getId())
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(creditJson("0.00")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));

        mockMvc.perform(patch("/admin/accounts/{id}/balance/credit", account.getId())
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(creditJson("-1.00")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));

        assertThat(accountRepository.findById(account.getId()).orElseThrow().getBalance()).isEqualByComparingTo("0.00");
        assertThat(auditLogRepository.findAll()).isEmpty();
    }

    @Test
    void adminCannotCreditMissingAccount() throws Exception {
        User admin = saveUser("admin@example.com", "99999999", Role.ADMIN);
        String adminToken = jwtService.generateToken(admin);

        mockMvc.perform(patch("/admin/accounts/{id}/balance/credit", UUID.randomUUID())
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(creditJson("1000.00")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));

        assertThat(auditLogRepository.findAll()).isEmpty();
    }

    @Test
    void adminCannotCreditInactiveAccount() throws Exception {
        User admin = saveUser("admin@example.com", "99999999", Role.ADMIN);
        User customer = saveUser("customer@example.com", "12345678", Role.CUSTOMER);
        Account blocked = saveAccount(customer, "111111111111", AccountStatus.BLOCKED, "0.00");
        Account closed = saveAccount(customer, "222222222222", AccountStatus.CLOSED, "0.00");
        String adminToken = jwtService.generateToken(admin);

        mockMvc.perform(patch("/admin/accounts/{id}/balance/credit", blocked.getId())
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(creditJson("1000.00")))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("BUSINESS_RULE_VIOLATION"))
                .andExpect(jsonPath("$.message").value("Only active accounts can be credited"));

        mockMvc.perform(patch("/admin/accounts/{id}/balance/credit", closed.getId())
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(creditJson("1000.00")))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("BUSINESS_RULE_VIOLATION"))
                .andExpect(jsonPath("$.message").value("Only active accounts can be credited"));

        assertThat(accountRepository.findById(blocked.getId()).orElseThrow().getBalance()).isEqualByComparingTo("0.00");
        assertThat(accountRepository.findById(closed.getId()).orElseThrow().getBalance()).isEqualByComparingTo("0.00");
        assertThat(auditLogRepository.findAll()).isEmpty();
    }

    @Test
    void adminCannotBlockOrActivateInvalidAccountStates() throws Exception {
        User admin = saveUser("admin@example.com", "99999999", Role.ADMIN);
        User customer = saveUser("customer@example.com", "12345678", Role.CUSTOMER);
        Account blocked = saveAccount(customer, "111111111111", AccountStatus.BLOCKED, "0.00");
        Account closed = saveAccount(customer, "222222222222", AccountStatus.CLOSED, "0.00");
        String adminToken = jwtService.generateToken(admin);

        mockMvc.perform(patch("/admin/accounts/{id}/block", blocked.getId())
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("BUSINESS_RULE_VIOLATION"))
                .andExpect(jsonPath("$.message").value("Only active accounts can be blocked"));

        mockMvc.perform(patch("/admin/accounts/{id}/activate", closed.getId())
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("BUSINESS_RULE_VIOLATION"))
                .andExpect(jsonPath("$.message").value("Only blocked accounts can be activated"));

        assertThat(auditLogRepository.findAll()).isEmpty();
    }

    @Test
    void blockedAccountRejectsTransfersAndActivatedAccountCanTransferAgain() throws Exception {
        User admin = saveUser("admin@example.com", "99999999", Role.ADMIN);
        User owner = saveUser("owner@example.com", "12345678", Role.CUSTOMER);
        User target = saveUser("target@example.com", "87654321", Role.CUSTOMER);
        Account source = saveAccount(owner, "111111111111", AccountStatus.ACTIVE, "500.00");
        Account targetAccount = saveAccount(target, "222222222222", AccountStatus.ACTIVE, "100.00");
        String adminToken = jwtService.generateToken(admin);
        String ownerToken = jwtService.generateToken(owner);

        mockMvc.perform(patch("/admin/accounts/{id}/block", source.getId())
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());

        mockMvc.perform(post("/transfers")
                        .header("Authorization", "Bearer " + ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createTransferJson(source.getId(), targetAccount.getAccountNumber(), "100.00")))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("TRANSFER_SOURCE_INACTIVE"));

        mockMvc.perform(patch("/admin/accounts/{id}/activate", source.getId())
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());

        mockMvc.perform(post("/transfers")
                        .header("Authorization", "Bearer " + ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createTransferJson(source.getId(), targetAccount.getAccountNumber(), "100.00")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id", notNullValue()))
                .andExpect(jsonPath("$.status").value("COMPLETED"));
    }

    @Test
    void creditedBalanceAllowsRealTransfer() throws Exception {
        User admin = saveUser("admin@example.com", "99999999", Role.ADMIN);
        User owner = saveUser("owner@example.com", "12345678", Role.CUSTOMER);
        User target = saveUser("target@example.com", "87654321", Role.CUSTOMER);
        Account source = saveAccount(owner, "111111111111", AccountStatus.ACTIVE, "0.00");
        Account targetAccount = saveAccount(target, "222222222222", AccountStatus.ACTIVE, "100.00");
        String adminToken = jwtService.generateToken(admin);
        String ownerToken = jwtService.generateToken(owner);

        mockMvc.perform(patch("/admin/accounts/{id}/balance/credit", source.getId())
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(creditJson("500.00")))
                .andExpect(status().isOk());

        mockMvc.perform(post("/transfers")
                        .header("Authorization", "Bearer " + ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createTransferJson(source.getId(), targetAccount.getAccountNumber(), "100.00")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id", notNullValue()))
                .andExpect(jsonPath("$.status").value("COMPLETED"));

        assertThat(accountRepository.findById(source.getId()).orElseThrow().getBalance()).isEqualByComparingTo("400.00");
        assertThat(accountRepository.findById(targetAccount.getId()).orElseThrow().getBalance()).isEqualByComparingTo("200.00");
    }

    private User saveUser(String email, String documentNumber, Role role) {
        return userRepository.save(new User(
                "Jane",
                "Doe",
                email,
                documentNumber,
                "unused",
                role,
                UserStatus.ACTIVE
        ));
    }

    private Account saveAccount(User user, String accountNumber, AccountStatus status, String balance) {
        return accountRepository.save(new Account(
                user,
                accountNumber,
                "main",
                Currency.ARS,
                new BigDecimal(balance),
                status
        ));
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

    private String creditJson(String amount) {
        return """
                {
                  "amount": %s
                }
                """.formatted(amount);
    }
}
