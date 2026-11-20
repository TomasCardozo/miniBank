package minibank.minibank;

import minibank.minibank.accounts.repository.AccountRepository;
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
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ActiveProfiles("test")
@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
class SystemActuatorIntegrationTest {

    private final MockMvc mockMvc;
    private final UserRepository userRepository;
    private final AccountRepository accountRepository;
    private final TransferRepository transferRepository;
    private final MovementRepository movementRepository;
    private final DailyLimitRepository dailyLimitRepository;
    private final AuditLogRepository auditLogRepository;
    private final JwtService jwtService;

    @Autowired
    SystemActuatorIntegrationTest(
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
    void healthShowsOnlyTheOverallStatusToAnonymousAndCustomers() throws Exception {
        User customer = saveUser("customer@example.com", "12345678", Role.CUSTOMER);

        mockMvc.perform(get("/actuator/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"))
                .andExpect(jsonPath("$.components").doesNotExist());

        mockMvc.perform(get("/actuator/health")
                        .header("Authorization", "Bearer " + jwtService.generateToken(customer)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"))
                .andExpect(jsonPath("$.components").doesNotExist());
    }

    @Test
    void healthShowsComponentDetailsToAdmins() throws Exception {
        User admin = saveUser("admin@example.com", "99999999", Role.ADMIN);

        mockMvc.perform(get("/actuator/health")
                        .header("Authorization", "Bearer " + jwtService.generateToken(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"))
                .andExpect(jsonPath("$.components.db.status").value("UP"))
                .andExpect(jsonPath("$.components.db.details.database").value("PostgreSQL"));
    }

    @Test
    void flywayMigrationsAreOnlyVisibleToAdmins() throws Exception {
        User customer = saveUser("customer@example.com", "12345678", Role.CUSTOMER);
        User admin = saveUser("admin@example.com", "99999999", Role.ADMIN);

        mockMvc.perform(get("/actuator/flyway"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/actuator/flyway")
                        .header("Authorization", "Bearer " + jwtService.generateToken(customer)))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/actuator/flyway")
                        .header("Authorization", "Bearer " + jwtService.generateToken(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.contexts.*.flywayBeans.flyway.migrations[*].version", hasItem("1")))
                .andExpect(jsonPath("$.contexts.*.flywayBeans.flyway.migrations[*].state", not(hasItem("FAILED"))));
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
}
