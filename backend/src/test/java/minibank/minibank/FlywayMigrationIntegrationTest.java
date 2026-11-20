package minibank.minibank;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@Testcontainers
class FlywayMigrationIntegrationTest {

    @Container
    private static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer(DockerImageName.parse("postgres:17.5"));

    @Test
    void migrationsApplyFromEmptyPostgresAndCreateBankingConstraints() {
        DriverManagerDataSource dataSource = new DriverManagerDataSource(
                POSTGRES.getJdbcUrl(),
                POSTGRES.getUsername(),
                POSTGRES.getPassword()
        );

        Flyway.configure()
                .dataSource(dataSource)
                .locations("classpath:db/migration")
                .load()
                .migrate();

        JdbcTemplate jdbcTemplate = new JdbcTemplate(dataSource);

        assertThat(appliedVersions(jdbcTemplate)).containsExactly("1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11");
        assertThat(tableNames(jdbcTemplate)).contains(
                "users",
                "accounts",
                "transfers",
                "movements",
                "daily_limits",
                "audit_logs"
        );
        assertNumericColumn(jdbcTemplate, "accounts", "balance");
        assertNumericColumn(jdbcTemplate, "transfers", "amount");
        assertNumericColumn(jdbcTemplate, "movements", "amount");
        assertNumericColumn(jdbcTemplate, "movements", "balance_after");
        assertNumericColumn(jdbcTemplate, "daily_limits", "daily_limit");

        UUID userId = UUID.randomUUID();
        jdbcTemplate.update("""
                        INSERT INTO users (id, first_name, last_name, email, document_number, password_hash, role, status, created_at, updated_at)
                        VALUES (?, 'Jane', 'Doe', 'jane@example.com', '12345678', 'hash', 'CUSTOMER', 'ACTIVE', now(), now())
                        """,
                userId
        );
        jdbcTemplate.update("""
                        INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details, ip_address, created_at)
                        VALUES (?, ?, 'ACCOUNT_CREDITED', 'ACCOUNT', ?, 'test', '127.0.0.1', now())
                        """,
                UUID.randomUUID(),
                userId,
                UUID.randomUUID()
        );
        assertThatThrownBy(() -> jdbcTemplate.update("""
                                INSERT INTO users (id, first_name, last_name, email, document_number, password_hash, role, status, created_at, updated_at)
                                VALUES (?, 'John', 'Doe', 'jane@example.com', '87654321', 'hash', 'CUSTOMER', 'ACTIVE', now(), now())
                                """,
                        UUID.randomUUID()
                ))
                .hasMessageContaining("uk_users_email");

        jdbcTemplate.update("""
                        INSERT INTO accounts (id, user_id, account_number, alias, currency, balance, status, created_at, updated_at)
                        VALUES (?, ?, '111111111111', 'main', 'ARS', 100.00, 'ACTIVE', now(), now())
                        """,
                UUID.randomUUID(),
                userId
        );
        assertThatThrownBy(() -> jdbcTemplate.update("""
                                INSERT INTO accounts (id, user_id, account_number, alias, currency, balance, status, created_at, updated_at)
                                VALUES (?, ?, '111111111111', 'duplicate', 'ARS', 100.00, 'ACTIVE', now(), now())
                                """,
                        UUID.randomUUID(),
                        userId
                ))
                .hasMessageContaining("uk_accounts_account_number");
        assertThatThrownBy(() -> jdbcTemplate.update("""
                                INSERT INTO accounts (id, user_id, account_number, alias, currency, balance, status, created_at, updated_at)
                                VALUES (?, ?, '222222222222', 'negative', 'ARS', -1.00, 'ACTIVE', now(), now())
                                """,
                        UUID.randomUUID(),
                        userId
                ))
                .hasMessageContaining("ck_accounts_balance_non_negative");
    }

