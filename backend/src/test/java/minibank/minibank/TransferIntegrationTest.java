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
import minibank.minibank.movements.entity.Movement;
import minibank.minibank.movements.entity.MovementType;
import minibank.minibank.movements.repository.MovementRepository;
import minibank.minibank.transfers.entity.Transfer;
import minibank.minibank.transfers.entity.TransferStatus;
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
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ActiveProfiles("test")
@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
class TransferIntegrationTest {

    private final MockMvc mockMvc;
    private final ObjectMapper objectMapper;
    private final UserRepository userRepository;
    private final AuditLogRepository auditLogRepository;
    private final AccountRepository accountRepository;
    private final TransferRepository transferRepository;
    private final MovementRepository movementRepository;
    private final DailyLimitRepository dailyLimitRepository;
    private final JwtService jwtService;

    @Autowired
    TransferIntegrationTest(
            MockMvc mockMvc,
            UserRepository userRepository,
            AuditLogRepository auditLogRepository,
            AccountRepository accountRepository,
            TransferRepository transferRepository,
            MovementRepository movementRepository,
            DailyLimitRepository dailyLimitRepository,
            JwtService jwtService
    ) {
        this.mockMvc = mockMvc;
        this.objectMapper = new ObjectMapper().findAndRegisterModules();
        this.userRepository = userRepository;
        this.auditLogRepository = auditLogRepository;
        this.accountRepository = accountRepository;
        this.transferRepository = transferRepository;
        this.movementRepository = movementRepository;
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
        movementRepository.deleteAll();
        transferRepository.deleteAll();
        dailyLimitRepository.deleteAll();
        accountRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    void listTransfersRequiresAuthentication() throws Exception {
        mockMvc.perform(get("/transfers"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
    }

    @Test
    void getTransferRequiresAuthentication() throws Exception {
        mockMvc.perform(get("/transfers/{id}", UUID.randomUUID()))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
    }

    @Test
    void createTransferRequiresAuthentication() throws Exception {
        mockMvc.perform(post("/transfers")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createTransferJson(UUID.randomUUID(), "111111111111", "100.00")))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
    }

    @Test
    void createTransferCompletesTransferUpdatesBalancesAndCreatesMovements() throws Exception {
        String token = register("user@example.com", "12345678");
        register("target@example.com", "87654321");
        User owner = userRepository.findByEmail("user@example.com").orElseThrow();
        User target = userRepository.findByEmail("target@example.com").orElseThrow();
        Account sourceAccount = saveAccount(owner, "111111111111", Currency.ARS, "source", "500.00");
        Account targetAccount = saveAccount(target, "222222222222", Currency.ARS, "target", "100.00");

        mockMvc.perform(post("/transfers")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createTransferJson(sourceAccount.getId(), "222222222222", "100.00")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.sourceAccountId").value(sourceAccount.getId().toString()))
                .andExpect(jsonPath("$.sourceAccountNumber").value(sourceAccount.getAccountNumber()))
                .andExpect(jsonPath("$.targetAccountId").value(targetAccount.getId().toString()))
                .andExpect(jsonPath("$.targetAccountNumber").value(targetAccount.getAccountNumber()))
                .andExpect(jsonPath("$.amount").value(100.00))
                .andExpect(jsonPath("$.currency").value("ARS"))
                .andExpect(jsonPath("$.description").value("test transfer"))
                .andExpect(jsonPath("$.status").value("COMPLETED"))
                .andExpect(jsonPath("$.failureReason").value(nullValue()))
                .andExpect(jsonPath("$.id", notNullValue()))
                .andExpect(jsonPath("$.createdAt", notNullValue()))
                .andExpect(jsonPath("$.completedAt", notNullValue()));

        List<Transfer> transfers = transferRepository.findAll();
        assertThat(transfers).hasSize(1);
        Transfer transfer = transfers.getFirst();
        assertThat(transfer.getSourceAccount().getId()).isEqualTo(sourceAccount.getId());
        assertThat(transfer.getTargetAccount().getId()).isEqualTo(targetAccount.getId());
        assertThat(transfer.getAmount()).isEqualByComparingTo("100.00");
        assertThat(transfer.getCurrency()).isEqualTo(Currency.ARS);
        assertThat(transfer.getDescription()).isEqualTo("test transfer");
        assertThat(transfer.getStatus()).isEqualTo(TransferStatus.COMPLETED);
        assertThat(transfer.getFailureReason()).isNull();
        assertThat(transfer.getCompletedAt()).isNotNull();
        assertThat(accountRepository.findById(sourceAccount.getId()).orElseThrow().getBalance())
                .isEqualByComparingTo("400.00");
        assertThat(accountRepository.findById(targetAccount.getId()).orElseThrow().getBalance())
                .isEqualByComparingTo("200.00");

        assertThat(movementRepository.findAll())
                .hasSize(2)
                .anySatisfy(movement -> assertMovement(
                        movement,
                        sourceAccount.getId(),
                        transfer.getId(),
                        MovementType.DEBIT,
                        "100.00",
                        "400.00"
                ))
                .anySatisfy(movement -> assertMovement(
                        movement,
                        targetAccount.getId(),
                        transfer.getId(),
                        MovementType.CREDIT,
                        "100.00",
                        "200.00"
                ));
    }

    @Test
    void createTransferRejectsAdminUser() throws Exception {
        String token = createAdminToken("admin@example.com", "99999999");

        mockMvc.perform(post("/transfers")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createTransferJson(UUID.randomUUID(), "111111111111", "100.00")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"))
                .andExpect(jsonPath("$.message").value("Only customers can create transfers"));

        assertThat(transferRepository.findAll()).isEmpty();
    }

    @Test
    void createTransferRejectsForeignSourceAccountAsNotFound() throws Exception {
        String token = register("owner@example.com", "12345678");
        register("second@example.com", "87654321");
        User owner = userRepository.findByEmail("owner@example.com").orElseThrow();
        User second = userRepository.findByEmail("second@example.com").orElseThrow();
        Account foreignSource = saveAccount(second, "111111111111", Currency.ARS, "foreign", "500.00");
        Account target = saveAccount(owner, "222222222222", Currency.ARS, "target", "100.00");

        assertRejectedTransfer(
                token,
                createTransferJson(foreignSource.getId(), target.getAccountNumber(), "100.00"),
                404,
                "NOT_FOUND",
                "Source account not found",
                foreignSource,
                target
        );
    }

    @Test
    void createTransferRejectsMissingSourceAccount() throws Exception {
        String token = register("owner@example.com", "12345678");
        User owner = userRepository.findByEmail("owner@example.com").orElseThrow();
        Account target = saveAccount(owner, "222222222222", Currency.ARS, "target", "100.00");

        assertRejectedTransfer(
                token,
                createTransferJson(UUID.randomUUID(), target.getAccountNumber(), "100.00"),
                404,
                "NOT_FOUND",
                "Source account not found",
                target
        );
    }

    @Test
    void createTransferRejectsMissingTargetAccount() throws Exception {
        String token = register("owner@example.com", "12345678");
        User owner = userRepository.findByEmail("owner@example.com").orElseThrow();
        Account source = saveAccount(owner, "111111111111", Currency.ARS, "source", "500.00");

        assertRejectedTransfer(
                token,
                createTransferJson(source.getId(), "999999999999", "100.00"),
                404,
                "TRANSFER_INVALID_TARGET",
                "Target account not found",
                source
        );
    }

    @Test
    void createTransferRejectsSameSourceAndTargetAccount() throws Exception {
        String token = register("owner@example.com", "12345678");
        User owner = userRepository.findByEmail("owner@example.com").orElseThrow();
        Account source = saveAccount(owner, "111111111111", Currency.ARS, "source", "500.00");

        assertRejectedTransfer(
                token,
                createTransferJson(source.getId(), source.getAccountNumber(), "100.00"),
                422,
                "TRANSFER_SAME_ACCOUNT",
                "Source and target accounts must be different",
                source
        );
    }

    @Test
    void createTransferRejectsInactiveSourceAccount() throws Exception {
        String token = register("owner@example.com", "12345678");
        register("target@example.com", "87654321");
        User owner = userRepository.findByEmail("owner@example.com").orElseThrow();
        User targetUser = userRepository.findByEmail("target@example.com").orElseThrow();
        Account source = saveAccount(owner, "111111111111", Currency.ARS, "source", "500.00", AccountStatus.BLOCKED);
        Account target = saveAccount(targetUser, "222222222222", Currency.ARS, "target", "100.00");

        assertRejectedTransfer(
                token,
                createTransferJson(source.getId(), target.getAccountNumber(), "100.00"),
                422,
                "TRANSFER_SOURCE_INACTIVE",
                "Source account is not active",
                source,
                target
        );
    }

    @Test
    void createTransferRejectsInactiveTargetAccount() throws Exception {
        String token = register("owner@example.com", "12345678");
        register("target@example.com", "87654321");
        User owner = userRepository.findByEmail("owner@example.com").orElseThrow();
        User targetUser = userRepository.findByEmail("target@example.com").orElseThrow();
        Account source = saveAccount(owner, "111111111111", Currency.ARS, "source", "500.00");
        Account target = saveAccount(targetUser, "222222222222", Currency.ARS, "target", "100.00", AccountStatus.BLOCKED);

        assertRejectedTransfer(
                token,
                createTransferJson(source.getId(), target.getAccountNumber(), "100.00"),
                404,
                "TRANSFER_INVALID_TARGET",
                "Target account not found",
                source,
                target
        );
    }

    @Test
    void createTransferRejectsZeroOrNegativeAmount() throws Exception {
        String token = register("owner@example.com", "12345678");
        register("target@example.com", "87654321");
        User owner = userRepository.findByEmail("owner@example.com").orElseThrow();
        User targetUser = userRepository.findByEmail("target@example.com").orElseThrow();
        Account source = saveAccount(owner, "111111111111", Currency.ARS, "source", "500.00");
        Account target = saveAccount(targetUser, "222222222222", Currency.ARS, "target", "100.00");

        assertRejectedTransfer(
                token,
                createTransferJson(source.getId(), target.getAccountNumber(), "0.00"),
                400,
                "VALIDATION_ERROR",
                "Request validation failed",
                source,
                target
        );
        assertRejectedTransfer(
                token,
                createTransferJson(source.getId(), target.getAccountNumber(), "-1.00"),
                400,
                "VALIDATION_ERROR",
                "Request validation failed",
                source,
                target
        );
    }

    @Test
    void createTransferRejectsDifferentCurrencies() throws Exception {
        String token = register("owner@example.com", "12345678");
        register("target@example.com", "87654321");
        User owner = userRepository.findByEmail("owner@example.com").orElseThrow();
        User targetUser = userRepository.findByEmail("target@example.com").orElseThrow();
        Account source = saveAccount(owner, "111111111111", Currency.ARS, "source", "500.00");
        Account target = saveAccount(targetUser, "222222222222", Currency.USD, "target", "100.00");

        assertRejectedTransfer(
                token,
                createTransferJson(source.getId(), target.getAccountNumber(), "100.00"),
                404,
                "TRANSFER_INVALID_TARGET",
                "Target account not found",
                source,
                target
        );
    }

    @Test
    void createTransferRejectsInsufficientFunds() throws Exception {
        String token = register("owner@example.com", "12345678");
        register("target@example.com", "87654321");
        User owner = userRepository.findByEmail("owner@example.com").orElseThrow();
        User targetUser = userRepository.findByEmail("target@example.com").orElseThrow();
        Account source = saveAccount(owner, "111111111111", Currency.ARS, "source", "50.00");
        Account target = saveAccount(targetUser, "222222222222", Currency.ARS, "target", "100.00");

        assertRejectedTransfer(
                token,
                createTransferJson(source.getId(), target.getAccountNumber(), "100.00"),
                422,
                "TRANSFER_INSUFFICIENT_FUNDS",
                "Insufficient funds",
                source,
                target
        );
    }

    @Test
    void createTransferRejectsExceededDailyLimitWithoutChangingBalances() throws Exception {
        String token = register("owner@example.com", "12345678");
        register("target@example.com", "87654321");
        User owner = userRepository.findByEmail("owner@example.com").orElseThrow();
        User targetUser = userRepository.findByEmail("target@example.com").orElseThrow();
        Account source = saveAccount(owner, "111111111111", Currency.ARS, "source", "500.00");
        Account target = saveAccount(targetUser, "222222222222", Currency.ARS, "target", "100.00");
        dailyLimitRepository.save(new DailyLimit(source, new BigDecimal("50.00")));

        assertRejectedTransfer(
                token,
                createTransferJson(source.getId(), target.getAccountNumber(), "100.00"),
                422,
                "DAILY_LIMIT_EXCEEDED",
                "Daily transfer limit exceeded",
                source,
                target
        );
    }

    @Test
    void createTransferRejectsAccumulatedDailyLimitWithoutChangingBalances() throws Exception {
        String token = register("owner@example.com", "12345678");
        register("target@example.com", "87654321");
        User owner = userRepository.findByEmail("owner@example.com").orElseThrow();
        User targetUser = userRepository.findByEmail("target@example.com").orElseThrow();
        Account source = saveAccount(owner, "111111111111", Currency.ARS, "source", "500.00");
        Account target = saveAccount(targetUser, "222222222222", Currency.ARS, "target", "100.00");
        dailyLimitRepository.save(new DailyLimit(source, new BigDecimal("100.00")));
        Transfer existingTransfer = saveTransfer(source, target, "40.00", TransferStatus.COMPLETED, null);
        BigDecimal sourceBalance = source.getBalance();
        BigDecimal targetBalance = target.getBalance();

        mockMvc.perform(post("/transfers")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createTransferJson(source.getId(), target.getAccountNumber(), "70.00")))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("DAILY_LIMIT_EXCEEDED"))
                .andExpect(jsonPath("$.message").value("Daily transfer limit exceeded"));

        assertThat(transferRepository.findAll())
                .hasSize(1)
                .first()
                .extracting(Transfer::getId)
                .isEqualTo(existingTransfer.getId());
        assertThat(movementRepository.findAll()).isEmpty();
        assertThat(accountRepository.findById(source.getId()).orElseThrow().getBalance())
                .isEqualByComparingTo(sourceBalance);
        assertThat(accountRepository.findById(target.getId()).orElseThrow().getBalance())
                .isEqualByComparingTo(targetBalance);
    }

    @Test
    void listTransfersReturnsEmptyPageWhenUserHasNoTransfers() throws Exception {
        String token = register("user@example.com", "12345678");

        mockMvc.perform(get("/transfers")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(0)))
                .andExpect(jsonPath("$.totalElements").value(0));
    }

    @Test
    void listTransfersReturnsOwnSourceAndTargetTransfersOnly() throws Exception {
        String token = register("owner@example.com", "12345678");
        register("second@example.com", "87654321");
        register("third@example.com", "11223344");
        User owner = userRepository.findByEmail("owner@example.com").orElseThrow();
        User second = userRepository.findByEmail("second@example.com").orElseThrow();
        User third = userRepository.findByEmail("third@example.com").orElseThrow();
        Account ownerAccount = saveAccount(owner, "111111111111", Currency.ARS, "owner", "500.00");
        Account secondAccount = saveAccount(second, "222222222222", Currency.ARS, "second", "200.00");
        Account thirdAccount = saveAccount(third, "333333333333", Currency.ARS, "third");
        Transfer outgoing = saveTransfer(ownerAccount, secondAccount, "100.00", TransferStatus.COMPLETED, null);
        Transfer incoming = saveTransfer(secondAccount, ownerAccount, "50.00", TransferStatus.PENDING, null);
        saveTransfer(secondAccount, thirdAccount, "75.00", TransferStatus.COMPLETED, null);

        mockMvc.perform(get("/transfers")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(2)))
                .andExpect(jsonPath("$.content[?(@.id == '%s')]".formatted(outgoing.getId()), hasSize(1)))
                .andExpect(jsonPath("$.content[?(@.id == '%s')]".formatted(incoming.getId()), hasSize(1)))
                .andExpect(jsonPath("$.totalElements").value(2));

        assertThat(accountRepository.findById(ownerAccount.getId()).orElseThrow().getBalance())
                .isEqualByComparingTo("500.00");
        assertThat(accountRepository.findById(secondAccount.getId()).orElseThrow().getBalance())
                .isEqualByComparingTo("200.00");
    }

