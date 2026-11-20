package minibank.minibank;

import com.fasterxml.jackson.databind.ObjectMapper;
import minibank.minibank.accounts.entity.Account;
import minibank.minibank.accounts.entity.AccountStatus;
import minibank.minibank.accounts.entity.Currency;
import minibank.minibank.accounts.repository.AccountRepository;
import minibank.minibank.movements.entity.Movement;
import minibank.minibank.movements.repository.MovementRepository;
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
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ActiveProfiles("test")
@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
class TransferRollbackIntegrationTest {

    private final MockMvc mockMvc;
    private final ObjectMapper objectMapper;
    private final UserRepository userRepository;
    private final AccountRepository accountRepository;
    private final TransferRepository transferRepository;
    private final JdbcTemplate jdbcTemplate;

    @MockitoBean(enforceOverride = true)
    private MovementRepository movementRepository;

    @Autowired
    TransferRollbackIntegrationTest(
            MockMvc mockMvc,
            UserRepository userRepository,
            AccountRepository accountRepository,
            TransferRepository transferRepository,
            JdbcTemplate jdbcTemplate
    ) {
        this.mockMvc = mockMvc;
        this.objectMapper = new ObjectMapper().findAndRegisterModules();
        this.userRepository = userRepository;
        this.accountRepository = accountRepository;
        this.transferRepository = transferRepository;
        this.jdbcTemplate = jdbcTemplate;
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
        jdbcTemplate.update("delete from audit_logs");
        jdbcTemplate.update("delete from movements");
        jdbcTemplate.update("delete from transfers");
        jdbcTemplate.update("delete from accounts");
        jdbcTemplate.update("delete from users");
    }

    @Test
    void createTransferRollsBackBalancesAndTransferWhenDebitMovementFails() throws Exception {
        assertRollbackWhenMovementSaveFailsOn(1);
    }

    @Test
    void createTransferRollsBackBalancesAndTransferWhenCreditMovementFails() throws Exception {
        assertRollbackWhenMovementSaveFailsOn(2);
    }

    private void assertRollbackWhenMovementSaveFailsOn(int failingSaveNumber) throws Exception {
        AtomicInteger movementSaves = new AtomicInteger();
        when(movementRepository.save(any(Movement.class))).thenAnswer(invocation -> {
            if (movementSaves.incrementAndGet() == failingSaveNumber) {
                throw new RuntimeException("forced movement failure");
            }
            return invocation.getArgument(0);
        });

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
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.code").value("INTERNAL_ERROR"));

        assertThat(transferRepository.findAll()).isEmpty();
        assertThat(countRows("transfers")).isZero();
        assertThat(countRows("movements")).isZero();
        assertThat(accountRepository.findById(source.getId()).orElseThrow().getBalance())
                .isEqualByComparingTo("500.00");
        assertThat(accountRepository.findById(targetAccount.getId()).orElseThrow().getBalance())
                .isEqualByComparingTo("100.00");
    }

    private Integer countRows(String tableName) {
        return jdbcTemplate.queryForObject("select count(*) from " + tableName, Integer.class);
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
