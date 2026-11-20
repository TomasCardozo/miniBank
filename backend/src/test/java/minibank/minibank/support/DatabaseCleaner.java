package minibank.minibank.support;

import org.springframework.jdbc.core.JdbcTemplate;

public class DatabaseCleaner {

    private final JdbcTemplate jdbcTemplate;

    public DatabaseCleaner(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public void clean() {
        jdbcTemplate.execute("""
                TRUNCATE TABLE
                    audit_logs,
                    movements,
                    transfers,
                    daily_limits,
                    accounts,
                    users
                CASCADE
                """);
    }
}
