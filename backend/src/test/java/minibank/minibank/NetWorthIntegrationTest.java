package minibank.minibank;

import minibank.minibank.accounts.entity.Account;
import minibank.minibank.accounts.entity.AccountStatus;
import minibank.minibank.accounts.entity.Currency;
import minibank.minibank.accounts.repository.AccountRepository;
import minibank.minibank.auth.service.JwtService;
import minibank.minibank.movements.service.NetWorthService;
import minibank.minibank.support.DatabaseCleaner;
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
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ActiveProfiles("test")
@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
class NetWorthIntegrationTest {

    private static final String HISTORY = "/me/net-worth/history";

    private final MockMvc mockMvc;
    private final UserRepository userRepository;
    private final AccountRepository accountRepository;
    private final JwtService jwtService;
    private final JdbcTemplate jdbcTemplate;
    private final DatabaseCleaner databaseCleaner;

    private User owner;
    private String ownerToken;
    private Account ownArs;
    private Account ownSecondArs;
    private Account ownUsd;
    private Account foreignArs;

    @Autowired
    NetWorthIntegrationTest(
            MockMvc mockMvc,
            UserRepository userRepository,
            AccountRepository accountRepository,
            JwtService jwtService,
            JdbcTemplate jdbcTemplate
    ) {
        this.mockMvc = mockMvc;
        this.userRepository = userRepository;
        this.accountRepository = accountRepository;
        this.jwtService = jwtService;
        this.jdbcTemplate = jdbcTemplate;
        this.databaseCleaner = new DatabaseCleaner(jdbcTemplate);
    }

    @BeforeEach
    void setUp() {
        databaseCleaner.clean();
    }

    @AfterEach
    void tearDown() {
        databaseCleaner.clean();
    }

    @Test
    void historyRequiresAuthentication() throws Exception {
        mockMvc.perform(get(HISTORY))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
    }