    @Test
    void getTransferReturnsOwnTransfer() throws Exception {
        String token = register("owner@example.com", "12345678");
        register("target@example.com", "87654321");
        User owner = userRepository.findByEmail("owner@example.com").orElseThrow();
        User target = userRepository.findByEmail("target@example.com").orElseThrow();
        Account sourceAccount = saveAccount(owner, "111111111111", Currency.ARS, "source");
        Account targetAccount = saveAccount(target, "222222222222", Currency.ARS, "target");
        Transfer transfer = saveTransfer(sourceAccount, targetAccount, "100.00", TransferStatus.COMPLETED, null);

        mockMvc.perform(get("/transfers/{id}", transfer.getId())
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(transfer.getId().toString()))
                .andExpect(jsonPath("$.sourceAccountId").value(sourceAccount.getId().toString()))
                .andExpect(jsonPath("$.sourceAccountNumber").value("111111111111"))
                .andExpect(jsonPath("$.targetAccountId").value(targetAccount.getId().toString()))
                .andExpect(jsonPath("$.targetAccountNumber").value("222222222222"))
                .andExpect(jsonPath("$.amount").value(100.00))
                .andExpect(jsonPath("$.currency").value("ARS"))
                .andExpect(jsonPath("$.description").value("test transfer"))
                .andExpect(jsonPath("$.status").value("COMPLETED"))
                .andExpect(jsonPath("$.createdAt", notNullValue()));
    }

