package minibank.minibank.accounts.dto;

import minibank.minibank.accounts.entity.AccountStatus;
import minibank.minibank.accounts.entity.Currency;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record AdminAccountResponse(
        UUID id,
        UUID userId,
        String ownerFirstName,
        String ownerLastName,
        String ownerEmail,
        String accountNumber,
        String alias,
        Currency currency,
        BigDecimal balance,
        AccountStatus status,
        Instant createdAt,
        Instant updatedAt
) {
}