    @Test
    void v11BackfillsAdminCreditMovementsFromAuditLogs() {
        DriverManagerDataSource dataSource = new DriverManagerDataSource(
                POSTGRES.getJdbcUrl(),
                POSTGRES.getUsername(),
                POSTGRES.getPassword()
        );
        String schema = "backfill_test";

        Flyway.configure()
                .dataSource(dataSource)
                .schemas(schema)
                .locations("classpath:db/migration")
                .target("10")
                .load()
                .migrate();

        JdbcTemplate jdbcTemplate = new JdbcTemplate(dataSource);
        UUID userId = UUID.randomUUID();
        UUID accountId = UUID.randomUUID();
        jdbcTemplate.update("""
                        INSERT INTO backfill_test.users (id, first_name, last_name, email, document_number, password_hash, role, status, created_at, updated_at)
                        VALUES (?, 'Jane', 'Doe', 'jane@example.com', '12345678', 'hash', 'CUSTOMER', 'ACTIVE', now(), now())
                        """,
                userId
        );
        jdbcTemplate.update("""
                        INSERT INTO backfill_test.accounts (id, user_id, account_number, alias, currency, balance, status, created_at, updated_at)
                        VALUES (?, ?, '111111111111', 'main', 'ARS', 1250.50, 'ACTIVE', now(), now())
                        """,
                accountId,
                userId
        );
        insertCreditAudit(jdbcTemplate, userId, accountId,
                "accountId=%s,userId=%s,amount=1000.00,previousBalance=0.00,newBalance=1000.00".formatted(accountId, userId),
                "2026-10-01T12:00:00Z");
        insertCreditAudit(jdbcTemplate, userId, accountId,
                "accountId=%s,userId=%s,amount=2.505E+2,previousBalance=1000.00,newBalance=1250.50".formatted(accountId, userId),
                "2026-10-05T12:00:00Z");
        insertCreditAudit(jdbcTemplate, userId, accountId, "unparseable", "2026-10-06T12:00:00Z");

        Flyway.configure()
                .dataSource(dataSource)
                .schemas(schema)
                .locations("classpath:db/migration")
                .load()
                .migrate();

        List<Map<String, Object>> movements = jdbcTemplate.queryForList("""
                SELECT account_id, transfer_id, type, origin, amount, balance_after, created_at
                FROM backfill_test.movements
                ORDER BY created_at
                """);

        assertThat(movements).hasSize(2);
        assertThat(movements.get(0).get("account_id")).isEqualTo(accountId);
        assertThat(movements.get(0).get("transfer_id")).isNull();
        assertThat(movements.get(0).get("type")).isEqualTo("CREDIT");
        assertThat(movements.get(0).get("origin")).isEqualTo("ADMIN_CREDIT");
        assertThat((BigDecimal) movements.get(0).get("amount")).isEqualByComparingTo("1000.00");
        assertThat((BigDecimal) movements.get(0).get("balance_after")).isEqualByComparingTo("1000.00");
        assertThat(((Timestamp) movements.get(0).get("created_at")).toInstant()).isEqualTo(Instant.parse("2026-10-01T12:00:00Z"));
        assertThat((BigDecimal) movements.get(1).get("amount")).isEqualByComparingTo("250.50");
        assertThat((BigDecimal) movements.get(1).get("balance_after")).isEqualByComparingTo("1250.50");

        assertThatThrownBy(() -> jdbcTemplate.update("""
                                INSERT INTO backfill_test.movements (id, account_id, transfer_id, type, origin, amount, balance_after, created_at)
                                VALUES (?, ?, null, 'CREDIT', 'TRANSFER', 1.00, 1.00, now())
                                """,
                        UUID.randomUUID(),
                        accountId
                ))
                .hasMessageContaining("ck_movements_origin_transfer");
        assertThatThrownBy(() -> jdbcTemplate.update("""
                                INSERT INTO backfill_test.movements (id, account_id, transfer_id, type, origin, amount, balance_after, created_at)
                                VALUES (?, ?, null, 'DEBIT', 'ADMIN_CREDIT', 1.00, 1.00, now())
                                """,
                        UUID.randomUUID(),
                        accountId
                ))
                .hasMessageContaining("ck_movements_origin_transfer");
    }

    private void insertCreditAudit(JdbcTemplate jdbcTemplate, UUID userId, UUID accountId, String details, String createdAt) {
        jdbcTemplate.update("""
                        INSERT INTO backfill_test.audit_logs (id, user_id, action, entity_type, entity_id, details, ip_address, created_at)
                        VALUES (?, ?, 'ACCOUNT_CREDITED', 'ACCOUNT', ?, ?, '127.0.0.1', ?)
                        """,
                UUID.randomUUID(),
                userId,
                accountId,
                details,
                Timestamp.from(Instant.parse(createdAt))
        );
    }

    private List<String> appliedVersions(JdbcTemplate jdbcTemplate) {
        return jdbcTemplate.queryForList("""
                SELECT version
                FROM flyway_schema_history
                WHERE success = true AND version IS NOT NULL
                ORDER BY installed_rank
                """, String.class);
    }

    private List<String> tableNames(JdbcTemplate jdbcTemplate) {
        return jdbcTemplate.queryForList("""
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'public'
                """, String.class);
    }

    private void assertNumericColumn(JdbcTemplate jdbcTemplate, String tableName, String columnName) {
        var column = jdbcTemplate.queryForMap("""
                        SELECT data_type, numeric_precision, numeric_scale
                        FROM information_schema.columns
                        WHERE table_schema = 'public' AND table_name = ? AND column_name = ?
                        """,
                tableName,
                columnName
        );

        assertThat(column.get("data_type")).isEqualTo("numeric");
        assertThat(((Number) column.get("numeric_precision")).intValue()).isEqualTo(19);
        assertThat(((Number) column.get("numeric_scale")).intValue()).isEqualTo(2);
    }
}
