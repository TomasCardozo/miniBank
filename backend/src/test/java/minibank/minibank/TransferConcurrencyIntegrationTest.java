package minibank.minibank;

import com.fasterxml.jackson.databind.ObjectMapper;
import minibank.minibank.accounts.entity.Account;
import minibank.minibank.accounts.entity.AccountStatus;
import minibank.minibank.accounts.entity.Currency;
import minibank.minibank.accounts.repository.AccountRepository;
import minibank.minibank.limits.entity.DailyLimit;
import minibank.minibank.limits.repository.DailyLimitRepository;
import minibank.minibank.movements.repository.MovementRepository;
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
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ActiveProfiles("test")
@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
class TransferConcurrencyIntegrationTest {

    private final MockMvc mockMvc;
    private final ObjectMapper objectMapper;
    private final UserRepository userRepository;
    private final AccountRepository accountRepository;
    private final TransferRepository transferRepository;
    private final MovementRepository movementRepository;
    private final DailyLimitRepository dailyLimitRepository;
    private final JdbcTemplate jdbcTemplate;
    private final DataSource dataSource;

    @Autowired
    TransferConcurrencyIntegrationTest(
            MockMvc mockMvc,
            UserRepository userRepository,
            AccountRepository accountRepository,
            TransferRepository transferRepository,
            MovementRepository movementRepository,
            DailyLimitRepository dailyLimitRepository,
            JdbcTemplate jdbcTemplate,
            DataSource dataSource
    ) {
        this.mockMvc = mockMvc;
        this.objectMapper = new ObjectMapper().findAndRegisterModules();
        this.userRepository = userRepository;
        this.accountRepository = accountRepository;
        this.transferRepository = transferRepository;
        this.movementRepository = movementRepository;
        this.dailyLimitRepository = dailyLimitRepository;
        this.jdbcTemplate = jdbcTemplate;
        this.dataSource = dataSource;
    }

    @BeforeEach
    void setUp() {
        cleanDatabase();
    }

    @AfterEach
    void tearDown() {
        cleanDatabase();
    }

    @Test
    void concurrentTransfersFromSameAccountOnlySpendAvailableBalanceOnce() throws Exception {
        String token = register("owner@example.com", "12345678");
        register("target1@example.com", "87654321");
        register("target2@example.com", "11112222");
        User owner = userRepository.findByEmail("owner@example.com").orElseThrow();
        User target1 = userRepository.findByEmail("target1@example.com").orElseThrow();
        User target2 = userRepository.findByEmail("target2@example.com").orElseThrow();
        Account source = saveAccount(owner, "111111111111", "100.00");
        Account firstTarget = saveAccount(target1, "222222222222", "0.00");
        Account secondTarget = saveAccount(target2, "333333333333", "0.00");

        List<TransferCallResult> results = executeConcurrently(List.of(
                () -> postTransfer(token, source.getId(), firstTarget.getAccountNumber(), "100.00"),
                () -> postTransfer(token, source.getId(), secondTarget.getAccountNumber(), "100.00")
        ));

        assertThat(results).extracting(TransferCallResult::status).containsExactlyInAnyOrder(201, 422);
        assertThat(errorCodeCount(results, "TRANSFER_INSUFFICIENT_FUNDS")).isEqualTo(1);
        assertThat(accountRepository.findById(source.getId()).orElseThrow().getBalance()).isEqualByComparingTo("0.00");
        assertThat(transferRepository.findAll()).hasSize(1);
        assertThat(transferRepository.findAll().getFirst().getStatus()).isEqualTo(TransferStatus.COMPLETED);
        assertThat(movementRepository.findAll()).hasSize(2);
        assertCompletedTransfersHaveDebitAndCredit();
        assertCoreInvariants();
    }

    @Test
    void concurrentValidTransfersAllCompleteAndPreserveTotalBalance() throws Exception {
        String token = register("owner@example.com", "12345678");
        User owner = userRepository.findByEmail("owner@example.com").orElseThrow();
        Account source = saveAccount(owner, "111111111111", "1000.00");
        List<Account> targets = new ArrayList<>();
        for (int i = 0; i < 5; i++) {
            register("target%s@example.com".formatted(i), "8765432%s".formatted(i));
            User target = userRepository.findByEmail("target%s@example.com".formatted(i)).orElseThrow();
            targets.add(saveAccount(target, "22222222222%s".formatted(i), "0.00"));
        }

        List<Callable<TransferCallResult>> calls = targets.stream()
                .<Callable<TransferCallResult>>map(target -> () -> postTransfer(
                        token,
                        source.getId(),
                        target.getAccountNumber(),
                        "100.00"
                ))
                .toList();

        List<TransferCallResult> results = executeConcurrently(calls);

        assertThat(results).extracting(TransferCallResult::status).containsOnly(201);
        assertThat(accountRepository.findById(source.getId()).orElseThrow().getBalance()).isEqualByComparingTo("500.00");
        assertThat(totalBalanceFor(List.of(source), targets)).isEqualByComparingTo("1000.00");
        assertThat(transferRepository.findAll()).hasSize(5);
        assertThat(movementRepository.findAll()).hasSize(10);
        assertCompletedTransfersHaveDebitAndCredit();
        assertCoreInvariants();
    }