    @Test
    void historyRebuildsDailyBalancesAndExternalFlowsPerCurrency() throws Exception {
        givenScenario();

        mockMvc.perform(get(HISTORY)
                        .header("Authorization", "Bearer " + ownerToken)
                        .param("from", "2026-10-01")
                        .param("to", "2026-10-05"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.from").value("2026-10-01"))
                .andExpect(jsonPath("$.to").value("2026-10-05"))
                .andExpect(jsonPath("$.timezone").value("America/Argentina/Buenos_Aires"))
                .andExpect(jsonPath("$.series", hasSize(2)))
                .andExpect(jsonPath("$.series[0].currency").value("ARS"))
                .andExpect(jsonPath("$.series[0].openingBalance").value(0.00))
                .andExpect(jsonPath("$.series[0].points", hasSize(5)))
                .andExpect(jsonPath("$.series[0].points[0].date").value("2026-10-01"))
                .andExpect(jsonPath("$.series[0].points[0].closingBalance").value(1000.00))
                .andExpect(jsonPath("$.series[0].points[0].externalInflow").value(1000.00))
                .andExpect(jsonPath("$.series[0].points[0].externalOutflow").value(0.00))
                .andExpect(jsonPath("$.series[0].points[1].closingBalance").value(1000.00))
                .andExpect(jsonPath("$.series[0].points[1].externalInflow").value(0.00))
                .andExpect(jsonPath("$.series[0].points[1].externalOutflow").value(0.00))
                .andExpect(jsonPath("$.series[0].points[2].closingBalance").value(800.00))
                .andExpect(jsonPath("$.series[0].points[2].externalOutflow").value(200.00))
                .andExpect(jsonPath("$.series[0].points[3].closingBalance").value(850.00))
                .andExpect(jsonPath("$.series[0].points[3].externalInflow").value(50.00))
                .andExpect(jsonPath("$.series[0].points[4].date").value("2026-10-05"))
                .andExpect(jsonPath("$.series[0].points[4].closingBalance").value(860.00))
                .andExpect(jsonPath("$.series[0].points[4].externalInflow").value(10.00))
                .andExpect(jsonPath("$.series[1].currency").value("USD"))
                .andExpect(jsonPath("$.series[1].openingBalance").value(0.00))
                .andExpect(jsonPath("$.series[1].points[2].closingBalance").value(0.00))
                .andExpect(jsonPath("$.series[1].points[3].closingBalance").value(100.00))
                .andExpect(jsonPath("$.series[1].points[3].externalInflow").value(100.00))
                .andExpect(jsonPath("$.series[1].points[4].closingBalance").value(100.00));
    }

    @Test
    void historyOpeningBalanceReflectsMovementsBeforeRange() throws Exception {
        givenScenario();

        mockMvc.perform(get(HISTORY)
                        .header("Authorization", "Bearer " + ownerToken)
                        .param("from", "2026-10-03")
                        .param("to", "2026-10-03"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.series[0].openingBalance").value(1000.00))
                .andExpect(jsonPath("$.series[0].points", hasSize(1)))
                .andExpect(jsonPath("$.series[0].points[0].closingBalance").value(800.00));
    }

    @Test
    void historyLastPointMatchesCurrentBalances() throws Exception {
        givenScenario();

        mockMvc.perform(get(HISTORY)
                        .header("Authorization", "Bearer " + ownerToken)
                        .param("from", "2026-10-01")
                        .param("to", "2026-10-12"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.series[0].points[11].date").value("2026-10-12"))
                .andExpect(jsonPath("$.series[0].points[11].closingBalance").value(885.00))
                .andExpect(jsonPath("$.series[1].points[11].closingBalance").value(100.00));
    }

    @Test
    void historyOnlyIncludesOwnAccounts() throws Exception {
        givenScenario();
        User foreignOwner = userRepository.findById(foreignArs.getUser().getId()).orElseThrow();

        mockMvc.perform(get(HISTORY)
                        .header("Authorization", "Bearer " + jwtService.generateToken(foreignOwner))
                        .param("from", "2026-10-01")
                        .param("to", "2026-10-12"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.series[0].openingBalance").value(5000.00))
                .andExpect(jsonPath("$.series[0].points[2].externalInflow").value(200.00))
                .andExpect(jsonPath("$.series[0].points[11].closingBalance").value(5115.00))
                .andExpect(jsonPath("$.series[1].points[11].closingBalance").value(0.00));
    }

    @Test
    void historyDefaultsToLast90DaysInBuenosAires() throws Exception {
        String token = jwtService.generateToken(saveUser("solo@example.com", "11111111"));
        LocalDate today = LocalDate.now(NetWorthService.ZONE);

        mockMvc.perform(get(HISTORY).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.to").value(today.toString()))
                .andExpect(jsonPath("$.from").value(today.minusDays(89).toString()))
                .andExpect(jsonPath("$.series[0].points", hasSize(90)))
                .andExpect(jsonPath("$.series[0].points[89].closingBalance").value(0.00));
    }

    @Test
    void historyRejectsInvalidRanges() throws Exception {
        String token = jwtService.generateToken(saveUser("solo@example.com", "11111111"));

        mockMvc.perform(get(HISTORY)
                        .header("Authorization", "Bearer " + token)
                        .param("from", "2026-10-05")
                        .param("to", "2026-10-01"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));

        mockMvc.perform(get(HISTORY)
                        .header("Authorization", "Bearer " + token)
                        .param("from", "2024-12-31")
                        .param("to", "2026-01-01"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));

        mockMvc.perform(get(HISTORY)
                        .header("Authorization", "Bearer " + token)
                        .param("from", "not-a-date"))
                .andExpect(status().isBadRequest());
    }

    private void givenScenario() {
        owner = saveUser("owner@example.com", "12345678");
        ownerToken = jwtService.generateToken(owner);
        User foreign = saveUser("foreign@example.com", "87654321");
        ownArs = saveAccount(owner, "111111111111", Currency.ARS, "535.00");
        ownSecondArs = saveAccount(owner, "222222222222", Currency.ARS, "350.00");
        ownUsd = saveAccount(owner, "333333333333", Currency.USD, "100.00");
        foreignArs = saveAccount(foreign, "444444444444", Currency.ARS, "5115.00");

        insertMovement(foreignArs, null, "CREDIT", "ADMIN_CREDIT", "5000.00", "5000.00", "2026-09-01T15:00:00Z");
        insertMovement(ownArs, null, "CREDIT", "ADMIN_CREDIT", "1000.00", "1000.00", "2026-10-01T15:00:00Z");
        transfer(ownArs, ownSecondArs, "300.00", "700.00", "300.00", "2026-10-02T15:00:00Z");
        transfer(ownArs, foreignArs, "200.00", "500.00", "5200.00", "2026-10-03T15:00:00Z");
        transfer(foreignArs, ownSecondArs, "50.00", "5150.00", "350.00", "2026-10-04T15:00:00Z");
        insertMovement(ownUsd, null, "CREDIT", "ADMIN_CREDIT", "100.00", "100.00", "2026-10-04T16:00:00Z");
        transfer(foreignArs, ownArs, "10.00", "5140.00", "510.00", "2026-10-06T02:00:00Z");
        transfer(foreignArs, ownArs, "25.00", "5115.00", "535.00", "2026-10-10T15:00:00Z");
    }

    private void transfer(Account source, Account target, String amount, String sourceAfter, String targetAfter, String at) {
        UUID transferId = UUID.randomUUID();
        Timestamp timestamp = Timestamp.from(Instant.parse(at));
        jdbcTemplate.update("""
                        INSERT INTO transfers (id, source_account_id, target_account_id, amount, currency, description, status, created_at, updated_at, completed_at)
                        VALUES (?, ?, ?, ?, ?, 'test transfer', 'COMPLETED', ?, ?, ?)
                        """,
                transferId, source.getId(), target.getId(), new BigDecimal(amount), source.getCurrency().name(),
                timestamp, timestamp, timestamp
        );
        insertMovement(source, transferId, "DEBIT", "TRANSFER", amount, sourceAfter, at);
        insertMovement(target, transferId, "CREDIT", "TRANSFER", amount, targetAfter, at);
    }

    private void insertMovement(
            Account account,
            UUID transferId,
            String type,
            String origin,
            String amount,
            String balanceAfter,
            String at
    ) {
        jdbcTemplate.update("""
                        INSERT INTO movements (id, account_id, transfer_id, type, origin, amount, balance_after, description, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, 'test movement', ?)
                        """,
                UUID.randomUUID(), account.getId(), transferId, type, origin, new BigDecimal(amount),
                new BigDecimal(balanceAfter), Timestamp.from(Instant.parse(at))
        );
    }

    private User saveUser(String email, String documentNumber) {
        return userRepository.save(new User("Jane", "Doe", email, documentNumber, "unused", Role.CUSTOMER, UserStatus.ACTIVE));
    }

    private Account saveAccount(User user, String accountNumber, Currency currency, String balance) {
        return accountRepository.save(new Account(user, accountNumber, "test account", currency, new BigDecimal(balance), AccountStatus.ACTIVE));
    }
}
