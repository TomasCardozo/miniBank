package minibank.minibank.transfers.dto;

import minibank.minibank.accounts.entity.Currency;
import minibank.minibank.transfers.entity.TransferStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record TransferResponse(
        UUID id,
        UUID sourceAccountId,
        String sourceAccountNumber,
        UUID targetAccountId,
        String targetAccountNumber,
        BigDecimal amount,
        Currency currency,
        String description,
        TransferStatus status,
        String failureReason,
        Instant createdAt,
        Instant completedAt
) {
}
