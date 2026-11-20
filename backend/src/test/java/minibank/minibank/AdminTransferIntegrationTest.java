package minibank.minibank;

import minibank.minibank.accounts.entity.Account;
import minibank.minibank.accounts.entity.AccountStatus;
import minibank.minibank.accounts.entity.Currency;
import minibank.minibank.accounts.repository.AccountRepository;
import minibank.minibank.audit.repository.AuditLogRepository;
import minibank.minibank.auth.service.JwtService;
import minibank.minibank.limits.repository.DailyLimitRepository;
import minibank.minibank.movements.repository.MovementRepository;
import minibank.minibank.transfers.entity.Transfer;
import minibank.minibank.transfers.entity.TransferStatus;
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
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.Instant;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ActiveProfiles("test")
@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
class AdminTransferIntegrationTest {

    private final MockMvc mockMvc;
    private final UserRepository userRepository;
    private final AccountRepository accountRepository;
    private final TransferRepository transferRepository;
    private final MovementRepository movementRepository;
    private final DailyLimitRepository dailyLimitRepository;
    private final AuditLogRepository auditLogRepository;
    private final JwtService jwtService;

    @Autowired
    AdminTransferIntegrationTest(
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
    void adminCanListGlobalTransfersWithFilters() throws Exception {
        User admin = saveUser("admin@example.com", "99999999", Role.ADMIN);
        User first = saveUser("first@example.com", "12345678", Role.CUSTOMER);
        User second = saveUser("second@example.com", "87654321", Role.CUSTOMER);
        User third = saveUser("third@example.com", "11223344", Role.CUSTOMER);
        Account firstAccount = saveAccount(first, "111111111111");
        Account secondAccount = saveAccount(second, "222222222222");
        Account thirdAccount = saveAccount(third, "333333333333");
        Transfer visible = saveTransfer(firstAccount, secondAccount, "100.00", TransferStatus.COMPLETED);
        saveTransfer(thirdAccount, secondAccount, "50.00", TransferStatus.PENDING);

        mockMvc.perform(get("/admin/transfers")
                        .header("Authorization", "Bearer " + jwtService.generateToken(admin))
                        .param("status", "COMPLETED")
                        .param("accountId", firstAccount.getId().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(1)))
                .andExpect(jsonPath("$.content[0].id").value(visible.getId().toString()))
                .andExpect(jsonPath("$.content[0].sourceAccountId").value(firstAccount.getId().toString()))
                .andExpect(jsonPath("$.content[0].targetAccountId").value(secondAccount.getId().toString()))
                .andExpect(jsonPath("$.content[0].status").value("COMPLETED"))
                .andExpect(jsonPath("$.totalElements").value(1));
    }

    @Test
    void adminTransfersRequireAdminRole() throws Exception {
        User customer = saveUser("customer@example.com", "12345678", Role.CUSTOMER);

        mockMvc.perform(get("/admin/transfers"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));

        mockMvc.perform(get("/admin/transfers")
                        .header("Authorization", "Bearer " + jwtService.generateToken(customer)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }

    @Test
    void adminTransfersRejectUnsupportedSort() throws Exception {
        User admin = saveUser("admin@example.com", "99999999", Role.ADMIN);

        mockMvc.perform(get("/admin/transfers")
                        .header("Authorization", "Bearer " + jwtService.generateToken(admin))
                        .param("sort", "description,asc"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.message").value("Unsupported transfer sort field"));
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

    private Account saveAccount(User user, String accountNumber) {
        return accountRepository.save(new Account(
                user,
                accountNumber,
                "main",
                Currency.ARS,
                new BigDecimal("0.00"),
                AccountStatus.ACTIVE
        ));
    }

    private Transfer saveTransfer(Account sourceAccount, Account targetAccount, String amount, TransferStatus status) {
        Instant completedAt = status == TransferStatus.COMPLETED ? Instant.now() : null;
        return transferRepository.save(new Transfer(
                sourceAccount,
                targetAccount,
                new BigDecimal(amount),
                sourceAccount.getCurrency(),
                "test transfer",
                status,
                null,
                completedAt
        ));
    }
}
