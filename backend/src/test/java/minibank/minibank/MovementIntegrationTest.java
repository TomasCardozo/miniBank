package minibank.minibank;

import com.fasterxml.jackson.databind.ObjectMapper;
import minibank.minibank.accounts.entity.Account;
import minibank.minibank.accounts.entity.AccountStatus;
import minibank.minibank.accounts.entity.Currency;
import minibank.minibank.accounts.repository.AccountRepository;
import minibank.minibank.audit.repository.AuditLogRepository;
import minibank.minibank.movements.entity.Movement;
import minibank.minibank.movements.entity.MovementType;
import minibank.minibank.movements.repository.MovementRepository;
import minibank.minibank.transfers.entity.Transfer;
import minibank.minibank.transfers.entity.TransferStatus;
import minibank.minibank.transfers.repository.TransferRepository;
import minibank.minibank.users.entity.User;
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
import java.time.Instant;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ActiveProfiles("test")
@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
class MovementIntegrationTest {

    private final MockMvc mockMvc;
    private final ObjectMapper objectMapper;
    private final UserRepository userRepository;
    private final AuditLogRepository auditLogRepository;
    private final AccountRepository accountRepository;
    private final TransferRepository transferRepository;
    private final MovementRepository movementRepository;

    @Autowired
    MovementIntegrationTest(
            MockMvc mockMvc,
            UserRepository userRepository,
            AuditLogRepository auditLogRepository,
            AccountRepository accountRepository,
            TransferRepository transferRepository,
            MovementRepository movementRepository
    ) {
        this.mockMvc = mockMvc;
        this.objectMapper = new ObjectMapper().findAndRegisterModules();
        this.userRepository = userRepository;
        this.auditLogRepository = auditLogRepository;
        this.accountRepository = accountRepository;
        this.transferRepository = transferRepository;
        this.movementRepository = movementRepository;
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
        accountRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    void listMovementsRequiresAuthentication() throws Exception {
        Account account = saveAccount(registerUser("owner@example.com", "12345678"), "111111111111", Currency.ARS);

        mockMvc.perform(get("/accounts/{accountId}/movements", account.getId()))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
    }

    @Test
    void listMovementsReturnsEmptyPageWhenAccountHasNoMovements() throws Exception {
        String token = register("owner@example.com", "12345678");
        User owner = userRepository.findByEmail("owner@example.com").orElseThrow();
        Account account = saveAccount(owner, "111111111111", Currency.ARS);

        mockMvc.perform(get("/accounts/{accountId}/movements", account.getId())
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(0)))
                .andExpect(jsonPath("$.totalElements").value(0));
    }