    @Test
    void concurrentTransfersRespectDailyLimit() throws Exception {
        String token = register("owner@example.com", "12345678");
        register("target1@example.com", "87654321");
        register("target2@example.com", "11112222");
        User owner = userRepository.findByEmail("owner@example.com").orElseThrow();
        User target1 = userRepository.findByEmail("target1@example.com").orElseThrow();
        User target2 = userRepository.findByEmail("target2@example.com").orElseThrow();
        Account source = saveAccount(owner, "111111111111", "500.00");
        Account firstTarget = saveAccount(target1, "222222222222", "0.00");
        Account secondTarget = saveAccount(target2, "333333333333", "0.00");
        dailyLimitRepository.save(new DailyLimit(source, new BigDecimal("150.00")));

        List<TransferCallResult> results = executeConcurrently(List.of(
                () -> postTransfer(token, source.getId(), firstTarget.getAccountNumber(), "100.00"),
                () -> postTransfer(token, source.getId(), secondTarget.getAccountNumber(), "100.00")
        ));

        assertThat(results).extracting(TransferCallResult::status).containsExactlyInAnyOrder(201, 422);
        assertThat(errorCodeCount(results, "DAILY_LIMIT_EXCEEDED")).isEqualTo(1);
        assertThat(accountRepository.findById(source.getId()).orElseThrow().getBalance()).isEqualByComparingTo("400.00");
        assertThat(transferRepository.findAll()).hasSize(1);
        assertThat(movementRepository.findAll()).hasSize(2);
        assertThat(completedTransferAmount(source.getId())).isLessThanOrEqualTo(new BigDecimal("150.00"));
        assertCompletedTransfersHaveDebitAndCredit();
        assertCoreInvariants();
    }

    @Test
    void oppositeDirectionConcurrentTransfersDoNotDeadlock() throws Exception {
        String firstToken = register("first@example.com", "12345678");
        String secondToken = register("second@example.com", "87654321");
        User firstUser = userRepository.findByEmail("first@example.com").orElseThrow();
        User secondUser = userRepository.findByEmail("second@example.com").orElseThrow();
        Account firstAccount = saveAccount(firstUser, "111111111111", "500.00");
        Account secondAccount = saveAccount(secondUser, "222222222222", "500.00");

        List<TransferCallResult> results = executeConcurrently(List.of(
                () -> postTransfer(firstToken, firstAccount.getId(), secondAccount.getAccountNumber(), "100.00"),
                () -> postTransfer(secondToken, secondAccount.getId(), firstAccount.getAccountNumber(), "100.00")
        ));

        assertThat(results).extracting(TransferCallResult::status).containsOnly(201);
        assertThat(accountRepository.findById(firstAccount.getId()).orElseThrow().getBalance()).isEqualByComparingTo("500.00");
        assertThat(accountRepository.findById(secondAccount.getId()).orElseThrow().getBalance()).isEqualByComparingTo("500.00");
        assertThat(transferRepository.findAll()).hasSize(2);
        assertThat(movementRepository.findAll()).hasSize(4);
        assertCompletedTransfersHaveDebitAndCredit();
        assertCoreInvariants();
    }

    @Test
    void transferWaitsForPessimisticAccountLock() throws Exception {
        String token = register("owner@example.com", "12345678");
        register("target@example.com", "87654321");
        User owner = userRepository.findByEmail("owner@example.com").orElseThrow();
        User target = userRepository.findByEmail("target@example.com").orElseThrow();
        Account source = saveAccount(owner, "111111111111", "500.00");
        Account targetAccount = saveAccount(target, "222222222222", "0.00");

        ExecutorService executor = Executors.newSingleThreadExecutor();
        try (Connection connection = dataSource.getConnection()) {
            connection.setAutoCommit(false);
            try (PreparedStatement statement = connection.prepareStatement("select id from accounts where id = ? for update")) {
                statement.setObject(1, source.getId());
                statement.executeQuery();

                Future<TransferCallResult> future = executor.submit(() -> postTransfer(
                        token,
                        source.getId(),
                        targetAccount.getAccountNumber(),
                        "100.00"
                ));

                TimeUnit.MILLISECONDS.sleep(300);
                assertThat(future).isNotDone();

                connection.commit();
                assertThat(future.get(5, TimeUnit.SECONDS).status()).isEqualTo(201);
            } finally {
                connection.rollback();
            }
        } finally {
            executor.shutdownNow();
        }

        assertThat(accountRepository.findById(source.getId()).orElseThrow().getBalance()).isEqualByComparingTo("400.00");
        assertThat(accountRepository.findById(targetAccount.getId()).orElseThrow().getBalance()).isEqualByComparingTo("100.00");
        assertCompletedTransfersHaveDebitAndCredit();
        assertCoreInvariants();
    }