    @Test
    void getTransferRejectsForeignTransferAsNotFound() throws Exception {
        String token = register("owner@example.com", "12345678");
        register("second@example.com", "87654321");
        register("third@example.com", "11223344");
        User second = userRepository.findByEmail("second@example.com").orElseThrow();
        User third = userRepository.findByEmail("third@example.com").orElseThrow();
        Account secondAccount = saveAccount(second, "222222222222", Currency.ARS, "second");
        Account thirdAccount = saveAccount(third, "333333333333", Currency.ARS, "third");
        Transfer foreignTransfer = saveTransfer(secondAccount, thirdAccount, "75.00", TransferStatus.COMPLETED, null);

        mockMvc.perform(get("/transfers/{id}", foreignTransfer.getId())
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"))
                .andExpect(jsonPath("$.message").value("Transfer not found"));
    }

    @Test
    void getTransferRejectsMissingTransferAsNotFound() throws Exception {
        String token = register("owner@example.com", "12345678");

        mockMvc.perform(get("/transfers/{id}", UUID.randomUUID())
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"))
                .andExpect(jsonPath("$.message").value("Transfer not found"));
    }

    @Test
    void listTransfersFiltersByStatus() throws Exception {
        String token = register("owner@example.com", "12345678");
        register("target@example.com", "87654321");
        User owner = userRepository.findByEmail("owner@example.com").orElseThrow();
        User target = userRepository.findByEmail("target@example.com").orElseThrow();
        Account sourceAccount = saveAccount(owner, "111111111111", Currency.ARS, "source");
        Account targetAccount = saveAccount(target, "222222222222", Currency.ARS, "target");
        Transfer completed = saveTransfer(sourceAccount, targetAccount, "100.00", TransferStatus.COMPLETED, null);
        saveTransfer(sourceAccount, targetAccount, "50.00", TransferStatus.PENDING, null);

        mockMvc.perform(get("/transfers")
                        .queryParam("status", "COMPLETED")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(1)))
                .andExpect(jsonPath("$.content[0].id").value(completed.getId().toString()))
                .andExpect(jsonPath("$.content[0].status").value("COMPLETED"));
    }

    @Test
    void listTransfersFiltersByAccountId() throws Exception {
        String token = register("owner@example.com", "12345678");
        register("target@example.com", "87654321");
        User owner = userRepository.findByEmail("owner@example.com").orElseThrow();
        User target = userRepository.findByEmail("target@example.com").orElseThrow();
        Account firstAccount = saveAccount(owner, "111111111111", Currency.ARS, "first");
        Account secondAccount = saveAccount(owner, "222222222222", Currency.ARS, "second");
        Account targetAccount = saveAccount(target, "333333333333", Currency.ARS, "target");
        Transfer firstTransfer = saveTransfer(firstAccount, targetAccount, "100.00", TransferStatus.COMPLETED, null);
        saveTransfer(secondAccount, targetAccount, "50.00", TransferStatus.COMPLETED, null);

        mockMvc.perform(get("/transfers")
                        .queryParam("accountId", firstAccount.getId().toString())
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(1)))
                .andExpect(jsonPath("$.content[0].id").value(firstTransfer.getId().toString()));
    }

