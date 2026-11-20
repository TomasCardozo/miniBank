package minibank.minibank.limits.dto;

import minibank.minibank.accounts.entity.Currency;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record DailyLimitResponse(
        UUID accountId,
        String accountNumber,
        Currency currency,
        BigDecimal dailyLimit,
        BigDecimal usedToday,
        BigDecimal availableToday,
        LocalDate date,
        Instant updatedAt
) {
}
