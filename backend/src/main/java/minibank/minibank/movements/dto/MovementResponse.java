package minibank.minibank.movements.dto;

import minibank.minibank.movements.entity.MovementOrigin;
import minibank.minibank.movements.entity.MovementType;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record MovementResponse(
        UUID id,
        UUID accountId,
        String accountNumber,
        UUID transferId,
        MovementType type,
        MovementOrigin origin,
        BigDecimal amount,
        BigDecimal balanceAfter,
        String description,
        Instant createdAt
) {
}