    @Test
    void listTransfersFiltersByDateRange() throws Exception {
        String token = register("owner@example.com", "12345678");
        register("target@example.com", "87654321");
        User owner = userRepository.findByEmail("owner@example.com").orElseThrow();
        User target = userRepository.findByEmail("target@example.com").orElseThrow();
        Account sourceAccount = saveAccount(owner, "111111111111", Currency.ARS, "source");
        Account targetAccount = saveAccount(target, "222222222222", Currency.ARS, "target");
        saveTransfer(sourceAccount, targetAccount, "100.00", TransferStatus.COMPLETED, null);

        mockMvc.perform(get("/transfers")
                        .queryParam("from", "1970-01-01T00:00:00Z")
                        .queryParam("to", "1970-01-01T00:00:01Z")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(0)))
                .andExpect(jsonPath("$.totalElements").value(0));
    }

    @Test
    void listTransfersPaginatesResults() throws Exception {
        String token = register("owner@example.com", "12345678");
        register("target@example.com", "87654321");
        User owner = userRepository.findByEmail("owner@example.com").orElseThrow();
        User target = userRepository.findByEmail("target@example.com").orElseThrow();
        Account sourceAccount = saveAccount(owner, "111111111111", Currency.ARS, "source");
        Account targetAccount = saveAccount(target, "222222222222", Currency.ARS, "target");
        saveTransfer(sourceAccount, targetAccount, "100.00", TransferStatus.COMPLETED, null);
        saveTransfer(sourceAccount, targetAccount, "50.00", TransferStatus.PENDING, null);

        mockMvc.perform(get("/transfers")
                        .queryParam("page", "0")
                        .queryParam("size", "1")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(1)))
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.totalPages").value(2))
                .andExpect(jsonPath("$.size").value(1));
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
        return saveAccount(user, accountNumber, currency, alias, "0.00");
    }

    private Account saveAccount(User user, String accountNumber, Currency currency, String alias, String balance) {
        return saveAccount(user, accountNumber, currency, alias, balance, AccountStatus.ACTIVE);
    }

    private Account saveAccount(
            User user,
            String accountNumber,
            Currency currency,
            String alias,
            String balance,
            AccountStatus status
    ) {
        return accountRepository.save(new Account(
                user,
                accountNumber,
                alias,
                currency,
                new BigDecimal(balance),
                status
        ));
    }

    private void assertRejectedTransfer(
            String token,
            String requestJson,
            int expectedStatus,
            String expectedCode,
            String expectedMessage,
            Account... unchangedAccounts
    ) throws Exception {
        BigDecimal[] balances = new BigDecimal[unchangedAccounts.length];
        for (int i = 0; i < unchangedAccounts.length; i++) {
            balances[i] = unchangedAccounts[i].getBalance();
        }

        mockMvc.perform(post("/transfers")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestJson))
                .andExpect(status().is(expectedStatus))
                .andExpect(jsonPath("$.code").value(expectedCode))
                .andExpect(jsonPath("$.message").value(expectedMessage));

        assertThat(transferRepository.findAll()).isEmpty();
        assertThat(movementRepository.findAll()).isEmpty();
        for (int i = 0; i < unchangedAccounts.length; i++) {
            assertThat(accountRepository.findById(unchangedAccounts[i].getId()).orElseThrow().getBalance())
                    .isEqualByComparingTo(balances[i]);
        }
    }

    private void assertMovement(
            Movement movement,
            UUID accountId,
            UUID transferId,
            MovementType type,
            String amount,
            String balanceAfter
    ) {
        assertThat(movement.getAccount().getId()).isEqualTo(accountId);
        assertThat(movement.getTransfer().getId()).isEqualTo(transferId);
        assertThat(movement.getType()).isEqualTo(type);
        assertThat(movement.getAmount()).isEqualByComparingTo(amount);
        assertThat(movement.getBalanceAfter()).isEqualByComparingTo(balanceAfter);
        assertThat(movement.getDescription()).isEqualTo("test transfer");
        assertThat(movement.getCreatedAt()).isNotNull();
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

    private Transfer saveTransfer(
            Account sourceAccount,
            Account targetAccount,
            String amount,
            TransferStatus status,
            String failureReason
    ) {
        Instant completedAt = status == TransferStatus.COMPLETED ? Instant.now() : null;
        return transferRepository.save(new Transfer(
                sourceAccount,
                targetAccount,
                new BigDecimal(amount),
                sourceAccount.getCurrency(),
                "test transfer",
                status,
                failureReason,
                completedAt
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