    @Test
    void listMovementsReturnsOnlySelectedOwnAccountMovements() throws Exception {
        String token = register("owner@example.com", "12345678");
        register("target@example.com", "87654321");
        User owner = userRepository.findByEmail("owner@example.com").orElseThrow();
        User target = userRepository.findByEmail("target@example.com").orElseThrow();
        Account firstAccount = saveAccount(owner, "111111111111", Currency.ARS);
        Account secondAccount = saveAccount(owner, "222222222222", Currency.ARS);
        Account targetAccount = saveAccount(target, "333333333333", Currency.ARS);
        Transfer transfer = saveTransfer(firstAccount, targetAccount, "100.00");
        Transfer secondTransfer = saveTransfer(secondAccount, targetAccount, "50.00");
        Movement debit = saveMovement(firstAccount, transfer, MovementType.DEBIT, "100.00", "400.00");
        saveMovement(secondAccount, secondTransfer, MovementType.DEBIT, "50.00", "150.00");

        mockMvc.perform(get("/accounts/{accountId}/movements", firstAccount.getId())
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(1)))
                .andExpect(jsonPath("$.content[0].id").value(debit.getId().toString()))
                .andExpect(jsonPath("$.content[0].accountId").value(firstAccount.getId().toString()))
                .andExpect(jsonPath("$.content[0].accountNumber").value("111111111111"))
                .andExpect(jsonPath("$.content[0].transferId").value(transfer.getId().toString()))
                .andExpect(jsonPath("$.content[0].type").value("DEBIT"))
                .andExpect(jsonPath("$.content[0].amount").value(100.00))
                .andExpect(jsonPath("$.content[0].balanceAfter").value(400.00))
                .andExpect(jsonPath("$.content[0].description").value("test movement"))
                .andExpect(jsonPath("$.totalElements").value(1));
    }

    @Test
    void listMovementsRejectsForeignAccountAsNotFound() throws Exception {
        String token = register("owner@example.com", "12345678");
        register("foreign@example.com", "87654321");
        User foreign = userRepository.findByEmail("foreign@example.com").orElseThrow();
        Account foreignAccount = saveAccount(foreign, "222222222222", Currency.ARS);

        mockMvc.perform(get("/accounts/{accountId}/movements", foreignAccount.getId())
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"))
                .andExpect(jsonPath("$.message").value("Account not found"));
    }

    @Test
    void listMovementsFiltersByType() throws Exception {
        String token = register("owner@example.com", "12345678");
        register("target@example.com", "87654321");
        User owner = userRepository.findByEmail("owner@example.com").orElseThrow();
        User target = userRepository.findByEmail("target@example.com").orElseThrow();
        Account account = saveAccount(owner, "111111111111", Currency.ARS);
        Account targetAccount = saveAccount(target, "222222222222", Currency.ARS);
        Transfer transfer = saveTransfer(account, targetAccount, "100.00");
        Movement credit = saveMovement(account, transfer, MovementType.CREDIT, "25.00", "525.00");
        saveMovement(account, transfer, MovementType.DEBIT, "100.00", "400.00");

        mockMvc.perform(get("/accounts/{accountId}/movements", account.getId())
                        .queryParam("type", "CREDIT")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(1)))
                .andExpect(jsonPath("$.content[0].id").value(credit.getId().toString()))
                .andExpect(jsonPath("$.content[0].type").value("CREDIT"));
    }

    @Test
    void listMovementsFiltersByDateRange() throws Exception {
        String token = register("owner@example.com", "12345678");
        register("target@example.com", "87654321");
        User owner = userRepository.findByEmail("owner@example.com").orElseThrow();
        User target = userRepository.findByEmail("target@example.com").orElseThrow();
        Account account = saveAccount(owner, "111111111111", Currency.ARS);
        Account targetAccount = saveAccount(target, "222222222222", Currency.ARS);
        Transfer transfer = saveTransfer(account, targetAccount, "100.00");
        saveMovement(account, transfer, MovementType.DEBIT, "100.00", "400.00");

        mockMvc.perform(get("/accounts/{accountId}/movements", account.getId())
                        .queryParam("from", Instant.now().plusSeconds(60).toString())
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(0)))
                .andExpect(jsonPath("$.totalElements").value(0));
    }

    @Test
    void listMovementsRejectsInvalidDateRange() throws Exception {
        String token = register("owner@example.com", "12345678");
        User owner = userRepository.findByEmail("owner@example.com").orElseThrow();
        Account account = saveAccount(owner, "111111111111", Currency.ARS);

        mockMvc.perform(get("/accounts/{accountId}/movements", account.getId())
                        .queryParam("from", "2026-01-02T00:00:00Z")
                        .queryParam("to", "2026-01-01T00:00:00Z")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.message").value("from must be before or equal to to"));
    }

    @Test
    void listMovementsPaginatesResults() throws Exception {
        String token = register("owner@example.com", "12345678");
        register("target@example.com", "87654321");
        User owner = userRepository.findByEmail("owner@example.com").orElseThrow();
        User target = userRepository.findByEmail("target@example.com").orElseThrow();
        Account account = saveAccount(owner, "111111111111", Currency.ARS);
        Account targetAccount = saveAccount(target, "222222222222", Currency.ARS);
        Transfer transfer = saveTransfer(account, targetAccount, "100.00");
        saveMovement(account, transfer, MovementType.DEBIT, "100.00", "400.00");
        saveMovement(account, transfer, MovementType.CREDIT, "50.00", "450.00");

        mockMvc.perform(get("/accounts/{accountId}/movements", account.getId())
                        .queryParam("page", "0")
                        .queryParam("size", "1")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(1)))
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.totalPages").value(2))
                .andExpect(jsonPath("$.size").value(1));
    }

    @Test
    void listMovementsRejectsUnsupportedSortField() throws Exception {
        String token = register("owner@example.com", "12345678");
        User owner = userRepository.findByEmail("owner@example.com").orElseThrow();
        Account account = saveAccount(owner, "111111111111", Currency.ARS);

        mockMvc.perform(get("/accounts/{accountId}/movements", account.getId())
                        .queryParam("sort", "account.user.email,asc")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.message").value("Unsupported movement sort field"));
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

    private User registerUser(String email, String documentNumber) throws Exception {
        register(email, documentNumber);
        return userRepository.findByEmail(email).orElseThrow();
    }

    private Account saveAccount(User user, String accountNumber, Currency currency) {
        return accountRepository.save(new Account(
                user,
                accountNumber,
                "test account",
                currency,
                new BigDecimal("500.00"),
                AccountStatus.ACTIVE
        ));
    }

    private Transfer saveTransfer(Account sourceAccount, Account targetAccount, String amount) {
        return transferRepository.save(new Transfer(
                sourceAccount,
                targetAccount,
                new BigDecimal(amount),
                sourceAccount.getCurrency(),
                "test transfer",
                TransferStatus.COMPLETED,
                null,
                Instant.now()
        ));
    }

    private Movement saveMovement(
            Account account,
            Transfer transfer,
            MovementType type,
            String amount,
            String balanceAfter
    ) {
        return movementRepository.save(new Movement(
                account,
                transfer,
                type,
                new BigDecimal(amount),
                new BigDecimal(balanceAfter),
                "test movement"
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
}