    private List<TransferCallResult> executeConcurrently(List<Callable<TransferCallResult>> calls) throws Exception {
        ExecutorService executor = Executors.newFixedThreadPool(calls.size());
        CountDownLatch ready = new CountDownLatch(calls.size());
        CountDownLatch start = new CountDownLatch(1);
        try {
            List<Future<TransferCallResult>> futures = new ArrayList<>();
            for (Callable<TransferCallResult> call : calls) {
                futures.add(executor.submit(() -> {
                    ready.countDown();
                    assertThat(start.await(5, TimeUnit.SECONDS)).isTrue();
                    return call.call();
                }));
            }

            assertThat(ready.await(5, TimeUnit.SECONDS)).isTrue();
            start.countDown();

            List<TransferCallResult> results = new ArrayList<>();
            for (Future<TransferCallResult> future : futures) {
                results.add(future.get(10, TimeUnit.SECONDS));
            }
            return results;
        } finally {
            executor.shutdownNow();
        }
    }

    private TransferCallResult postTransfer(String token, UUID sourceAccountId, String targetAccountNumber, String amount) throws Exception {
        var response = mockMvc.perform(post("/transfers")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createTransferJson(sourceAccountId, targetAccountNumber, amount)))
                .andReturn()
                .getResponse();

        return new TransferCallResult(response.getStatus(), response.getContentAsString());
    }

    private void assertCoreInvariants() {
        assertThat(countRows("select count(*) from accounts where balance < 0")).isZero();
        assertThat(countRows("""
                select count(*)
                from movements movement
                left join transfers transfer on movement.transfer_id = transfer.id
                where transfer.id is null
                """)).isZero();
        assertThat(countRows("""
                select count(*)
                from transfers transfer
                where transfer.status = 'COMPLETED'
                  and (select count(*) from movements movement where movement.transfer_id = transfer.id) <> 2
                """)).isZero();
    }

    private void assertCompletedTransfersHaveDebitAndCredit() {
        assertThat(countRows("""
                select count(*)
                from transfers transfer
                where transfer.status = 'COMPLETED'
                  and not exists (
                    select 1 from movements movement
                    where movement.transfer_id = transfer.id and movement.type = 'DEBIT'
                  )
                """)).isZero();
        assertThat(countRows("""
                select count(*)
                from transfers transfer
                where transfer.status = 'COMPLETED'
                  and not exists (
                    select 1 from movements movement
                    where movement.transfer_id = transfer.id and movement.type = 'CREDIT'
                  )
                """)).isZero();
    }

    private BigDecimal totalBalanceFor(List<Account> sources, List<Account> targets) {
        List<UUID> accountIds = new ArrayList<>();
        sources.forEach(source -> accountIds.add(source.getId()));
        targets.forEach(target -> accountIds.add(target.getId()));
        String placeholders = String.join(",", java.util.Collections.nCopies(accountIds.size(), "?"));
        return jdbcTemplate.queryForObject(
                "select coalesce(sum(balance), 0) from accounts where id in (" + placeholders + ")",
                BigDecimal.class,
                accountIds.toArray()
        );
    }

    private long errorCodeCount(List<TransferCallResult> results, String expectedCode) {
        return results.stream()
                .filter(result -> result.status() >= 400)
                .filter(result -> errorCode(result).equals(expectedCode))
                .count();
    }

    private String errorCode(TransferCallResult result) {
        try {
            return objectMapper.readTree(result.body()).get("code").asText();
        } catch (Exception exception) {
            throw new AssertionError("Invalid error response: " + result.body(), exception);
        }
    }

    private BigDecimal completedTransferAmount(UUID sourceAccountId) {
        return jdbcTemplate.queryForObject(
                """
                        select coalesce(sum(amount), 0)
                        from transfers
                        where source_account_id = ? and status = 'COMPLETED'
                        """,
                BigDecimal.class,
                sourceAccountId
        );
    }

    private int countRows(String sql) {
        return jdbcTemplate.queryForObject(sql, Integer.class);
    }

    private void cleanDatabase() {
        jdbcTemplate.update("delete from audit_logs");
        jdbcTemplate.update("delete from movements");
        jdbcTemplate.update("delete from transfers");
        jdbcTemplate.update("delete from daily_limits");
        jdbcTemplate.update("delete from accounts");
        jdbcTemplate.update("delete from users");
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

    private Account saveAccount(User user, String accountNumber, String balance) {
        return accountRepository.save(new Account(
                user,
                accountNumber,
                accountNumber,
                Currency.ARS,
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

    private record TransferCallResult(int status, String body) {
    }
}
