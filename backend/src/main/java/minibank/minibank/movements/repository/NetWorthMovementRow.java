package minibank.minibank.movements.repository;

import minibank.minibank.accounts.entity.Currency;
import minibank.minibank.movements.entity.MovementOrigin;
import minibank.minibank.movements.entity.MovementType;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record NetWorthMovementRow(
        Currency currency,
        MovementType type,
        MovementOrigin origin,
        BigDecimal amount,
        Instant createdAt,
        UUID sourceUserId,
        UUID targetUserId
) {
}
