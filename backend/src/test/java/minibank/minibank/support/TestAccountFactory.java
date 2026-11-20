package minibank.minibank.support;

import minibank.minibank.accounts.entity.Account;
import minibank.minibank.accounts.entity.AccountStatus;
import minibank.minibank.accounts.entity.Currency;
import minibank.minibank.users.entity.User;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public final class TestAccountFactory {

    private static final Instant DEFAULT_TIME = Instant.parse("2026-07-26T10:00:00Z");

    private TestAccountFactory() {
    }

    public static Account activeArsAccount(User owner, String accountNumber, String balance) {
        return account(owner, UUID.randomUUID(), accountNumber, Currency.ARS, "main", balance, AccountStatus.ACTIVE);
    }

    public static Account account(
            User owner,
            UUID id,
            String accountNumber,
            Currency currency,
            String alias,
            String balance,
            AccountStatus status
    ) {
        Account account = new Account(owner, accountNumber, alias, currency, new BigDecimal(balance), status);
        ReflectionTestUtils.setField(account, "id", id);
        ReflectionTestUtils.setField(account, "createdAt", DEFAULT_TIME);
        ReflectionTestUtils.setField(account, "updatedAt", DEFAULT_TIME);
        return account;
    }
}
